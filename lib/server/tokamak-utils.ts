import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

export const execAsync = promisify(exec);

const defaultInstallHint = "Install Tokamak-zk-EVM first.";

export function getTokamakDistRoot(): string {
  return path.join(process.cwd(), "Tokamak-Zk-EVM", "dist");
}

export function getTokamakBinaryPath(
  binaryName: string,
  distRoot: string = getTokamakDistRoot()
): string {
  return path.join(distRoot, "bin", binaryName);
}

export function getTokamakLibraryPath(
  distRoot: string = getTokamakDistRoot()
): string {
  return path.join(distRoot, "backend-lib", "icicle", "lib");
}

export function getTokamakResourcePath(
  distRoot: string,
  ...parts: string[]
): string {
  return path.join(distRoot, "resource", ...parts);
}

export async function assertPathExists(
  targetPath: string,
  kind: "file" | "dir",
  installHint: string = defaultInstallHint
): Promise<void> {
  try {
    const stat = await fs.stat(targetPath);
    if (kind === "file" && !stat.isFile()) {
      throw new Error(`Required file is not a file: ${targetPath}. ${installHint}`);
    }
    if (kind === "dir" && !stat.isDirectory()) {
      throw new Error(
        `Required directory is not a directory: ${targetPath}. ${installHint}`
      );
    }
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(`Required ${kind} not found: ${targetPath}. ${installHint}`);
    }
    throw new Error(`Failed to access required ${kind}: ${targetPath}`);
  }
}
