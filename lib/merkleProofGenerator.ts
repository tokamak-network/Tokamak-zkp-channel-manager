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
    this.leaves = new Array(this.maxLeaves).fill(this.zeros(0));
    this.tree = {};
    
    // Initialize tree structure
    for (let level = 0; level <= depth; level++) {
      this.tree[level] = {};
    }
  }

  // Match contract's _zeros function exactly
  private zeros(level: number): string {
    let zero = '0x0000000000000000000000000000000000000000000000000000000000000000';
    for (let j = 0; j < level; j++) {
      zero = this.hashFour(zero, zero, zero, zero);
    }
    return zero;
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
        
        const child0 = this.tree[prevLevel][childBaseIndex] || this.zeros(prevLevel);
        const child1 = this.tree[prevLevel][childBaseIndex + 1] || this.zeros(prevLevel);
        const child2 = this.tree[prevLevel][childBaseIndex + 2] || this.zeros(prevLevel);
        const child3 = this.tree[prevLevel][childBaseIndex + 3] || this.zeros(prevLevel);
        
        this.tree[level][nodeIndex] = this.hashFour(child0, child1, child2, child3);
      }
    }
  }

  private hashFour(a: string, b: string, c: string, d: string): string {
    const packed = concat([a as `0x${string}`, b as `0x${string}`, c as `0x${string}`, d as `0x${string}`]);
    return keccak256(packed);
  }

  root(): string {
    return this.tree[this.depth][0] || this.zeros(this.depth);
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
          const sibling = this.tree[level][siblingBaseIndex + i] || this.zeros(level);
          pathElements.push(sibling);
        }
      }
      
      currentIndex = Math.floor(currentIndex / 4);
    }

    return {
      pathElements,
      leafIndex,
      leaf: this.tree[0][leafIndex] || this.zeros(0)
    };
  }

  // Verify proof manually (for testing) - match contract _verifyProof exactly
  verifyProof(leafIndex: number, leaf: string, proof: string[]): boolean {
    let computedHash = leaf;
    let index = leafIndex;
    let proofIndex = 0;

    for (let level = 0; level < this.depth; level++) {
      const childIndex = index % 4;

      if (childIndex === 0) {
        if (proofIndex < proof.length) {
          computedHash = this.hashFour(computedHash, proof[proofIndex], proof[proofIndex + 1], proof[proofIndex + 2]);
          proofIndex += 3;
        } else {
          computedHash = this.hashFour(computedHash, this.zeros(level), this.zeros(level), this.zeros(level));
        }
      } else if (childIndex === 1) {
        if (proofIndex < proof.length) {
          computedHash = this.hashFour(proof[proofIndex], computedHash, proof[proofIndex + 1], proof[proofIndex + 2]);
          proofIndex += 3;
        } else {
          computedHash = this.hashFour(this.zeros(level), computedHash, this.zeros(level), this.zeros(level));
        }
      } else if (childIndex === 2) {
        if (proofIndex < proof.length) {
          computedHash = this.hashFour(proof[proofIndex], proof[proofIndex + 1], computedHash, proof[proofIndex + 2]);
          proofIndex += 3;
        } else {
          computedHash = this.hashFour(this.zeros(level), this.zeros(level), computedHash, this.zeros(level));
        }
      } else {
        if (proofIndex < proof.length) {
          computedHash = this.hashFour(proof[proofIndex], proof[proofIndex + 1], proof[proofIndex + 2], computedHash);
          proofIndex += 3;
        } else {
          computedHash = this.hashFour(this.zeros(level), this.zeros(level), this.zeros(level), computedHash);
        }
      }

      index = Math.floor(index / 4);
    }

    return computedHash === this.root();
  }
}

// Helper function to compute leaf like the contract does
export function computeLeaf(prevRoot: string, l2Address: string, balance: string): string {
  // RLC computation matching contract's _computeLeafPure
  // Use abi.encodePacked (like the contract) instead of abi.encode
  const l2AddressBigInt = BigInt(l2Address);
  const l2AddressBytes32 = pad(toHex(l2AddressBigInt), { size: 32 });
  const packedData = concat([prevRoot as `0x${string}`, l2AddressBytes32]);
  const gamma = keccak256(packedData);
  
  // RLC formula: l2Address + gamma * balance
  const gammaBigInt = BigInt(gamma);
  const balanceBigInt = BigInt(balance);
  
  // Handle potential overflow by using modular arithmetic  
  const maxUint256 = (BigInt(1) << BigInt(256)) - BigInt(1); // 2^256 - 1
  const leafValue = (l2AddressBigInt + (gammaBigInt * balanceBigInt) % (maxUint256 + BigInt(1))) % (maxUint256 + BigInt(1));
  
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
  l2Address: string;
  balance: string;
}

/**
 * Generate withdrawal proof for a user given their claimed balance
 * EXACT copy of the working generateProof.js logic
 */
export async function generateWithdrawalProof(
  channelId: string,
  userAddress: string,
  claimedBalance: string,
  participantsData: ParticipantData[],
  finalStateRoot: string,
  participantRoots: string[]
): Promise<WithdrawalProofData> {
  try {
    console.log('=== WITHDRAWAL PROOF GENERATION (EXACT generateProof.js) ===');
    console.log('Channel ID:', channelId);
    console.log('User L2 Address:', userAddress);
    console.log('Claimed Balance:', claimedBalance);
    console.log('Expected Final State Root:', finalStateRoot);
    console.log('Participant Roots:', participantRoots);
    console.log('Total participants:', participantsData.length);
    
    // Find user's index in participants data (EXACT generateProof.js logic)
    let userLeafIndex = -1;
    let userParticipantRoot = '';
    let userBalance = claimedBalance;
    
    for (let i = 0; i < participantsData.length; i++) {
      const participant = participantsData[i];
      if (participant.l2Address.toLowerCase() === userAddress.toLowerCase()) {
        userLeafIndex = i;
        if (i < participantRoots.length) {
          userParticipantRoot = participantRoots[i];
        }
        console.log(`Found user at index ${i} with balance ${userBalance}`);
        break;
      }
    }
    
    if (userLeafIndex === -1) {
      throw new Error(`User's L2 address ${userAddress} not found in participants data`);
    }
    if (userLeafIndex >= participantRoots.length) {
      throw new Error(`User index ${userLeafIndex} exceeds available participant roots (${participantRoots.length})`);
    }
    if (!userParticipantRoot) {
      throw new Error(`No participant root found for user at index ${userLeafIndex}`);
    }
    
    // The contract verifies that the user's leaf (computed with their participant root) 
    // exists in the final state tree at the correct index
    console.log('Computing user leaf for contract verification...');
    
    // Compute user's leaf exactly like the contract does during withdrawal
    const userLeafValue = computeLeaf(userParticipantRoot, userAddress, claimedBalance);
    console.log(`User's withdrawal leaf: ${userLeafValue} at index ${userLeafIndex}`);
    
    // CRITICAL: The contract already has the finalStateRoot and we need to generate a proof
    // that our computed user leaf exists at userLeafIndex in that final state tree.
    // We don't need to rebuild the tree - we just need a valid proof structure.
    
    // INSIGHT: The finalStateRoot matches the last participantRoot exactly!
    // This means the finalStateRoot IS the final root from the sequential tree building process.
    // We need to manually create a proof that verifies the user's leaf against this root.
    
    console.log('CRITICAL INSIGHT: finalStateRoot equals last participant root');
    console.log('This means finalStateRoot is the result of the sequential insertion process');
    
    // The contract verification logic expects:
    // 1. User's leaf computed with their participant root: ✓ (we have this)
    // 2. A proof that this leaf exists at userLeafIndex in the finalStateRoot tree
    
    // Try different approach: Use the known working structure from the contract tests
    // The key insight is that the final state tree should contain leaves computed
    // in the SAME order as they were inserted during initialization
    
    const tree = new SimpleQuaternaryTree(3);
    const leaves: string[] = [];
    
    console.log('Recreating the original tree that produced finalStateRoot...');
    
    // The leaves should be computed using each participant's ORIGINAL data (not claimed balance)
    // because the finalStateRoot was computed during initialization, not during withdrawal
    for (let i = 0; i < participantsData.length; i++) {
      const participant = participantsData[i];
      const participantRoot = participantRoots[i];
      // Use ORIGINAL balance for tree reconstruction (this is what was used during initialization)
      const originalBalance = participant.balance;
      
      const leaf = computeLeaf(participantRoot, participant.l2Address, originalBalance);
      leaves.push(leaf);
      
      console.log(`Original leaf ${i}: root=${participantRoot}, balance=${originalBalance}, leaf=${leaf}`);
    }
    
    tree.insertAll(leaves);
    const reconstructedRoot = tree.root();
    
    console.log(`Reconstructed tree root: ${reconstructedRoot}`);
    console.log(`Expected finalStateRoot: ${finalStateRoot}`);
    console.log(`Roots match: ${reconstructedRoot === finalStateRoot ? 'YES' : 'NO'}`);
    
    if (reconstructedRoot === finalStateRoot) {
      console.log('✓ Successfully reconstructed the original tree!');
      
      // Generate proof for the user's leaf using the reconstructed tree
      const proofData = tree.proof(userLeafIndex);
      console.log(`Generated proof with ${proofData.pathElements.length} elements for index ${userLeafIndex}`);
      
      // The user's leaf for withdrawal uses their CLAIMED balance, not original balance
      const withdrawalLeaf = computeLeaf(userParticipantRoot, userAddress, claimedBalance);
      
      // Verify the proof with the withdrawal leaf
      const isValid = tree.verifyProof(userLeafIndex, withdrawalLeaf, proofData.pathElements);
      console.log(`✓ Withdrawal proof verification: ${isValid ? 'PASSED' : 'FAILED'}`);
      
      return {
        channelId,
        claimedBalance,
        leafIndex: userLeafIndex,
        merkleProof: proofData.pathElements,
        leafValue: withdrawalLeaf,
        userL2Address: userAddress,
        computedTreeRoot: reconstructedRoot,
        isValid
      };
    } else {
      // If we can't reconstruct, generate the proof anyway with our best guess
      console.log('⚠️ Could not reconstruct original tree, using best guess approach...');
      
      const proofData = tree.proof(userLeafIndex);
      
      return {
        channelId,
        claimedBalance,
        leafIndex: userLeafIndex,
        merkleProof: proofData.pathElements,
        leafValue: userLeafValue,
        userL2Address: userAddress,
        computedTreeRoot: reconstructedRoot,
        isValid: false
      };
    }

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
    const l2AddressBigInt = BigInt(l2Address);
    const l2AddressBytes32 = pad(toHex(l2AddressBigInt), { size: 32 });
    const packedData = concat([prevRoot as `0x${string}`, l2AddressBytes32]);
    const gamma = keccak256(packedData);

    // RLC formula: l2Address + gamma * balance
    const gammaBigInt = BigInt(gamma);
    const balanceBigInt = BigInt(balance);
    
    // Match Solidity's unchecked overflow behavior - wrap at 2^256 exactly like uint256
    const maxUint256Plus1 = BigInt(1) << BigInt(256); // 2^256
    const leafValue = (l2AddressBigInt + gammaBigInt * balanceBigInt) % maxUint256Plus1;
    
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

    console.log(`Inserting leaf ${leafIndex}: ${leafHash}`);

    for (let level = 0; level < this.depth; level++) {
      console.log(`Level ${level}: currentIndex=${currentIndex}, currentIndex%4=${currentIndex % 4}`);
      
      if (currentIndex % 4 === 0) {
        // This is a leftmost node, cache it and break (matching contract exactly)
        this.cachedSubtrees[level] = currentHash;
        console.log(`  Caching leftmost node at level ${level}: ${currentHash}`);
        break;
      } else {
        // Compute parent hash using 4 children (matching contract exactly)
        const left = this.cachedSubtrees[level] || '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child2 = currentIndex % 4 >= 2 ? currentHash : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child3 = currentIndex % 4 === 3 ? currentHash : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child4 = '0x0000000000000000000000000000000000000000000000000000000000000000';

        console.log(`  Computing parent: left=${left}, child2=${child2}, child3=${child3}, child4=${child4}`);
        currentHash = this.hashFour(left, child2, child3, child4);
        console.log(`  New hash: ${currentHash}`);
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
    
    console.log(`New root ${newRootIndex}: ${currentHash}`);
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
  participantRoots: string[];
} {
  // Simulate contract storage exactly
  const TREE_DEPTH = 3;
  const cachedSubtrees: string[] = new Array(TREE_DEPTH).fill('0x0000000000000000000000000000000000000000000000000000000000000000');
  const channelRootSequence: string[] = [];
  const participantLeaves: string[] = [];
  const participantRoots: string[] = [];
  let nextLeafIndex = 0;
  let currentRootIndex = 0;
  let nonce = 0;

  console.log('=== COMPUTING FINAL STATE ROOT (Contract Logic) ===');
  console.log('Channel ID:', channelId);
  console.log('Participants:', participants.length);

  // Helper function matching contract's _computeLeaf exactly
  function computeLeafFromContract(channelId: number, l2Address: string, balance: string, nonce: number): string {
    // Get previous root: if nonce == 0, use channelId, else use last root in sequence
    let prevRoot: string;
    if (nonce === 0) {
      prevRoot = pad(toHex(BigInt(channelId)), { size: 32 }); // bytes32(channelId)
    } else {
      if (channelRootSequence.length === 0 || nonce > channelRootSequence.length) {
        throw new Error("Invalid root sequence access");
      }
      prevRoot = channelRootSequence[nonce - 1];
    }

    // Compute gamma = keccak256(abi.encodePacked(prevRoot, bytes32(l2Address)))
    // Convert l2Address to BigInt first, then to padded bytes32
    const l2AddressBigInt = BigInt(l2Address);
    const l2AddressBytes32 = pad(toHex(l2AddressBigInt), { size: 32 });
    const packedData = concat([prevRoot as `0x${string}`, l2AddressBytes32]);
    const gamma = keccak256(packedData);

    // RLC formula: l2Address + gamma * balance (with overflow wrapping)
    const gammaBigInt = BigInt(gamma);
    const balanceBigInt = BigInt(balance);
    
    // Match Solidity's unchecked overflow behavior - wrap at 2^256 exactly like uint256
    const maxUint256Plus1 = BigInt(1) << BigInt(256); // 2^256
    const leafValue = (l2AddressBigInt + gammaBigInt * balanceBigInt) % maxUint256Plus1;
    
    return pad(toHex(leafValue), { size: 32 });
  }

  // Helper function matching contract's _insertLeaf exactly
  function insertLeafFromContract(leafHash: string): void {
    const leafIndex = nextLeafIndex;

    // Check if tree is full
    if (leafIndex >= 4 ** TREE_DEPTH) {
      throw new Error("MerkleTreeFull");
    }

    console.log(`Inserting leaf ${leafIndex}: ${leafHash}`);

    // Update the cached subtrees and compute new root (matching contract exactly)
    let currentHash = leafHash;
    let currentIndex = leafIndex;

    for (let level = 0; level < TREE_DEPTH; level++) {
      console.log(`Level ${level}: currentIndex=${currentIndex}, currentIndex%4=${currentIndex % 4}`);
      
      if (currentIndex % 4 === 0) {
        // This is a leftmost node, cache it and break
        cachedSubtrees[level] = currentHash;
        console.log(`  Caching leftmost node at level ${level}: ${currentHash}`);
        break;
      } else {
        // Compute parent hash using 4 children
        const left = cachedSubtrees[level] || '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child2 = currentIndex % 4 >= 2 ? currentHash : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child3 = currentIndex % 4 === 3 ? currentHash : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child4 = '0x0000000000000000000000000000000000000000000000000000000000000000';

        console.log(`  Computing parent: left=${left}, child2=${child2}, child3=${child3}, child4=${child4}`);
        const packed = concat([left as `0x${string}`, child2 as `0x${string}`, child3 as `0x${string}`, child4 as `0x${string}`]);
        currentHash = keccak256(packed);
        console.log(`  New hash: ${currentHash}`);
        currentIndex = Math.floor(currentIndex / 4);
      }
    }

    // Update tree state
    nextLeafIndex = leafIndex + 1;

    // Store new root (like contract stores in roots[channelId][newRootIndex])
    currentRootIndex++;
    channelRootSequence.push(currentHash);
    
    console.log(`New root ${currentRootIndex}: ${currentHash}`);
  }

  // Process each participant exactly like contract's initializeChannelState
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    const { l2Address, balance } = participant;

    console.log(`Processing participant ${i} (nonce ${nonce}):`);
    console.log(`  L2 Address: ${l2Address}`);
    console.log(`  Balance: ${balance}`);

    // Compute leaf exactly like contract _computeLeaf
    const leaf = computeLeafFromContract(channelId, l2Address, balance, nonce);
    participantLeaves.push(leaf);

    console.log(`  Computed leaf: ${leaf}`);

    // Insert leaf exactly like contract _insertLeaf  
    insertLeafFromContract(leaf);

    // Store the current root as this participant's root (what gets stored in participantRoots)
    const currentParticipantRoot = channelRootSequence[channelRootSequence.length - 1];
    participantRoots.push(currentParticipantRoot);

    console.log(`  Participant ${i} root: ${currentParticipantRoot}`);

    // DON'T increment nonce here - all participants use the same nonce (0) during initialization
    // nonce++;
  }

  // After processing all participants, increment nonce (matching contract line 437)
  nonce++;

  // Get final root (matching contract: channel.initialStateRoot = $.roots[channelId][$.currentRootIndex[channelId]])
  const finalStateRoot = channelRootSequence[channelRootSequence.length - 1] || pad('0x0', { size: 32 });

  const finalResult = {
    finalStateRoot,
    channelRootSequence,
    participantLeaves,
    participantRoots
  };

  console.log('=== FINAL STATE ROOT COMPUTATION COMPLETE ===');
  console.log('Final state root:', finalResult.finalStateRoot);
  console.log('Channel root sequence:', finalResult.channelRootSequence);
  console.log('Participant leaves:', finalResult.participantLeaves);
  console.log('Participant roots:', finalResult.participantRoots);

  return finalResult;
}

export function computeFinalStateRootWithParticipantRoots(
  _channelId: number, 
  participants: Array<{ l2Address: string; balance: string; participantRoot: string }>
): {
  finalStateRoot: string;
  participantLeaves: string[];
} {
  // For final state computation, we use individual participant roots to compute leaves
  // then build a simple quaternary tree with those leaves
  const tree = new SimpleQuaternaryTree(3);
  const participantLeaves: string[] = [];

  for (const participant of participants) {
    const { l2Address, balance, participantRoot } = participant;
    
    // Compute leaf using the participant's specific root (like withdrawal verification)
    const leaf = computeLeaf(participantRoot, l2Address, balance);
    participantLeaves.push(leaf);
  }

  // Build the final tree with all participant leaves
  tree.insertAll(participantLeaves);

  return {
    finalStateRoot: tree.root(),
    participantLeaves
  };
}

