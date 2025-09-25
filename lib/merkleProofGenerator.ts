/**
 * Merkle Proof Generator for Withdrawals
 * Integrates with the withdrawal UI to automatically generate proofs
 */

import { keccak256, toHex, concat, pad, encodeAbiParameters, parseAbiParameters } from 'viem';

// Simple quaternary tree implementation for proof generation
export class SimpleQuaternaryTree {
  private depth: number;
  private maxLeaves: number;
  private leaves: string[];
  private tree: { [level: number]: { [index: number]: string } };

  constructor(depth = 3) {
    this.depth = depth;
    this.maxLeaves = 4 ** depth;
    this.leaves = new Array(this.maxLeaves).fill('0x0000000000000000000000000000000000000000000000000000000000000000');
    this.tree = {};
    
    // Initialize tree structure
    for (let level = 0; level <= depth; level++) {
      this.tree[level] = {};
    }
  }

  insert(index: number, leaf: string): void {
    if (index >= this.maxLeaves) throw new Error("Index out of bounds");
    
    this.leaves[index] = leaf;
    this.tree[0][index] = leaf;
    
    // Rebuild the entire tree (simple but correct approach)
    this.rebuild();
  }

  insertAll(leaves: string[]): void {
    for (let i = 0; i < leaves.length; i++) {
      if (i >= this.maxLeaves) break;
      this.leaves[i] = leaves[i];
      this.tree[0][i] = leaves[i];
    }
    this.rebuild();
  }

  private rebuild(): void {
    // Build tree level by level
    for (let level = 1; level <= this.depth; level++) {
      const nodesInLevel = 4 ** (this.depth - level);
      
      for (let nodeIndex = 0; nodeIndex < nodesInLevel; nodeIndex++) {
        // Each node at this level is computed from 4 children at previous level
        const childBaseIndex = nodeIndex * 4;
        const prevLevel = level - 1;
        
        const child0 = this.tree[prevLevel][childBaseIndex] || '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child1 = this.tree[prevLevel][childBaseIndex + 1] || '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child2 = this.tree[prevLevel][childBaseIndex + 2] || '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child3 = this.tree[prevLevel][childBaseIndex + 3] || '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        this.tree[level][nodeIndex] = this.hashFour(child0, child1, child2, child3);
      }
    }
  }

  private hashFour(a: string, b: string, c: string, d: string): string {
    const packed = concat([a as `0x${string}`, b as `0x${string}`, c as `0x${string}`, d as `0x${string}`]);
    return keccak256(packed);
  }

  root(): string {
    return this.tree[this.depth][0] || '0x0000000000000000000000000000000000000000000000000000000000000000';
  }

  proof(leafIndex: number): { pathElements: string[]; leafIndex: number; leaf: string } {
    if (leafIndex >= this.maxLeaves) throw new Error("Leaf index out of bounds");
    
    const pathElements: string[] = [];
    let currentIndex = leafIndex;
    
    for (let level = 0; level < this.depth; level++) {
      const childIndex = currentIndex % 4;
      const siblingBaseIndex = Math.floor(currentIndex / 4) * 4;
      
      // Add the 3 siblings (in order, excluding the child)
      for (let i = 0; i < 4; i++) {
        if (i !== childIndex) {
          const sibling = this.tree[level][siblingBaseIndex + i] || '0x0000000000000000000000000000000000000000000000000000000000000000';
          pathElements.push(sibling);
        }
      }
      
      currentIndex = Math.floor(currentIndex / 4);
    }

    return {
      pathElements,
      leafIndex,
      leaf: this.tree[0][leafIndex] || '0x0000000000000000000000000000000000000000000000000000000000000000'
    };
  }

  // Verify proof manually (for testing)
  verifyProof(leafIndex: number, leaf: string, proof: string[]): boolean {
    let computedHash = leaf;
    let index = leafIndex;
    let proofIndex = 0;

    for (let level = 0; level < this.depth; level++) {
      const childIndex = index % 4;

      if (childIndex === 0) {
        computedHash = this.hashFour(computedHash, proof[proofIndex], proof[proofIndex + 1], proof[proofIndex + 2]);
      } else if (childIndex === 1) {
        computedHash = this.hashFour(proof[proofIndex], computedHash, proof[proofIndex + 1], proof[proofIndex + 2]);
      } else if (childIndex === 2) {
        computedHash = this.hashFour(proof[proofIndex], proof[proofIndex + 1], computedHash, proof[proofIndex + 2]);
      } else {
        computedHash = this.hashFour(proof[proofIndex], proof[proofIndex + 1], proof[proofIndex + 2], computedHash);
      }

      proofIndex += 3;
      index = Math.floor(index / 4);
    }

    return computedHash === this.root();
  }
}

// Helper function to compute leaf like the contract does
export function computeLeaf(prevRoot: string, l2Address: string, balance: string): string {
  // RLC computation matching contract's _computeLeafPure
  // Use abi.encodePacked (like the contract) instead of abi.encode
  const l2AddressBytes32 = pad(toHex(BigInt(l2Address)), { size: 32 });
  const packedData = concat([prevRoot as `0x${string}`, l2AddressBytes32]);
  const gamma = keccak256(packedData);
  
  // RLC formula: l2Address + gamma * balance
  const leafValue = (BigInt(l2Address) + BigInt(gamma) * BigInt(balance)) % (2n ** 256n);
  return pad(toHex(leafValue), { size: 32 });
}

export interface WithdrawalProofData {
  channelId: string;
  claimedBalance: string;
  leafIndex: number;
  merkleProof: string[];
  leafValue: string;
  userL2Address: string;
  computedTreeRoot: string;
  isValid: boolean;
}

export interface ParticipantData {
  participantRoot: string;
  l2Address: string;
  balance: string;
}

/**
 * Generate withdrawal proof for a user given their claimed balance
 * This function needs to fetch participant data from the contract or use provided data
 */
export async function generateWithdrawalProof(
  channelId: string,
  userAddress: string,
  claimedBalance: string,
  participantsData: ParticipantData[]
): Promise<WithdrawalProofData> {
  try {
    // Find user's index in participants data
    let userLeafIndex = -1;
    let userParticipantRoot = '';
    
    for (let i = 0; i < participantsData.length; i++) {
      const participant = participantsData[i];
      if (participant.l2Address.toLowerCase() === userAddress.toLowerCase()) {
        userLeafIndex = i;
        userParticipantRoot = participant.participantRoot;
        break;
      }
    }
    
    if (userLeafIndex === -1) {
      throw new Error(`User address ${userAddress} not found in participants data`);
    }

    // Build the final state tree with individual participant roots
    const tree = new SimpleQuaternaryTree(3);
    const leaves: string[] = [];
    
    for (const { participantRoot, l2Address, balance } of participantsData) {
      const leaf = computeLeaf(participantRoot, l2Address, balance);
      leaves.push(leaf);
    }
    
    tree.insertAll(leaves);
    const computedTreeRoot = tree.root();
    
    // Compute user's leaf with their claimed balance (this is what they're claiming)
    const userLeafValue = computeLeaf(userParticipantRoot, userAddress, claimedBalance);
    
    // Generate merkle proof for the user's specific leaf
    const proofData = tree.proof(userLeafIndex);
    
    // Verify our proof locally
    const isValid = tree.verifyProof(userLeafIndex, userLeafValue, proofData.pathElements);
    
    if (!isValid) {
      throw new Error('Generated proof failed local verification - this likely means the claimed balance is incorrect');
    }

    return {
      channelId,
      claimedBalance,
      leafIndex: userLeafIndex,
      merkleProof: proofData.pathElements,
      leafValue: userLeafValue,
      userL2Address: userAddress,
      computedTreeRoot,
      isValid
    };

  } catch (error) {
    throw new Error(`Proof generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Mock function to get participant data - in production this would fetch from contract
 * For now, we'll use hardcoded test data that matches the contract test cases
 */
/**
 * Quaternary Merkle Tree implementation matching the contract's _insertLeaf logic
 */
export class QuaternaryMerkleTree {
  private depth: number;
  private maxLeaves: number;
  private nextLeafIndex: number;
  private currentRootIndex: number;
  private roots: string[];
  private cachedSubtrees: string[];
  private channelRootSequence: string[];

  constructor(depth = 3) {
    this.depth = depth;
    this.maxLeaves = 4 ** depth;
    this.nextLeafIndex = 0;
    this.currentRootIndex = 0;
    this.roots = [];
    this.cachedSubtrees = new Array(depth).fill('0x0000000000000000000000000000000000000000000000000000000000000000');
    this.channelRootSequence = [];
    
    // Initialize with zero root
    this.roots.push(this.computeZeros(depth));
  }

  private computeZeros(level: number): string {
    let zero = '0x0000000000000000000000000000000000000000000000000000000000000000';
    for (let i = 0; i < level; i++) {
      zero = this.hashFour(zero, zero, zero, zero);
    }
    return zero;
  }

  private hashFour(a: string, b: string, c: string, d: string): string {
    const packed = concat([a as `0x${string}`, b as `0x${string}`, c as `0x${string}`, d as `0x${string}`]);
    return keccak256(packed);
  }

  /**
   * Compute leaf exactly like contract's _computeLeaf function
   */
  computeLeaf(channelId: number, l2Address: string, balance: string, nonce: number): string {
    // Get previous root: if nonce == 0, use channelId, else use last root in sequence
    let prevRoot: string;
    if (nonce === 0) {
      prevRoot = pad(toHex(BigInt(channelId)), { size: 32 });
    } else {
      if (this.channelRootSequence.length === 0 || nonce > this.channelRootSequence.length) {
        throw new Error("Invalid root sequence access");
      }
      prevRoot = this.channelRootSequence[nonce - 1];
    }

    // Compute gamma = keccak256(abi.encodePacked(prevRoot, bytes32(l2Address)))
    const l2AddressBytes32 = pad(toHex(BigInt(l2Address)), { size: 32 });
    const packedData = concat([prevRoot as `0x${string}`, l2AddressBytes32]);
    const gamma = keccak256(packedData);

    // RLC formula: l2Address + gamma * balance
    const leafValue = (BigInt(l2Address) + BigInt(gamma) * BigInt(balance)) % (2n ** 256n);
    return pad(toHex(leafValue), { size: 32 });
  }

  /**
   * Insert leaf exactly like contract's _insertLeaf function
   */
  insertLeaf(leafHash: string): void {
    const leafIndex = this.nextLeafIndex;

    // Check if tree is full
    if (leafIndex >= this.maxLeaves) {
      throw new Error("MerkleTreeFull");
    }

    // Update the cached subtrees and compute new root (matching contract exactly)
    let currentHash = leafHash;
    let currentIndex = leafIndex;

    for (let level = 0; level < this.depth; level++) {
      if (currentIndex % 4 === 0) {
        // This is a leftmost node, cache it
        this.cachedSubtrees[level] = currentHash;
        break;
      } else {
        // Compute parent hash using 4 children (matching contract)
        const left = this.cachedSubtrees[level] || '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child2 = currentIndex % 4 >= 2 ? currentHash : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child3 = currentIndex % 4 === 3 ? currentHash : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child4 = '0x0000000000000000000000000000000000000000000000000000000000000000';

        currentHash = this.hashFour(left, child2, child3, child4);
        currentIndex = Math.floor(currentIndex / 4);
      }
    }

    // Update tree state (matching contract)
    this.nextLeafIndex = leafIndex + 1;

    // Store new root
    const newRootIndex = this.currentRootIndex + 1;
    this.currentRootIndex = newRootIndex;
    this.roots[newRootIndex] = currentHash;
    this.channelRootSequence.push(currentHash);
  }

  getCurrentRoot(): string {
    return this.roots[this.currentRootIndex] || this.computeZeros(this.depth);
  }

  getChannelRootSequence(): string[] {
    return [...this.channelRootSequence];
  }
}

export interface FinalStateData {
  channelId: number;
  participants: Array<{
    l2Address: string;
    balance: string;
  }>;
}

/**
 * Compute final state root exactly like the contract does
 * This matches the initializeChannelState function logic
 */
export function computeFinalStateRoot(channelId: number, participants: Array<{ l2Address: string; balance: string }>): {
  finalStateRoot: string;
  channelRootSequence: string[];
  participantLeaves: string[];
} {
  const tree = new QuaternaryMerkleTree(3); // TREE_DEPTH = 3 in contract
  const participantLeaves: string[] = [];
  let nonce = 0;

  // Process each participant like the contract does in initializeChannelState
  for (const participant of participants) {
    const { l2Address, balance } = participant;

    // Compute and insert leaf (matching contract logic exactly)
    const leaf = tree.computeLeaf(channelId, l2Address, balance, nonce);
    tree.insertLeaf(leaf);
    participantLeaves.push(leaf);

    nonce++;
  }

  return {
    finalStateRoot: tree.getCurrentRoot(),
    channelRootSequence: tree.getChannelRootSequence(),
    participantLeaves
  };
}

export function getMockParticipantData(): ParticipantData[] {
  return [
    {
      participantRoot: "0x8449acb4300b58b00e4852ab07d43f298eaa35688eaa3917ca205f20e6db73e8",
      l2Address: "0xd69B7AaaE8C1c9F0546AfA4Fd8eD39741cE3f59F", // participant1
      balance: "1000000000000000000" // 1 ETH in wei
    },
    {
      participantRoot: "0x3bec727653ae8d56ac6d9c103182ff799fe0a3b512e9840f397f0d21848373e8", 
      l2Address: "0xb18E7CdB6Aa28Cc645227041329896446A1478bd", // participant2
      balance: "1000000000000000000" // 1 ETH in wei
    },
    {
      participantRoot: "0x11e1e541a59fb2cd7fa4371d63103972695ee4bb4d1e646e72427cf6cdc16498",
      l2Address: "0x9D70617FF571Ac34516C610a51023EE1F28373e8", // participant3
      balance: "1000000000000000000" // 1 ETH in wei
    }
  ];
}