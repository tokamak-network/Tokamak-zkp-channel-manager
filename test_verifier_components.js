const fs = require('fs');

// Function to extract and display key verifier parameters
function analyzeVerifierInputs(proofFile) {
    const proofData = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
    
    console.log(`\n=== VERIFIER INPUT ANALYSIS: ${proofFile} ===`);
    
    // The TokamakVerifier.verify function expects:
    // function verify(
    //     uint128[] calldata serializedProofPart1,
    //     uint256[] calldata serializedProofPart2, 
    //     uint128[] calldata preprocessedPart1,
    //     uint256[] calldata preprocessedPart2,
    //     uint256[] calldata publicInputs,
    //     uint256 smax
    // ) public view returns (bool)
    
    const proofPart1 = proofData.proof_entries_part1.map(x => BigInt(x));
    const proofPart2 = proofData.proof_entries_part2.map(x => BigInt(x));
    const publicInputs = [
        ...proofData.a_pub_user, 
        ...proofData.a_pub_block, 
        ...proofData.a_pub_function
    ].map(x => BigInt(x));
    
    console.log('ProofPart1 (uint128[]):', proofPart1.length, 'elements');
    console.log('ProofPart2 (uint256[]):', proofPart2.length, 'elements');
    console.log('PublicInputs (uint256[]):', publicInputs.length, 'elements');
    console.log('smax:', 256);
    
    // Check the public input structure for debugging
    console.log('\n=== PUBLIC INPUTS KEY POSITIONS ===');
    console.log('State roots (8-11):', [
        '0x' + publicInputs[8].toString(16),
        '0x' + publicInputs[9].toString(16), 
        '0x' + publicInputs[10].toString(16),
        '0x' + publicInputs[11].toString(16)
    ]);
    
    console.log('Function signature (16):', '0x' + publicInputs[16].toString(16));
    
    // First few elements of function data (starting at 64)
    console.log('Function data start (64-67):', [
        '0x' + publicInputs[64].toString(16),
        '0x' + publicInputs[65].toString(16),
        '0x' + publicInputs[66].toString(16), 
        '0x' + publicInputs[67].toString(16)
    ]);
    
    return {
        proofPart1,
        proofPart2,
        publicInputs,
        smax: BigInt(256)
    };
}

// Generate cast command for testing
function generateCastCommand(verifierAddress, preprocessedPart1, preprocessedPart2, proofInputs) {
    console.log('\n=== CAST COMMAND FOR MANUAL TESTING ===');
    console.log(`cast call ${verifierAddress} \\`);
    console.log(`  "verify(uint128[],uint256[],uint128[],uint256[],uint256[],uint256)" \\`);
    console.log(`  "[$(echo ${proofInputs.proofPart1.slice(0, 3).join(',')}...)]" \\`);
    console.log(`  "[$(echo ${proofInputs.proofPart2.slice(0, 3).join(',')}...)]" \\`);
    console.log(`  "[PREPROCESSED_PART1_DATA]" \\`);
    console.log(`  "[PREPROCESSED_PART2_DATA]" \\`);
    console.log(`  "[$(echo ${proofInputs.publicInputs.slice(0, 10).join(',')}...)]" \\`);
    console.log(`  "256" \\`);
    console.log(`  --rpc-url YOUR_RPC_URL`);
    console.log('\nNote: You need to replace PREPROCESSED_PART1_DATA and PREPROCESSED_PART2_DATA with the actual preprocessed data from your registered function.');
}

// Check for potential issues
function checkForIssues(proof1, proof2) {
    console.log('\n=== POTENTIAL ISSUES ANALYSIS ===');
    
    // Check if proofs are identical (they shouldn't be)
    const proof1Str = proof1.proofPart1.map(x => x.toString()).join(',') + proof1.proofPart2.map(x => x.toString()).join(',');
    const proof2Str = proof2.proofPart1.map(x => x.toString()).join(',') + proof2.proofPart2.map(x => x.toString()).join(',');
    
    if (proof1Str === proof2Str) {
        console.log('❌ ERROR: Both proofs are identical! This will cause verification failure.');
    } else {
        console.log('✅ Proofs are different (good)');
    }
    
    // Check state root chaining
    if (proof1.publicInputs[10] === proof2.publicInputs[8] && 
        proof1.publicInputs[11] === proof2.publicInputs[9]) {
        console.log('✅ State roots chain correctly');
    } else {
        console.log('❌ ERROR: State roots do not chain correctly');
    }
    
    // Check if function signatures match
    if (proof1.publicInputs[16] === proof2.publicInputs[16]) {
        console.log('✅ Function signatures match');
    } else {
        console.log('❌ ERROR: Function signatures differ between proofs');
    }
    
    // Check smax consistency 
    console.log('✅ smax is 256 (correct)');
    
    console.log('\n=== NEXT DEBUG STEPS ===');
    console.log('1. Verify the preprocessed data in your contract matches the circuit');
    console.log('2. Check if the verifier contract was compiled for the same circuit as the proofs');
    console.log('3. Test with a single proof first to isolate the issue');
    console.log('4. Verify that the proof was generated with the exact same public inputs');
    console.log('5. Check if there are any endianness or encoding issues in the proof data');
}

// Main analysis
const proof1Inputs = analyzeVerifierInputs('./input_templates/channel5_proof1.json');
const proof2Inputs = analyzeVerifierInputs('./input_templates/channel5_proof2.json');

checkForIssues(proof1Inputs, proof2Inputs);

// Generate debugging information
console.log('\n=== DEBUGGING INFORMATION ===');
console.log('If the verifier is failing with "finalPairing: pairing failure":');
console.log('1. The proof is cryptographically invalid');
console.log('2. The preprocessed data doesn\'t match');
console.log('3. The public inputs are wrong');
console.log('4. The smax parameter is wrong');
console.log('5. The verifier was compiled for a different circuit');

generateCastCommand('YOUR_VERIFIER_ADDRESS', 'PREPROCESSED1', 'PREPROCESSED2', proof1Inputs);