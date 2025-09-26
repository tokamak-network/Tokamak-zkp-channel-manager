// Simple Contract Match Test - Node.js Version
const { keccak256: keccak256Hash } = require('ethereum-cryptography/keccak');

function keccak256(data) {
  if (typeof data === 'string') {
    // Remove 0x prefix and convert hex to buffer
    const hex = data.startsWith('0x') ? data.slice(2) : data;
    data = Buffer.from(hex, 'hex');
  } else if (Array.isArray(data)) {
    // Handle concat result - combine all buffers
    const buffers = data.map(d => {
      const hex = d.startsWith('0x') ? d.slice(2) : d;
      return Buffer.from(hex, 'hex');
    });
    data = Buffer.concat(buffers);
  }
  const hashResult = keccak256Hash(data);
  return '0x' + Buffer.from(hashResult).toString('hex');
}

function toHex(value) {
  if (typeof value === 'bigint') {
    return '0x' + value.toString(16);
  }
  return '0x' + value.toString(16);
}

function pad(hex, options) {
  const size = options.size;
  const hexWithout0x = hex.slice(2);
  const padded = hexWithout0x.padStart(size * 2, '0');
  return '0x' + padded;
}

function concat(arrays) {
  return arrays;
}

// Implement the computeFinalStateRoot function directly
function computeFinalStateRoot(channelId, participants) {
  const TREE_DEPTH = 3;
  const cachedSubtrees = new Array(TREE_DEPTH).fill('0x0000000000000000000000000000000000000000000000000000000000000000');
  const channelRootSequence = [];
  const participantLeaves = [];
  const participantRoots = [];
  let nextLeafIndex = 0;
  let currentRootIndex = 0;
  let nonce = 0;

  console.log('=== COMPUTING FINAL STATE ROOT (Contract Logic) ===');
  console.log('Channel ID:', channelId);
  console.log('Participants:', participants.length);

  // Helper function matching contract's _computeLeaf exactly
  function computeLeafFromContract(channelId, l2Address, balance, nonce) {
    // Get previous root: if nonce == 0, use channelId, else use last root in sequence
    let prevRoot;
    if (nonce === 0) {
      prevRoot = pad(toHex(BigInt(channelId)), { size: 32 }); // bytes32(channelId)
    } else {
      if (channelRootSequence.length === 0 || nonce > channelRootSequence.length) {
        throw new Error("Invalid root sequence access");
      }
      prevRoot = channelRootSequence[nonce - 1];
    }

    // Compute gamma = keccak256(abi.encodePacked(prevRoot, bytes32(l2Address)))
    const l2AddressBigInt = BigInt(l2Address);
    const l2AddressBytes32 = pad(toHex(l2AddressBigInt), { size: 32 });
    const packedData = concat([prevRoot, l2AddressBytes32]);
    const gamma = keccak256(packedData);

    // RLC formula: l2Address + gamma * balance (with unchecked overflow wrapping like Solidity)
    const gammaBigInt = BigInt(gamma);
    const balanceBigInt = BigInt(balance);
    
    // Match Solidity's unchecked overflow behavior - wrap at 2^256 exactly like uint256
    const maxUint256Plus1 = BigInt(1) << BigInt(256); // 2^256
    const leafValue = (l2AddressBigInt + gammaBigInt * balanceBigInt) % maxUint256Plus1;
    
    return pad(toHex(leafValue), { size: 32 });
  }

  // Helper function matching contract's _insertLeaf exactly
  function insertLeafFromContract(leafHash) {
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
        // Compute parent hash using 4 children (exact contract logic)
        const left = cachedSubtrees[level] || '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child2 = currentIndex % 4 >= 2 ? currentHash : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child3 = currentIndex % 4 === 3 ? currentHash : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const child4 = '0x0000000000000000000000000000000000000000000000000000000000000000';

        console.log(`  Computing parent: left=${left}, child2=${child2}, child3=${child3}, child4=${child4} (currentIndex%4=${currentIndex % 4})`);
        const packed = concat([left, child2, child3, child4]);
        currentHash = keccak256(packed);
        console.log(`  New hash: ${currentHash}`);
        currentIndex = Math.floor(currentIndex / 4);
      }
    }

    // Update tree state
    nextLeafIndex = leafIndex + 1;

    // Store new root
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

    // Store the current root as this participant's root
    const currentParticipantRoot = channelRootSequence[channelRootSequence.length - 1];
    participantRoots.push(currentParticipantRoot);

    console.log(`  Participant ${i} root: ${currentParticipantRoot}`);

    // DON'T increment nonce here - all participants use the same nonce (0)!
    // nonce++;
  }

  // Get final root
  const finalStateRoot = channelRootSequence[channelRootSequence.length - 1] || pad('0x0', { size: 32 });

  return {
    finalStateRoot,
    channelRootSequence,
    participantLeaves,
    participantRoots
  };
}

// Test execution
console.log('=== Simple Contract Match Test ===');

// Expected results from contract testSubmitAggregatedProof:
const expectedFinalStateRoot = '0x38f094f35dd432a0b418251c94cf83a00eb4d86715d59d59ab65dbd8d647de7a';
const expectedParticipantRoots = [
  '0x5d5845b208ba430ad700f044c96b90b513d4db9794aa348db7acad5b84bc4527',
  '0x9b5ec3eb35efe6858a5145f5a0607e00ff3603ff3b4c15ccb16c2f456436ed71',
  '0xca60d27d8fb1a58de4106f16e535a1bd054c8d532e90a330f0adcc1015b8afc2'
];

// Test parameters (matching contract)
const channelId = 0;
const participants = [
  { l2Address: '13', balance: '1000000000000000000' }, // 1 ETH
  { l2Address: '14', balance: '2000000000000000000' }, // 2 ETH  
  { l2Address: '15', balance: '3000000000000000000' }  // 3 ETH
];

console.log('Test parameters:', { channelId, participants });
console.log('Expected final state root:', expectedFinalStateRoot);
console.log('Expected participant roots:', expectedParticipantRoots);

try {
  console.log('\n=== Testing JavaScript vs Contract Results ===');
  
  // Debug single leaf computation first
  console.log('\n=== DEBUGGING SINGLE LEAF ===');
  const debugChannelId = 0;
  const debugL2Address = '13';
  const debugBalance = '1000000000000000000';
  const debugNonce = 0;
  
  // Manual step-by-step computation
  const prevRoot = pad(toHex(BigInt(debugChannelId)), { size: 32 });
  const l2AddressBigInt = BigInt(debugL2Address);
  const l2AddressBytes32 = pad(toHex(l2AddressBigInt), { size: 32 });
  const packedData = concat([prevRoot, l2AddressBytes32]);
  const gamma = keccak256(packedData);
  
  console.log('prevRoot:', prevRoot);
  console.log('l2AddressBytes32:', l2AddressBytes32); 
  console.log('packedData:', packedData);
  console.log('gamma:', gamma);
  
  const gammaBigInt = BigInt(gamma);
  const balanceBigInt = BigInt(debugBalance);
  const maxUint256Plus1 = BigInt(1) << BigInt(256); // 2^256
  const leafValue = (l2AddressBigInt + gammaBigInt * balanceBigInt) % maxUint256Plus1;
  const computedLeaf = pad(toHex(leafValue), { size: 32 });
  
  console.log('l2AddressBigInt:', l2AddressBigInt.toString());
  console.log('gammaBigInt:', gammaBigInt.toString());
  console.log('balanceBigInt:', balanceBigInt.toString());
  console.log('leafValue:', leafValue.toString());
  console.log('computedLeaf:', computedLeaf);
  
  // Run the test
  const result = computeFinalStateRoot(channelId, participants);
  
  console.log('\n=== RESULTS ===');
  console.log('JavaScript Final State Root:', result.finalStateRoot);
  console.log('Contract Final State Root:  ', expectedFinalStateRoot);
  console.log('Final Root Match:', result.finalStateRoot.toLowerCase() === expectedFinalStateRoot.toLowerCase());
  
  console.log('\nJavaScript Participant Roots:', result.participantRoots);
  console.log('Contract Participant Roots:', expectedParticipantRoots);
  
  // Check each participant root
  let allParticipantRootsMatch = true;
  for (let i = 0; i < expectedParticipantRoots.length; i++) {
    const jsRoot = result.participantRoots[i];
    const contractRoot = expectedParticipantRoots[i];
    const matches = jsRoot && jsRoot.toLowerCase() === contractRoot.toLowerCase();
    console.log(`Participant ${i} Root Match: ${matches} (JS: ${jsRoot}, Contract: ${contractRoot})`);
    if (!matches) allParticipantRootsMatch = false;
  }
  
  console.log('\n=== SUMMARY ===');
  console.log('✅ Final State Root Match:', result.finalStateRoot.toLowerCase() === expectedFinalStateRoot.toLowerCase());
  console.log('✅ All Participant Roots Match:', allParticipantRootsMatch);
  console.log('✅ Overall Test Result:', 
    result.finalStateRoot.toLowerCase() === expectedFinalStateRoot.toLowerCase() && allParticipantRootsMatch ? 
    'PASS - JavaScript matches contract!' : 
    'FAIL - Implementation mismatch'
  );

} catch (error) {
  console.error('Test failed with error:', error);
}