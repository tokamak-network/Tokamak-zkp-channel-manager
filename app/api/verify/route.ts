import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes timeout for verification

interface VerifyRequest {
  qapPath: string; // Path to QAP compiler library
  synthesizerPath: string; // Path to synthesizer output directory
  setupPath: string; // Path to setup output directory
  preprocessPath: string; // Path to preprocess output directory
  proofPath: string; // Path to proof output directory
}

// Security: Validate that a path contains no shell metacharacters
function validatePathSecurity(inputPath: string): void {
  // Check for shell metacharacters that could enable command injection
  const dangerousChars = /[;&|`$(){}[\]<>\\!*?~'"]/;
  if (dangerousChars.test(inputPath)) {
    throw new Error(`Invalid characters in path: ${inputPath}`);
  }
  // Check for path traversal attempts
  if (inputPath.includes('..')) {
    throw new Error(`Path traversal not allowed: ${inputPath}`);
  }
}

async function assertPathExists(targetPath: string, kind: "file" | "dir") {
  try {
    const stat = await fs.stat(targetPath);
    if (kind === "file" && !stat.isFile()) {
      throw new Error(`Required file is not a file: ${targetPath}. Install Tokamak-zk-EVM first.`);
    }
    if (kind === "dir" && !stat.isDirectory()) {
      throw new Error(`Required directory is not a directory: ${targetPath}. Install Tokamak-zk-EVM first.`);
    }
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(`Required ${kind} not found: ${targetPath}. Install Tokamak-zk-EVM first.`);
    }
    throw new Error(`Failed to access required ${kind}: ${targetPath}`);
  }
}

export async function POST(req: Request) {
  const distRoot = path.join(process.cwd(), "Tokamak-Zk-EVM", "dist");
  
  try {
    const body: VerifyRequest = await req.json();
    const { qapPath, synthesizerPath, setupPath, preprocessPath, proofPath } = body;

    // Validate inputs
    if (!qapPath || !synthesizerPath || !setupPath || !preprocessPath || !proofPath) {
      return NextResponse.json(
        { error: "Missing required fields: qapPath, synthesizerPath, setupPath, preprocessPath, proofPath" },
        { status: 400 }
      );
    }

    // Security: Validate paths for command injection
    try {
      validatePathSecurity(qapPath);
      validatePathSecurity(synthesizerPath);
      validatePathSecurity(setupPath);
      validatePathSecurity(preprocessPath);
      validatePathSecurity(proofPath);
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid path", details: err instanceof Error ? err.message : "Path validation failed" },
        { status: 400 }
      );
    }

    // Resolve absolute paths
    const qapPathAbs = path.isAbsolute(qapPath) ? qapPath : path.join(process.cwd(), qapPath);
    const synthesizerPathAbs = path.isAbsolute(synthesizerPath) ? synthesizerPath : path.join(process.cwd(), synthesizerPath);
    const setupPathAbs = path.isAbsolute(setupPath) ? setupPath : path.join(process.cwd(), setupPath);
    const preprocessPathAbs = path.isAbsolute(preprocessPath) ? preprocessPath : path.join(process.cwd(), preprocessPath);
    const proofPathAbs = path.isAbsolute(proofPath) ? proofPath : path.join(process.cwd(), proofPath);

    // Validate paths exist
    await assertPathExists(qapPathAbs, "dir");
    await assertPathExists(synthesizerPathAbs, "dir");
    await assertPathExists(setupPathAbs, "dir");
    await assertPathExists(preprocessPathAbs, "dir");
    await assertPathExists(proofPathAbs, "dir");

    // Build command
    const binaryPath = path.join(distRoot, "bin", "verify");
    const libraryPath = path.join(distRoot, "backend-lib", "icicle", "lib");
    await assertPathExists(binaryPath, "file");
    await assertPathExists(libraryPath, "dir");

    const command = `"${binaryPath}" "${qapPathAbs}" "${synthesizerPathAbs}" "${setupPathAbs}" "${preprocessPathAbs}" "${proofPathAbs}"`;
    console.log("Executing verify command:", command);

    // Execute binary
    const { stdout, stderr } = await execAsync(command, {
      cwd: distRoot,
      timeout: 300000, // 5 minutes timeout
      env: {
        ...process.env,
        // Add library path for dynamic libraries
        DYLD_LIBRARY_PATH: libraryPath,
        ICICLE_BACKEND_INSTALL_DIR: path.join(libraryPath, "backend"),
      },
    });

    console.log("Verify stdout:", stdout);
    if (stderr) {
      console.warn("Verify stderr:", stderr);
    }

    // Parse verification result from stdout
    // The verify binary outputs "true" or "false" as the last line
    const lines = stdout.trim().split("\n");
    const lastLine = lines[lines.length - 1].trim();
    const isValid = lastLine === "true";

    // Extract timing information if available
    const initTimeMatch = stdout.match(/Verifier init time: ([\d.]+) seconds/);
    const verifyTimeMatch = stdout.match(/Verification time: ([\d.]+) seconds/);
    
    return NextResponse.json({
      success: true,
      valid: isValid,
      initTime: initTimeMatch ? parseFloat(initTimeMatch[1]) : null,
      verifyTime: verifyTimeMatch ? parseFloat(verifyTimeMatch[1]) : null,
      stdout: stdout,
      stderr: stderr || null,
    });
  } catch (error: any) {
    console.error("Failed to verify:", error);

    // Extract meaningful error message from stderr if available
    let errorMessage = "Failed to verify proof";
    let errorDetails = error instanceof Error ? error.message : String(error);
    
    if (error?.stderr) {
      const stderrStr = String(error.stderr);
      if (stderrStr.includes("error:")) {
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

