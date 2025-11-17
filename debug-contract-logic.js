// Direct simulation of contract's initializeChannelState logic

async function debugContractLogic() {
  console.log('=== DEBUGGING CONTRACT PUBLIC SIGNALS COMPUTATION ===\n');

  // Channel data from your logs
  const channelId = 0;
  const merkleRoot = '8717996803693071601560617594908257064884645203109477683134260534252752083859';
  
  const participants = [
    '0x15759359e60a3b9e59eA7A96D10Fa48829f83bEb',
    '0x3ec2c9fb15C222Aa273F3f2F20a740FA86b4F618', 
    '0x83Bac556128913f07a39c54332A03FEab289d815'
  ];
  
  const allowedTokens = [
    '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd',
    '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A'
  ];

  // Contract state data
  const contractState = {
    '0x15759359e60a3b9e59eA7A96D10Fa48829f83bEb': {
      '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd': {
        balance: '2000000000000000000000000000',
        l2MptKey: '6218676549690402052910318315276979534381485872621884367715834658603456243904'
      },
      '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A': {
        balance: '1000000', 
        l2MptKey: '110580260996340110094785440981620907308337756065855730273934386618448660286152'
      }
    },
    '0x3ec2c9fb15C222Aa273F3f2F20a740FA86b4F618': {
      '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd': { balance: '0', l2MptKey: '0' },
      '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A': { balance: '0', l2MptKey: '0' }
    },
    '0x83Bac556128913f07a39c54332A03FEab289d815': {
      '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd': { balance: '0', l2MptKey: '0' },
      '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A': { balance: '0', l2MptKey: '0' }
    }
  };

  console.log('Channel ID:', channelId);
  console.log('Merkle Root:', merkleRoot);
  console.log('Participants:', participants);
  console.log('Allowed Tokens:', allowedTokens);
  console.log();

  const participantsLength = participants.length;
  const tokensLength = allowedTokens.length;
  const totalEntries = participantsLength * tokensLength;

  console.log('Participants Length:', participantsLength);
  console.log('Tokens Length:', tokensLength);
  console.log('Total Entries:', totalEntries);
  console.log();

  // Build public signals array exactly as contract does
  const publicSignals = new Array(33).fill('0');

  // First element is the merkle root
  publicSignals[0] = merkleRoot;
  console.log(`✓ publicSignals[0] = ${merkleRoot} (merkle root)`);
  console.log();

  // Fill merkle keys (L2 MPT keys) and storage values (balances)
  // Each participant has entries for each token type
  let entryIndex = 0;
  
  console.log('--- CONTRACT NESTED LOOP SIMULATION ---');
  for (let i = 0; i < participantsLength; i++) {
    const participant = participants[i];
    console.log(`\nParticipant ${i}: ${participant}`);

    for (let j = 0; j < tokensLength; j++) {
      const token = allowedTokens[j];
      
      const participantData = contractState[participant]?.[token] || { balance: '0', l2MptKey: '0' };
      const balance = participantData.balance;
      const l2MptKey = participantData.l2MptKey;

      console.log(`  Token ${j}: ${token}`);
      console.log(`  Entry Index: ${entryIndex}`);
      console.log(`  Balance: ${balance}`);
      console.log(`  L2 MPT Key: ${l2MptKey}`);

      // Contract logic: Add to public signals:
      // - indices 1-16 are merkle_keys (L2 MPT keys)
      // - indices 17-32 are storage_values (balances)
      const l2MptIndex = entryIndex + 1;
      const balanceIndex = entryIndex + 17;
      
      publicSignals[l2MptIndex] = l2MptKey;
      publicSignals[balanceIndex] = balance;

      console.log(`  ✓ publicSignals[${l2MptIndex}] = ${l2MptKey} (L2 MPT key)`);
      console.log(`  ✓ publicSignals[${balanceIndex}] = ${balance} (balance)`);

      entryIndex++;
    }
  }

  // Pad remaining slots with zeros (circuit expects exactly 16 entries)
  console.log(`\n--- PADDING REMAINING SLOTS ---`);
  for (let i = totalEntries; i < 16; i++) {
    const l2MptIndex = i + 1;
    const balanceIndex = i + 17;
    
    publicSignals[l2MptIndex] = '0'; // merkle key
    publicSignals[balanceIndex] = '0'; // storage value
    
    console.log(`Padding entry ${i}:`);
    console.log(`  ✓ publicSignals[${l2MptIndex}] = 0 (L2 MPT key)`);
    console.log(`  ✓ publicSignals[${balanceIndex}] = 0 (balance)`);
  }

  console.log('\n=== FINAL CONTRACT PUBLIC SIGNALS ARRAY ===');
  for (let i = 0; i < 33; i++) {
    console.log(`publicSignals[${i.toString().padStart(2)}] = ${publicSignals[i]}`);
  }

  // Compare with what we expect from circuit
  console.log('\n=== COMPARISON WITH CIRCUIT OUTPUT ===');
  const circuitOutputExample = [
    '8717996803693071601560617594908257064884645203109477683134260534252752083859',
    '6218676549690402052910318315276979534381485872621884367715834658603456243904',
    '5708510646087729135889959965248975632956651064800454628727069218571497917126', // ❌ This should be 110580260996340110094785440981620907308337756065855730273934386618448660286152
    '0',
    '0'
  ];

  console.log('\nContract expects at index 2:', publicSignals[2]);
  console.log('Circuit generates at index 2:', circuitOutputExample[2]);
  console.log('Match:', publicSignals[2] === circuitOutputExample[2] ? '✅' : '❌');
}

debugContractLogic().catch(console.error);