#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

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

async function resolveNetwork(cwd) {
  if (process.env.NEXT_PUBLIC_DEFAULT_NETWORK) {
    return process.env.NEXT_PUBLIC_DEFAULT_NETWORK;
  }
  const envPath = path.join(cwd, ".env.local");
  try {
    const envContents = await fs.readFile(envPath, "utf8");
    const env = parseEnvFile(envContents);
    return env.NEXT_PUBLIC_DEFAULT_NETWORK;
  } catch {
    return undefined;
  }
}

const cwd = process.cwd();
const network = await resolveNetwork(cwd);
if (!network) {
  throw new Error("Missing NEXT_PUBLIC_DEFAULT_NETWORK");
}

const baseUrl =
  process.env.CONTRACTS_JSON_BASE_URL ??
  "https://raw.githubusercontent.com/tokamak-network/Tokamak-zk-EVM-contracts/main/script/output";
const url = `${baseUrl}/contracts-${network}.json`;

const response = await fetch(url);
if (!response.ok) {
  throw new Error(
    `Failed to fetch contracts JSON: ${response.status} ${response.statusText}`
  );
}

const data = await response.json();
if (!data || typeof data !== "object") {
  throw new Error("Invalid contracts JSON: expected object");
}

if ("network" in data && data.network && data.network !== network) {
  throw new Error(
    `Contracts JSON network (${data.network}) does not match NEXT_PUBLIC_DEFAULT_NETWORK (${network}).`
  );
}

if (!("contracts" in data) || !data.contracts || typeof data.contracts !== "object") {
  throw new Error("Invalid contracts JSON: missing contracts map");
}

const addressData = {};
const abiData = {};

for (const [name, contract] of Object.entries(data.contracts)) {
  if (!contract || typeof contract !== "object") {
    throw new Error(`Invalid contract entry for ${name}`);
  }
  if (!("address" in contract) || typeof contract.address !== "string") {
    throw new Error(`Missing address for contract ${name}`);
  }
  if (!("abi" in contract) || !Array.isArray(contract.abi)) {
    throw new Error(`Missing abi for contract ${name}`);
  }
  addressData[name] = contract.address;
  abiData[name] = contract.abi;
}

const addressOutputPath = path.join(cwd, "lib", "bridge-contract-address.json");
const addressContents = `${JSON.stringify(addressData, null, 2)}\n`;
await fs.writeFile(addressOutputPath, addressContents, "utf8");
console.log(`Saved ${addressOutputPath}`);

const abiOutputPath = path.join(cwd, "lib", "bridge-contract-abi.ts");
const abiContents = `import type { InterfaceAbi } from "ethers";

const bridgeContractAbisByName = ${JSON.stringify(
  abiData,
  null,
  2
)} as const;

const bridgeContractAbi: InterfaceAbi =
  bridgeContractAbisByName.BridgeCore ?? [];

export { bridgeContractAbi, bridgeContractAbisByName };
export default bridgeContractAbi;
`;
await fs.writeFile(abiOutputPath, abiContents, "utf8");
console.log(`Saved ${abiOutputPath}`);
