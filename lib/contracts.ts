import { Address } from "wagmi";
import bridgeAddressJson from "@/lib/bridge-contract-address.json";
import { bridgeContractAbisByName } from "@/lib/bridge-contract-abi";

const expectedNetwork = process.env.NEXT_PUBLIC_DEFAULT_NETWORK;
if (!expectedNetwork) {
  throw new Error("Missing NEXT_PUBLIC_DEFAULT_NETWORK");
}

const contractsByNetwork = {
  sepolia: bridgeAddressJson,
} as const;

type SupportedNetwork = keyof typeof contractsByNetwork;

const abisByNetwork = {
  sepolia: bridgeContractAbisByName,
} as const;

if (!(expectedNetwork in contractsByNetwork)) {
  throw new Error(
    `Unsupported NEXT_PUBLIC_DEFAULT_NETWORK: ${expectedNetwork}. Available: ${Object.keys(
      contractsByNetwork
    ).join(", ")}`
  );
}

const contracts = contractsByNetwork[expectedNetwork as SupportedNetwork];
const abis = abisByNetwork[expectedNetwork as SupportedNetwork];

function getContractAddress<Name extends keyof typeof contracts>(name: Name) {
  const address = contracts[name];
  if (!address) {
    throw new Error(`Missing contract address: ${name}`);
  }
  return address as Address;
}

function getContractAbi<Name extends keyof typeof abis>(name: Name) {
  const abi = abis[name];
  if (!abi) {
    throw new Error(`Missing contract ABI: ${name}`);
  }
  return abi;
}

const bridgeCore = getContractAddress("BridgeCore");
const bridgeDepositManager = getContractAddress("BridgeDepositManager");
const bridgeProofManager = getContractAddress("BridgeProofManager");
const bridgeWithdrawManager = getContractAddress("BridgeWithdrawManager");
const bridgeAdminManager = getContractAddress("BridgeAdminManager");
const tokamakVerifier = getContractAddress("TokamakVerifier");
const groth16Verifier16 = getContractAddress("Groth16Verifier16Leaves");
const groth16Verifier32 = getContractAddress("Groth16Verifier32Leaves");
const groth16Verifier64 = getContractAddress("Groth16Verifier64Leaves");
const groth16Verifier128 = getContractAddress("Groth16Verifier128Leaves");
const zecFrost = getContractAddress("ZecFrost");

// Modular Contract addresses - Updated for new architecture
export const ROLLUP_BRIDGE_CORE_ADDRESS: Address = bridgeCore;
export const ROLLUP_BRIDGE_DEPOSIT_MANAGER_ADDRESS: Address =
  bridgeDepositManager;
export const ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS: Address =
  bridgeProofManager;
export const ROLLUP_BRIDGE_WITHDRAW_MANAGER_ADDRESS: Address =
  bridgeWithdrawManager;
export const ROLLUP_BRIDGE_ADMIN_MANAGER_ADDRESS: Address =
  bridgeAdminManager;

// Legacy address for backwards compatibility
export const ROLLUP_BRIDGE_ADDRESS: Address = ROLLUP_BRIDGE_CORE_ADDRESS;
// Legacy verifier for backwards compatibility
export const VERIFIER_ADDRESS: Address = tokamakVerifier;

// Groth16 Verifiers for different tree sizes
export const GROTH16_VERIFIER_16_ADDRESS: Address =
  groth16Verifier16;
export const GROTH16_VERIFIER_32_ADDRESS: Address =
  groth16Verifier32;
export const GROTH16_VERIFIER_64_ADDRESS: Address =
  groth16Verifier64;
export const GROTH16_VERIFIER_128_ADDRESS: Address =
  groth16Verifier128;
export const ZECFROST_ADDRESS: Address = zecFrost;

// Supported token addresses on Sepolia testnet
export const TON_TOKEN_ADDRESS: Address =
  "0xa30fe40285B8f5c0457DbC3B7C8A280373c40044" as Address; // TON token (18 decimals)
export const ERC20_TRANSFER: Record<Address, {selector: `0x${string}`, slot: number}> = {
  [TON_TOKEN_ADDRESS]: {
    selector: '0xa9059cbb',
    slot: 0,
  }
}
export const USDT_TOKEN_ADDRESS: Address =
  "0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A" as Address; // USDT token
export const USDC_TOKEN_ADDRESS: Address =
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
export const ETH_TOKEN_ADDRESS: Address =
  "0x0000000000000000000000000000000000000001" as Address; // ETH placeholder

// Token utilities are in ./tokenUtils.ts to avoid circular dependency

/**
 * Get the appropriate Groth16 verifier address based on tree size
 * @param treeSize - The merkle tree size (16, 32, 64, or 128)
 * @returns The corresponding verifier contract address
 */
export function getGroth16VerifierAddress(treeSize: number): Address {
  switch (treeSize) {
    case 16:
      return GROTH16_VERIFIER_16_ADDRESS;
    case 32:
      return GROTH16_VERIFIER_32_ADDRESS;
    case 64:
      return GROTH16_VERIFIER_64_ADDRESS;
    case 128:
      return GROTH16_VERIFIER_128_ADDRESS;
    default:
      throw new Error(
        `Unsupported tree size: ${treeSize}. Supported sizes are 16, 32, 64, 128.`
      );
  }
}

export const ROLLUP_BRIDGE_CORE_ABI = getContractAbi("BridgeCore");

// Legacy ABI exports for backwards compatibility
export const ROLLUP_BRIDGE_ABI = ROLLUP_BRIDGE_CORE_ABI;

export const ROLLUP_BRIDGE_DEPOSIT_MANAGER_ABI =
  getContractAbi("BridgeDepositManager");
export const ROLLUP_BRIDGE_PROOF_MANAGER_ABI =
  getContractAbi("BridgeProofManager");
export const ROLLUP_BRIDGE_WITHDRAW_MANAGER_ABI =
  getContractAbi("BridgeWithdrawManager");
export const ROLLUP_BRIDGE_ADMIN_MANAGER_ABI =
  getContractAbi("BridgeAdminManager");

// ERC20 Token ABI - Basic functions for token interactions
export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
