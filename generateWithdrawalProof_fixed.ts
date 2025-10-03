/**
 * Generate withdrawal proof for a user given their claimed balance
 * This uses the participant roots that were set during submitAggregatedProof
 * MATCHES the working generateProof.js exactly
 */

import { ParticipantData, WithdrawalProofData, SimpleQuaternaryTree, computeLeaf } from './lib/merkleProofGenerator';
export async function generateWithdrawalProof(
  channelId: string,
  userAddress: string,
  claimedBalance: string,
  participantsData: ParticipantData[],
  finalStateRoot: string,
  participantRoots: string[]
): Promise<WithdrawalProofData> {
  try {
    console.log('=== WITHDRAWAL PROOF GENERATION (MATCHING generateProof.js) ===');
    console.log('Channel ID:', channelId);
    console.log('User L2 Address:', userAddress);
    console.log('Claimed Balance:', claimedBalance);
    console.log('Expected Final State Root:', finalStateRoot);
    console.log('Participant Roots:', participantRoots);
    console.log('Total participants:', participantsData.length);
    
    // Find user's index in participants data
    let userLeafIndex = -1;
    let userParticipantRoot = '';
    
    for (let i = 0; i < participantsData.length; i++) {
      const participant = participantsData[i];
      if (participant.l2Address.toLowerCase() === userAddress.toLowerCase()) {
        userLeafIndex = i;
        if (i < participantRoots.length) {
          userParticipantRoot = participantRoots[i];
        }
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
    
    console.log(`Found user at index ${userLeafIndex} with balance ${claimedBalance}`);
    
    // Build the final state tree with individual participant roots (EXACT generateProof.js approach)
    console.log('Step 1: Building tree with individual participant roots...');
    
    const tree = new SimpleQuaternaryTree(3);
    const leaves: string[] = [];
    
    // Process each participant exactly like generateProof.js
    for (let i = 0; i < participantsData.length; i++) {
      const participant = participantsData[i];
      const participantRoot = participantRoots[i];
      const balance = i === userLeafIndex ? claimedBalance : participant.balance;
      
      // Compute leaf using participant root (EXACT generateProof.js method)
      const leaf = computeLeaf(participantRoot, participant.l2Address, balance);
      leaves.push(leaf);
      
      console.log(`Participant ${i}:`);
      console.log(`  Participant Root: ${participantRoot}`);
      console.log(`  L2 Address: ${participant.l2Address}`);
      console.log(`  Balance: ${balance}`);
      console.log(`  Computed Leaf: ${leaf}`);
    }
    
    tree.insertAll(leaves);
    const computedTreeRoot = tree.root();
    
    console.log('Computed tree root:', computedTreeRoot);
    console.log('Expected finalStateRoot:', finalStateRoot);
    console.log('Tree root matches finalStateRoot:', computedTreeRoot === finalStateRoot ? 'YES' : 'NO');
    
    if (computedTreeRoot.toLowerCase() !== finalStateRoot.toLowerCase()) {
      throw new Error(`Tree root mismatch! Computed: ${computedTreeRoot}, Expected: ${finalStateRoot}`);
    }
    
    // Compute user's leaf exactly like the contract does during withdrawal  
    const userLeafValue = computeLeaf(userParticipantRoot, userAddress, claimedBalance);
    console.log(`User's withdrawal leaf: ${userLeafValue} at index ${userLeafIndex}`);
    
    // Generate merkle proof for the user's specific leaf
    console.log(`Generating proof for user's leaf at index: ${userLeafIndex}`);
    const proofData = tree.proof(userLeafIndex);
    console.log(`Merkle proof has ${proofData.pathElements.length} elements`);
    
    // Verify our proof locally
    const isValid = tree.verifyProof(userLeafIndex, userLeafValue, proofData.pathElements);
    console.log(`Proof verification: ${isValid ? 'PASSED' : 'FAILED'}`);
    
    if (!isValid) {
      throw new Error('Generated proof failed local verification');
    }
    
    // Return proof data matching generateProof.js structure
    return {
      channelId,
      claimedBalance,
      leafIndex: userLeafIndex,
      merkleProof: proofData.pathElements,
      leafValue: userLeafValue,
      userL2Address: userAddress,
      computedTreeRoot,
      isValid: true
    };

  } catch (error) {
    throw new Error(`Proof generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}