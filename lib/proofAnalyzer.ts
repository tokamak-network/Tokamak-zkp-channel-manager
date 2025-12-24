/**
 * Proof File Analyzer
 * 
 * Analyzes proof files (instance.json, state_snapshot.json) to extract:
 * - Initial and resulting Merkle tree roots
 * - Participant balance changes
 */

export interface InstanceData {
  a_pub_user: string[];
  a_pub_block: string[];
  a_pub_function: string[];
}

export interface StateSnapshotData {
  stateRoot: string;
  registeredKeys: string[];
  storageEntries: Array<{
    index: number;
    key: string;
    value: string;
  }>;
  contractAddress: string;
  preAllocatedLeaves?: Array<{
    key: string;
    value: string;
  }>;
}

export interface ProofAnalysisResult {
  merkleRoots: {
    initial: string;
    resulting: string;
  };
  balances: Array<{
    participantIndex: number;
    mptKey: string;
    balance: string; // in wei (hex)
    balanceFormatted: string; // in ETH (decimal)
  }>;
  contractAddress: string;
}

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

/**
 * Extract Merkle roots from instance.json
 * 
 * According to instance_description.json:
 * - a_pub_user[8]: Initial Merkle tree root hash (lower 16 bytes)
 * - a_pub_user[9]: Initial Merkle tree root hash (upper 16 bytes)
 * - a_pub_user[10]: Resulting Merkle tree root hash (lower 16 bytes)
 * - a_pub_user[11]: Resulting Merkle tree root hash (upper 16 bytes)
 */
export function extractMerkleRoots(instanceData: InstanceData): {
  initial: string;
  resulting: string;
} {
  const { a_pub_user } = instanceData;
  
  // Initial root: index 8 (lower) and 9 (upper)
  const initialRoot = combine16ByteChunks(a_pub_user[8], a_pub_user[9]);
  
  // Resulting root: index 10 (lower) and 11 (upper)
  const resultingRoot = combine16ByteChunks(a_pub_user[10], a_pub_user[11]);
  
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
export function extractParticipantBalances(
  snapshotData: StateSnapshotData,
  decimals: number = 18
): Array<{
  participantIndex: number;
  mptKey: string;
  balance: string;
  balanceFormatted: string;
}> {
  return snapshotData.storageEntries.map((entry) => {
    // Convert hex balance to decimal
    const balanceWei = BigInt(entry.value);
    const balanceEth = Number(balanceWei) / Math.pow(10, decimals);
    
    return {
      participantIndex: entry.index,
      mptKey: entry.key,
      balance: entry.value,
      balanceFormatted: balanceEth.toFixed(decimals),
    };
  });
}

/**
 * Analyze complete proof data
 */
export function analyzeProof(
  instanceData: InstanceData,
  snapshotData: StateSnapshotData,
  decimals: number = 18
): ProofAnalysisResult {
  const merkleRoots = extractMerkleRoots(instanceData);
  const balances = extractParticipantBalances(snapshotData, decimals);
  
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
  snapshot: StateSnapshotData | null;
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
    const findFileByName = (fileName: string): ReturnType<typeof zip.file>[0] | null => {
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
    let snapshot: StateSnapshotData | null = null;
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
