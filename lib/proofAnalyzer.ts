/**
 * Proof File Analyzer
 * 
 * Analyzes proof files (instance.json, state_snapshot.json) to extract:
 * - Initial and resulting Merkle tree roots
 * - Participant balance changes
 */

import { StateSnapshot } from '@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS';
import type { JSZipObject } from 'jszip';
import { fetchChannelData } from './ethers';
import { ETHERS_RPC_URL } from './rpc';

export interface InstanceData {
  a_pub_user: string[];
  a_pub_block: string[];
  a_pub_function: string[];
}

export interface ProofAnalysisResult {
  merkleRoots: {
    initial: string;
    resulting: string;
  };
  balances: Array<{
    l1Addr: string;
    mptKey: string;
    balance: string; // in wei (hex)
    balanceFormatted: string; // in ETH (decimal)
  }>;
  contractAddress: string;
}

export interface ParticipantKey {
  address: string;
  mptKey: string;
}

// export interface StateSnapshotData {
//   stateRoot: string;
//   registeredKeys: string[];
//   storageEntries: Array<{
//     index: number;
//     key: string;
//     value: string;
//   }>;
//   contractAddress: string;
//   preAllocatedLeaves?: Array<{
//     key: string;
//     value: string;
//   }>;
// }

/**
 * Combines two 16-byte hex strings into a 32-byte hash
 */
function combine16ByteChunks(lower: string, upper: string): string {
  // Remove 0x prefix
  const lowerClean = lower.replace('0x', '').padStart(32, '0');
  const upperClean = upper.replace('0x', '').padStart(32, '0');
  
  // Combine: upper comes first in the final hash
  return '0x' + upperClean + lowerClean;
}

function normalizeStorageKey(key: string): string {
  const raw = key.startsWith("0x") ? key.slice(2) : key;
  return "0x" + raw.padStart(64, "0").toLowerCase();
}

/**
 * Extract Merkle roots from instance.json
 * 
 * According to updated a_pub_user_description:
 * - a_pub_user[0]: Resulting Merkle tree root hash (lower 16 bytes)
 * - a_pub_user[1]: Resulting Merkle tree root hash (upper 16 bytes)
 * - a_pub_user[2-7]: (empty/reserved)
 * - a_pub_user[8]: Initial Merkle tree root hash (lower 16 bytes)
 * - a_pub_user[9]: Initial Merkle tree root hash (upper 16 bytes)
 * - a_pub_user[10]: EdDSA signature of transaction (lower 16 bytes)
 * - a_pub_user[11]: EdDSA signature of transaction (upper 16 bytes)
 * - a_pub_user[12]: Contract address to call (lower 16 bytes)
 * - a_pub_user[13]: Contract address to call (upper 16 bytes)
 * - a_pub_user[14]: Selector for a function to call (lower 16 bytes)
 * - a_pub_user[15]: Selector for a function to call (upper 16 bytes)
 */
export function extractMerkleRoots(instanceData: InstanceData): {
  initial: string;
  resulting: string;
} {
  const { a_pub_user } = instanceData;
  
  // Resulting root: index 0 (lower) and 1 (upper)
  const resultingRoot = combine16ByteChunks(a_pub_user[0], a_pub_user[1]);
  
  // Initial root: index 8 (lower) and 9 (upper)
  const initialRoot = combine16ByteChunks(a_pub_user[8], a_pub_user[9]);
  
  return {
    initial: initialRoot,
    resulting: resultingRoot,
  };
}

/**
 * Extract participant balances from state_snapshot.json
 * 
 * storageEntries are in participant order (index 0 = participant 0, etc.)
 */
export async function extractParticipantBalances(
  snapshotData: StateSnapshot,
  decimals: number = 18,
  participants?: string[],
  participantKeys?: ParticipantKey[]
): Promise<Array<{
  l1Addr: string;
  mptKey: string;
  balance: string;
  balanceFormatted: string;
}>> {
  const participantByKey = new Map<string, string>();
  let fallbackParticipants = participants && participants.length > 0 ? participants : null;

  if (participantKeys && participantKeys.length > 0) {
    for (const { address, mptKey } of participantKeys) {
      if (!mptKey) continue;
      participantByKey.set(normalizeStorageKey(mptKey), address);
    }
  }

  if (participantByKey.size === 0 && !fallbackParticipants && ETHERS_RPC_URL) {
    try {
      const channelData = await fetchChannelData(ETHERS_RPC_URL, snapshotData.channelId);
      channelData.storageEntries.forEach((entry, idx) => {
        const participant = channelData.participants[idx];
        if (!participant) return;
        participantByKey.set(normalizeStorageKey(entry.key), participant);
      });
      fallbackParticipants = channelData.participants;
    } catch (error) {
      console.warn("extractParticipantBalances: failed to fetch channel data", error);
    }
  }

  return snapshotData.storageEntries.map((entry, idx) => {
    // Convert hex balance to decimal
    const balanceWei = entry.value === "0x" ? 0n : BigInt(entry.value);
    const balanceEth = Number(balanceWei) / Math.pow(10, decimals);
    const keyLower = normalizeStorageKey(entry.key);
    const l1Addr =
      (keyLower ? participantByKey.get(keyLower) : null) ||
      (fallbackParticipants ? fallbackParticipants[idx] : "");

    return {
      l1Addr: l1Addr || "",
      mptKey: entry.key,
      balance: entry.value,
      balanceFormatted: balanceEth.toFixed(decimals),
    };
  });
}

/**
 * Analyze complete proof data
 */
export async function analyzeProof(
  instanceData: InstanceData,
  snapshotData: StateSnapshot,
  decimals: number = 18,
  participants?: string[],
  participantKeys?: ParticipantKey[]
): Promise<ProofAnalysisResult> {
  const merkleRoots = extractMerkleRoots(instanceData);
  const balances = await extractParticipantBalances(
    snapshotData,
    decimals,
    participants,
    participantKeys
  );
  
  return {
    merkleRoots,
    balances,
    contractAddress: snapshotData.contractAddress,
  };
}

/**
 * Parse proof files from ZIP file content stored in Firebase
 * Searches for files recursively by filename regardless of folder structure
 */
export async function parseProofFromBase64Zip(
  base64Content: string
): Promise<{
  instance: InstanceData | null;
  snapshot: StateSnapshot | null;
  error?: string;
}> {
  try {
    // Dynamically import JSZip
    const JSZip = (await import('jszip')).default;
    
    // Convert base64 to binary
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Load ZIP
    const zip = await JSZip.loadAsync(bytes);
    
    // Helper function to find file by name (regardless of folder path)
    const findFileByName = (fileName: string): JSZipObject | null => {
      const allFiles = Object.keys(zip.files);
      for (const filePath of allFiles) {
        // Get just the filename from the path
        const parts = filePath.split('/');
        const name = parts[parts.length - 1];
        if (name.toLowerCase() === fileName.toLowerCase() && !zip.files[filePath].dir) {
          return zip.files[filePath];
        }
      }
      return null;
    };
    
    // Extract instance.json (search by filename only)
    let instance: InstanceData | null = null;
    const instanceFile = findFileByName('instance.json');
    if (instanceFile) {
      const content = await instanceFile.async('string');
      instance = JSON.parse(content);
    }
    
    // Extract state_snapshot.json (search by filename only)
    let snapshot: StateSnapshot | null = null;
    const snapshotFile = findFileByName('state_snapshot.json');
    if (snapshotFile) {
      const content = await snapshotFile.async('string');
      snapshot = JSON.parse(content);
    }
    
    if (!instance || !snapshot) {
      return {
        instance,
        snapshot,
        error: 'Required files not found in ZIP',
      };
    }
    
    return { instance, snapshot };
  } catch (error) {
    console.error('Error parsing proof ZIP:', error);
    return {
      instance: null,
      snapshot: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Utility: Format wei to ETH
 */
export function formatWeiToEth(weiHex: string, decimals: number = 18): string {
  const wei = BigInt(weiHex);
  const eth = Number(wei) / Math.pow(10, decimals);
  return eth.toFixed(2);
}

/**
 * Utility: Compare two balance states
 */
export function compareBalances(
  beforeBalances: Array<{ participantIndex: number; balance: string }>,
  afterBalances: Array<{ participantIndex: number; balance: string }>,
  decimals: number = 18
): Array<{
  participantIndex: number;
  before: string;
  after: string;
  change: string;
  changeFormatted: string;
}> {
  return afterBalances.map((after) => {
    const before = beforeBalances.find(
      (b) => b.participantIndex === after.participantIndex
    );
    
    const beforeWei = before ? BigInt(before.balance) : BigInt(0);
    const afterWei = BigInt(after.balance);
    const changeWei = afterWei - beforeWei;
    
    const changeEth = Number(changeWei) / Math.pow(10, decimals);
    
    return {
      participantIndex: after.participantIndex,
      before: before?.balance || '0x0',
      after: after.balance,
      change: '0x' + changeWei.toString(16),
      changeFormatted: (changeEth >= 0 ? '+' : '') + changeEth.toFixed(2),
    };
  });
}
