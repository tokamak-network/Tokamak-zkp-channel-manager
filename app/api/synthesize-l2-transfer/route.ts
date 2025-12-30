import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { bytesToHex } from "@ethereumjs/util";
import { deriveL2KeysFromSignature } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/utils/web.ts";
import { ALCHEMY_KEY } from "@/lib/constants";

const execAsync = promisify(exec);

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes timeout for long-running synthesis

interface SynthesizeL2TransferRequest {
  channelId: string;
  initTx: string;
  signature: `0x${string}`;
  recipient: string;
  amount: string;
  useSepolia?: boolean;
  previousStateSnapshot?: any; // State snapshot JSON object from latest verified proof
  includeProof?: boolean; // If true, also run prove binary and include proof.json
}

async function assertPathExists(targetPath: string, kind: "file" | "dir") {
  try {
    const stat = await fs.stat(targetPath);
    if (kind === "file" && !stat.isFile()) {
      throw new Error(
        `Required file is not a file: ${targetPath}. Install Tokamak-zk-EVM first.`
      );
    }
    if (kind === "dir" && !stat.isDirectory()) {
      throw new Error(
        `Required directory is not a directory: ${targetPath}. Install Tokamak-zk-EVM first.`
      );
    }
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(
        `Required ${kind} not found: ${targetPath}. Install Tokamak-zk-EVM first.`
      );
    }
    throw new Error(`Failed to access required ${kind}: ${targetPath}`);
  }
}

export async function POST(req: Request) {
  const distRoot = path.join(process.cwd(), "Tokamak-Zk-EVM", "dist");
  const outputDir = path.join(distRoot, "outputs", `transfer-${Date.now()}`);
  let previousStateSnapshotPath: string | null = null;

  try {
    const body: SynthesizeL2TransferRequest = await req.json();
    const {
      channelId,
      initTx,
      signature,
      recipient,
      amount,
      useSepolia = true,
      previousStateSnapshot,
      includeProof = false,
    } = body;

    // Validate inputs
    if (!channelId || !initTx || !signature || !recipient || !amount) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: channelId, initTx, signature, recipient, amount",
        },
        { status: 400 }
      );
    }

    // Derive L2 private key from signature
    const l2Keys = deriveL2KeysFromSignature(signature);
    const senderKey = bytesToHex(l2Keys.privateKey);
    console.log("Derived L2 sender key from signature");

    await assertPathExists(distRoot, "dir");

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // If previousStateSnapshot is provided, save it to a temporary file
    if (previousStateSnapshot) {
      previousStateSnapshotPath = path.join(
        outputDir,
        "previous_state_snapshot.json"
      );
      await fs.writeFile(
        previousStateSnapshotPath,
        JSON.stringify(previousStateSnapshot, null, 2),
        "utf-8"
      );
      console.log(
        "Saved previous state snapshot to:",
        previousStateSnapshotPath
      );
    }

    // Build RPC URL from environment variable
    if (!ALCHEMY_KEY) {
      throw new Error(
        "NEXT_PUBLIC_ALCHEMY_API_KEY environment variable is not set"
      );
    }
    const rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    // Build command
    const binaryPath = path.join(distRoot, "bin", "synthesizer");
    const libraryPath = path.join(distRoot, "backend-lib", "icicle", "lib");
    await assertPathExists(binaryPath, "file");
    await assertPathExists(libraryPath, "dir");
    const args = [
      "l2-transfer",
      "--channel-id",
      channelId,
      "--init-tx",
      initTx,
      "--sender-key",
      senderKey,
      "--recipient",
      recipient,
      "--amount",
      amount,
      "--output",
      outputDir,
      "--rpc-url",
      rpcUrl,
    ];

    // Add --previous-state option if previousStateSnapshot is provided
    if (previousStateSnapshotPath) {
      args.push("--previous-state", previousStateSnapshotPath);
    }

    if (useSepolia) {
      args.push("--sepolia");
    }

    const command = `"${binaryPath}" ${args.join(" ")}`;
    console.log("Executing synthesizer command:", command);

    // Execute binary
    const { stdout, stderr } = await execAsync(command, {
      cwd: distRoot,
      timeout: 300000, // 5 minutes timeout
      env: {
        ...process.env,
        // Add library path for dynamic libraries
        DYLD_LIBRARY_PATH: libraryPath,
      },
    });

    console.log("Synthesizer stdout:", stdout);
    if (stderr) {
      console.warn("Synthesizer stderr:", stderr);
    }

    // If includeProof is true, run the prove binary
    let proveOutputDir: string | null = null;
    if (includeProof) {
      console.log("Running prove binary...");

      const proveBinaryPath = path.join(distRoot, "bin", "prove");
      const qapPath = path.join(
        distRoot,
        "resource",
        "qap-compiler",
        "library"
      );
      const setupPath = path.join(distRoot, "resource", "setup", "output");
      proveOutputDir = path.join(outputDir, "prove_output");

      await assertPathExists(proveBinaryPath, "file");
      await assertPathExists(qapPath, "dir");
      await assertPathExists(setupPath, "dir");

      // Create prove output directory
      await fs.mkdir(proveOutputDir, { recursive: true });

      // prove binary usage: <QAP_PATH> <SYNTHESIZER_PATH> <SETUP_PATH> <OUT_PATH>
      const proveCommand = `"${proveBinaryPath}" "${qapPath}" "${outputDir}" "${setupPath}" "${proveOutputDir}"`;
      console.log("Executing prove command:", proveCommand);

      const { stdout: proveStdout, stderr: proveStderr } = await execAsync(
        proveCommand,
        {
          cwd: distRoot,
          timeout: 300000, // 5 minutes timeout
          env: {
            ...process.env,
            DYLD_LIBRARY_PATH: libraryPath,
            // ICICLE_BACKEND_INSTALL_DIR: path.join(libraryPath, "backend"),
          },
        }
      );

      console.log("Prove stdout:", proveStdout);
      if (proveStderr) {
        console.warn("Prove stderr:", proveStderr);
      }
    }

    // Read output files
    const outputFiles = await fs.readdir(outputDir);

    if (outputFiles.length === 0) {
      throw new Error("No output files generated by synthesizer");
    }

    // Files to exclude from ZIP (too large and not needed for verification)
    const excludeFiles = ["placementVariables.json"];

    // Create ZIP file with all outputs
    const zip = new JSZip();

    for (const fileName of outputFiles) {
      // Skip excluded files
      if (excludeFiles.includes(fileName)) {
        console.log(`Skipping large file: ${fileName}`);
        continue;
      }

      const filePath = path.join(outputDir, fileName);
      const stat = await fs.stat(filePath);

      if (stat.isFile()) {
        const content = await fs.readFile(filePath);
        zip.file(fileName, content);
      }
    }

    // If prove was run, add proof output files to ZIP
    if (proveOutputDir) {
      try {
        const proveOutputFiles = await fs.readdir(proveOutputDir);
        let addedCount = 0;
        for (const fileName of proveOutputFiles) {
          // Skip excluded files
          if (excludeFiles.includes(fileName)) {
            console.log(`Skipping large file from prove output: ${fileName}`);
            continue;
          }

          const filePath = path.join(proveOutputDir, fileName);
          const stat = await fs.stat(filePath);

          if (stat.isFile()) {
            const content = await fs.readFile(filePath);
            // Add proof files directly to root of ZIP
            zip.file(fileName, content);
            addedCount++;
          }
        }
        console.log(`Added ${addedCount} proof files to ZIP`);
      } catch (err) {
        console.error("Error reading prove output files:", err);
      }
    }

    // Add transaction-info.json with channel and transfer details
    const transactionInfo = {
      channelId,
      initializationTxHash: initTx,
      recipient,
      amount,
      senderKey: senderKey,
      senderPublicKey: bytesToHex(l2Keys.publicKey),
      network: useSepolia ? "sepolia" : "mainnet",
      rpcUrl,
      generatedAt: new Date().toISOString(),
      proofGenerated: includeProof,
    };
    zip.file("transaction-info.json", JSON.stringify(transactionInfo, null, 2));

    // Generate ZIP buffer as Uint8Array and convert to Buffer for NextResponse
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const zipBufferNode = Buffer.from(zipBuffer);

    // Clean up output directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn("Failed to clean up output directory:", cleanupErr);
    }

    // Return ZIP file
    return new NextResponse(zipBufferNode, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="l2-transfer-channel-${channelId}.zip"`,
      },
    });
  } catch (error: any) {
    console.error("Failed to synthesize L2 transfer:", error);

    // Clean up output directory on error
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn("Failed to clean up output directory:", cleanupErr);
    }

    // Clean up previous state snapshot file if it was created
    if (previousStateSnapshotPath) {
      try {
        await fs.unlink(previousStateSnapshotPath).catch(() => {});
      } catch (cleanupErr) {
        // Ignore cleanup errors for temp file
      }
    }

    // Extract meaningful error message from stderr if available
    let errorMessage = "Failed to synthesize L2 transfer";
    let errorDetails = error instanceof Error ? error.message : String(error);

    if (error?.stderr) {
      // Extract the actual error message from stderr
      const stderrStr = String(error.stderr);
      if (stderrStr.includes("Transfer failed:")) {
        errorMessage = "L2 Transfer synthesis failed";
        // Extract the specific error
        const match = stderrStr.match(/Transfer failed: (.+)/);
        if (match) {
          errorDetails = match[1];
        }
      } else if (stderrStr.includes("error:")) {
        const match = stderrStr.match(/error: (.+)/);
        if (match) {
          errorDetails = match[1];
        }
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
