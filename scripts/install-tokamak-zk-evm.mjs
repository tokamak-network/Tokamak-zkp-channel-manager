#!/usr/bin/env node
import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function parseEnvFile(contents) {
  const env = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function isDirEmpty(dirPath) {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.length === 0;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return true;
    }
    throw error;
  }
}

const rootDir = process.cwd();
const envFile = path.join(rootDir, ".env.local");
const submoduleDir = path.join(rootDir, "Tokamak-Zk-EVM");

let env = {};
try {
  const envContents = await fs.readFile(envFile, "utf8");
  env = parseEnvFile(envContents);
} catch {
  env = {};
}

const runFlag = env.RUN_TOKAMAK_INSTALL ?? process.env.RUN_TOKAMAK_INSTALL;
if (runFlag !== "true") {
  console.log(
    "Skipping Tokamak-Zk-EVM install (RUN_TOKAMAK_INSTALL != true)."
  );
  process.exit(0);
}

if (Object.keys(env).length === 0) {
  throw new Error(`Missing .env.local at ${envFile}`);
}

const rpcUrl = env.NEXT_ETHERS_RPC_URL;
if (!rpcUrl) {
  throw new Error("NEXT_ETHERS_RPC_URL is empty in .env.local");
}

if (await isDirEmpty(submoduleDir)) {
  console.log("Initializing Tokamak-Zk-EVM submodule from dev branch...");
  await runCommand("git", ["submodule", "update", "--init", "--", submoduleDir]);
  await runCommand("git", ["-C", submoduleDir, "fetch", "origin", "dev"]);
  await runCommand("git", ["-C", submoduleDir, "checkout", "dev"]);
  await runCommand("git", ["-C", submoduleDir, "pull", "--ff-only", "origin", "dev"]);
} else {
  console.log("Tokamak-Zk-EVM submodule not empty; skipping update.");
}

const tokamakCli = path.join(submoduleDir, "tokamak-cli");
try {
  await fs.access(tokamakCli, fsConstants.X_OK);
} catch {
  throw new Error(`tokamak-cli not found or not executable at ${tokamakCli}`);
}

await runCommand(tokamakCli, ["--install", rpcUrl, "--bun"], {
  cwd: submoduleDir,
  env: {
    ...process.env,
    TOKAMAK_ZK_EVM_ROOT: submoduleDir,
  },
});
