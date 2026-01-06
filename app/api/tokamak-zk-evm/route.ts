import { NextResponse } from "next/server";
import { execFile, type ExecFileOptions } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { ETHERS_RPC_URL } from "@/lib/rpc";
import {
  assertPathExists,
  getTokamakDistRoot,
  getTokamakLibraryPath,
} from "@/lib/server/tokamak-utils";
import { getBlockInfo, getBlockNumber, getContractCode } from "@/lib/ethers";
import { createTokamakL2TxFromRLP, StateSnapshot } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS";
import { bigIntToHex, bytesToHex, hexToBytes } from "@ethereumjs/util";
import { tokamakL2Common } from "@/lib/tokamakl2js";
import { TON_TOKEN_ADDRESS } from "@/lib/contracts";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes timeout for long-running synthesis

const execFileAsync = promisify(execFile);

export type SynthesizeTxRequest =  {
  channelId: string;
  channelInitTxHash: `0x${string}`;
  signedTxRlpStr: `0x${string}`;
  previousStateSnapshot: StateSnapshot; // State snapshot JSON object from latest verified proof
  includeProof: boolean; // If true, also run prove binary and include proof.json
}

async function addDirToZip(zip: JSZip, dir: string, rootDir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await addDirToZip(zip, entryPath, rootDir);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const relativePath = path.relative(rootDir, entryPath);
    const data = await fs.readFile(entryPath);
    zip.file(relativePath, data);
  }
}

async function createZipFromDir(
  sourceDir: string,
  zipPath: string,
  extraFiles: Array<{ path: string; name?: string }> = []
) {
  const zip = new JSZip();
  await addDirToZip(zip, sourceDir, sourceDir);
  for (const file of extraFiles) {
    const name = file.name ?? path.basename(file.path);
    const data = await fs.readFile(file.path);
    zip.file(name, data);
  }
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(zipPath, zipBuffer);
}

async function safeRemove(targetPath: string, label: string) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch (cleanupErr) {
    console.warn(`Failed to clean up ${label}:`, cleanupErr);
  }
}

export async function POST(req: Request) {
  let outputDir: string | undefined = undefined;
  try {
    const body: SynthesizeTxRequest = await req.json();
    const {
      channelId,
      channelInitTxHash,
      signedTxRlpStr,
      previousStateSnapshot,
      includeProof = false,
    } = body;

    const distRoot = getTokamakDistRoot();
    const jobId = Date.now();
    outputDir = path.join(distRoot, "outputs", `channel-${channelId}`, `transaction-${jobId}`);
    const synthOutputPath = path.join(distRoot, "resource", "synthesizer", "output");
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(synthOutputPath, { recursive: true });

    const initTxBlockNumber = await getBlockNumber(ETHERS_RPC_URL, channelInitTxHash);
    const blockInfo = await getBlockInfo(
      ETHERS_RPC_URL,
      initTxBlockNumber,
    );
    const blockInfoJson = JSON.stringify(blockInfo, undefined, 2);
    const blockInfoPath = path.join(synthOutputPath, "block_info.json");
    await fs.writeFile(blockInfoPath, blockInfoJson);

    const contractCode = await getContractCode(
      ETHERS_RPC_URL,
      TON_TOKEN_ADDRESS,
      initTxBlockNumber,
    );
    
    const contractCodeStr = bytesToHex(contractCode);
    const contractCodeJson = JSON.stringify(contractCodeStr, undefined, 2);
    const contractCodePath = path.join(synthOutputPath, "contract_code.json");
    await fs.writeFile(contractCodePath, contractCodeJson);

    const previousStateSnapshotJson = JSON.stringify(previousStateSnapshot, undefined, 2);
    const previousStateSnapshotPath = path.join(synthOutputPath, "previous_state_snapshot.json");
    await fs.writeFile(previousStateSnapshotPath, previousStateSnapshotJson);

    await assertPathExists(distRoot, "dir");

    // Build command
    const tokamakCliPath = path.join(
      process.cwd(),
      "Tokamak-Zk-EVM",
      "tokamak-cli"
    );
    const libraryPath = getTokamakLibraryPath(distRoot);
    await assertPathExists(tokamakCliPath, "file");
    await assertPathExists(libraryPath, "dir");

    const outputZipName = `l2-transaction-channel-${channelId}.zip`;
    const outputZipPath = path.join(outputDir, outputZipName);

    const baseEnv = {
      ...process.env,
      DYLD_LIBRARY_PATH: libraryPath,
    };

    const runTokamakCli = async (
      args: string[],
      options: ExecFileOptions = {}
    ) => {
      const label = args[0];
      const { env, ...rest } = options;
      const commandDisplay = [tokamakCliPath, ...args].join(" ");
      console.log(`Executing tokamak-cli ${label} command:`, commandDisplay);
      const { stdout, stderr } = await execFileAsync(tokamakCliPath, args, {
        cwd: distRoot,
        env: { ...baseEnv, ...env },
        ...rest,
      });
      if (stdout) {
        console.log(`${label} stdout:`, stdout);
      }
      if (stderr) {
        console.warn(`${label} stderr:`, stderr);
      }
    };

    // Execute L2 transaction
    await runTokamakCli([
      "--synthesize",
      "--tokamak-ch-tx",
      "--previous-state",
      previousStateSnapshotPath,
      "--transaction",
      signedTxRlpStr,
      "--block-info",
      blockInfoPath,
      "--contract-code",
      contractCodePath,
    ]);
    
    await assertPathExists(synthOutputPath, "dir");

    // If includeProof is true, run the prove step and extract proof ZIP
    if (includeProof) {
      console.log("Running tokamak-cli prove...");

      await runTokamakCli([
        "--prove", 
      ], {
        timeout: 600000, // 10 minutes timeout
      });

      await runTokamakCli([
        "--extract-proof",
        outputZipPath,
      ]);

      await assertPathExists(outputZipPath, "file");
    } else {
      await fs.mkdir(outputDir, { recursive: true });
      await createZipFromDir(synthOutputPath, outputZipPath);
    }
    // Return ZIP file
    const zipBufferNode = await fs.readFile(outputZipPath);
    return new NextResponse(zipBufferNode, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=${outputZipName}"`,
      },
    });
  } catch (error: any) {
    console.error("tokamak-zk-evm POST failed:", error);
    if (outputDir) {
      await safeRemove(outputDir, "output directory");
    }

    // Extract meaningful error message from stderr if available
    let errorMessage = "Failed to synthesize L2 transaction";
    let errorDetails = error instanceof Error ? error.message : String(error);

    if (error?.stderr) {
      // Extract the actual error message from stderr
      const stderrStr = String(error.stderr);
      if (stderrStr.includes("Transaction failed:")) {
        errorMessage = "L2 transaction synthesis failed";
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
