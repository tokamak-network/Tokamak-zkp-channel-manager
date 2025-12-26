import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";

const execAsync = promisify(exec);

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes timeout for verification

interface VerifyProofRequest {
  proofZipBase64: string; // Base64 encoded ZIP file containing proof files
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
  const tempDir = path.join(distRoot, "outputs", `verify-${Date.now()}`);

  try {
    const body: VerifyProofRequest = await req.json();
    const { proofZipBase64 } = body;

    if (!proofZipBase64) {
      return NextResponse.json(
        { error: "Missing required field: proofZipBase64" },
        { status: 400 }
      );
    }

    await assertPathExists(distRoot, "dir");

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Decode and extract ZIP file
    const zipBuffer = Buffer.from(proofZipBase64, "base64");
    const zip = await JSZip.loadAsync(zipBuffer);

    // Extract all files to temp directory, handling nested folders
    const synthesizerOutputDir = path.join(tempDir, "synthesizer_output");
    const proveOutputDir = path.join(tempDir, "prove_output");
    await fs.mkdir(synthesizerOutputDir, { recursive: true });
    await fs.mkdir(proveOutputDir, { recursive: true });

    // Categorize files: proof.json goes to prove_output, others go to synthesizer_output
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (file.dir) continue;

      const fileName = path.basename(filePath);
      const content = await file.async("nodebuffer");

      if (fileName === "proof.json") {
        // Proof file goes to prove output directory
        await fs.writeFile(path.join(proveOutputDir, fileName), content);
      } else if (
        fileName === "instance.json" ||
        fileName === "state_snapshot.json" ||
        fileName === "placementVariables.json" ||
        fileName === "instance_description.json" ||
        fileName === "permutation.json"
      ) {
        // Synthesizer output files
        await fs.writeFile(path.join(synthesizerOutputDir, fileName), content);
      }
    }

    // Check if required files exist
    const requiredSynthesizerFiles = ["instance.json"];
    for (const requiredFile of requiredSynthesizerFiles) {
      const filePath = path.join(synthesizerOutputDir, requiredFile);
      try {
        await fs.access(filePath);
      } catch {
        return NextResponse.json(
          {
            error: `Missing required file in ZIP: ${requiredFile}`,
            verified: false,
          },
          { status: 400 }
        );
      }
    }

    // Check if proof.json exists
    const proofFilePath = path.join(proveOutputDir, "proof.json");
    try {
      await fs.access(proofFilePath);
    } catch {
      return NextResponse.json(
        {
          error: "Missing required file in ZIP: proof.json",
          verified: false,
        },
        { status: 400 }
      );
    }

    // Build paths for verify binary
    const verifyBinaryPath = path.join(distRoot, "bin", "verify");
    const libraryPath = path.join(distRoot, "backend-lib", "icicle", "lib");
    const qapPath = path.join(distRoot, "resource", "qap-compiler", "library");
    const setupPath = path.join(distRoot, "resource", "setup", "output");
    const preprocessPath = path.join(distRoot, "resource", "preprocess", "output");

    await assertPathExists(verifyBinaryPath, "file");
    await assertPathExists(libraryPath, "dir");
    await assertPathExists(qapPath, "dir");
    await assertPathExists(setupPath, "dir");
    await assertPathExists(preprocessPath, "dir");

    // verify binary usage: <QAP_PATH> <SYNTHESIZER_PATH> <SETUP_PATH> <PREPROCESS_PATH> <PROOF_PATH>
    const verifyCommand = `"${verifyBinaryPath}" "${qapPath}" "${synthesizerOutputDir}" "${setupPath}" "${preprocessPath}" "${proveOutputDir}"`;
    console.log("Executing verify command:", verifyCommand);

    try {
      const { stdout, stderr } = await execAsync(verifyCommand, {
        cwd: distRoot,
        timeout: 300000, // 5 minutes timeout
        env: {
          ...process.env,
          DYLD_LIBRARY_PATH: libraryPath,
          ICICLE_BACKEND_INSTALL_DIR: path.join(libraryPath, "backend"),
        },
      });

      console.log("Verify stdout:", stdout);
      if (stderr) {
        console.warn("Verify stderr:", stderr);
      }

      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn("Failed to clean up temp directory:", cleanupErr);
      }

      // Check if verification passed
      // The verify binary outputs "true" on success, "false" on failure
      const outputLines = stdout.trim().split("\n");
      const lastLine = outputLines[outputLines.length - 1].trim().toLowerCase();
      
      const isVerified = lastLine === "true";
      const isFailed = lastLine === "false";

      return NextResponse.json({
        verified: isVerified,
        message: isVerified
          ? "Proof verification successful ✓"
          : isFailed
          ? "Proof verification failed - invalid proof"
          : "Proof verification completed (check output for details)",
        output: stdout,
        stderr: stderr || undefined,
      });
    } catch (execError: any) {
      console.error("Verify execution error:", execError);

      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn("Failed to clean up temp directory:", cleanupErr);
      }

      // Verification failed
      return NextResponse.json({
        verified: false,
        message: "Proof verification failed",
        error: execError.message,
        stderr: execError.stderr || undefined,
      });
    }
  } catch (error: any) {
    console.error("Failed to verify proof:", error);

    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn("Failed to clean up temp directory:", cleanupErr);
    }

    return NextResponse.json(
      {
        error: "Failed to verify proof",
        details: error instanceof Error ? error.message : String(error),
        verified: false,
      },
      { status: 500 }
    );
  }
}

