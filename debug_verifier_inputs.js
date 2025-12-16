const fs = require('fs');

// Function to analyze proof data for verifier
function analyzeProofData(proofFile) {
    const proofData = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
    
    console.log('=== PROOF DATA ANALYSIS ===');
    console.log('File:', proofFile);
    
    // Check proof_entries_part1 (should be uint128 values)
    console.log('\n=== PROOF_ENTRIES_PART1 (proofPart1) ===');
    console.log('Length:', proofData.proof_entries_part1.length);
    console.log('First 5 elements:', proofData.proof_entries_part1.slice(0, 5));
    
    // Convert to BigInt and check if they fit in uint128
    const part1AsBigInt = proofData.proof_entries_part1.map(x => BigInt(x));
    const uint128Max = BigInt('0xffffffffffffffffffffffffffffffff'); // 2^128 - 1
    
    let part1Overflow = 0;
    part1AsBigInt.forEach((val, i) => {
        if (val > uint128Max) {
            console.log(`WARNING: proof_entries_part1[${i}] = ${val.toString()} > uint128 max`);
            part1Overflow++;
        }
    });
    console.log('Elements exceeding uint128:', part1Overflow);
    
    // Check proof_entries_part2 (should be uint256 values)
    console.log('\n=== PROOF_ENTRIES_PART2 (proofPart2) ===');
    console.log('Length:', proofData.proof_entries_part2.length);
    console.log('First 5 elements:', proofData.proof_entries_part2.slice(0, 5));
    
    // Check public inputs
    console.log('\n=== PUBLIC INPUTS STRUCTURE ===');
    const publicInputs = [...proofData.a_pub_user, ...proofData.a_pub_block, ...proofData.a_pub_function];
    console.log('Total length:', publicInputs.length);
    
    // Check for any non-hex or invalid values
    let invalidElements = 0;
    publicInputs.forEach((val, i) => {
        if (typeof val !== 'string' || !val.startsWith('0x')) {
            console.log(`WARNING: publicInputs[${i}] is not a valid hex string: ${val}`);
            invalidElements++;
        }
    });
    console.log('Invalid elements in public inputs:', invalidElements);
    
    // Check smax (should be 256)
    console.log('\n=== SMAX ===');
    console.log('smax used in UI:', 256);
    console.log('Note: smax should match the circuit size used to generate the proof');
    
    return {
        proofPart1: proofData.proof_entries_part1,
        proofPart2: proofData.proof_entries_part2,
        publicInputs: publicInputs,
        smax: 256
    };
}

// Function to create a test verification call
function generateTestVerificationCall(proofData) {
    console.log('\n=== TEST VERIFICATION CALL ===');
    
    // Convert to the format expected by the contract
    const formattedProof = {
        proofPart1: proofData.proofPart1.map(x => BigInt(x)),
        proofPart2: proofData.proofPart2.map(x => BigInt(x)),
        publicInputs: proofData.publicInputs.map(x => BigInt(x)),
        smax: BigInt(256)
    };
    
    console.log('Proof part1 length:', formattedProof.proofPart1.length);
    console.log('Proof part2 length:', formattedProof.proofPart2.length);
    console.log('Public inputs length:', formattedProof.publicInputs.length);
    console.log('smax:', formattedProof.smax.toString());
    
    // Log the function signature from public inputs (index 16 in user data)
    console.log('\nFunction signature from public inputs:');
    console.log('Raw value at index 16:', formattedProof.publicInputs[16].toString());
    console.log('As hex:', '0x' + formattedProof.publicInputs[16].toString(16));
    
    return formattedProof;
}

// Analyze both proof files
console.log('ANALYZING PROOF FILES FOR VERIFIER DEBUG\n');

const proof1 = analyzeProofData('./input_templates/channel5_proof1.json');
const formatted1 = generateTestVerificationCall(proof1);

console.log('\n' + '='.repeat(60) + '\n');

const proof2 = analyzeProofData('./input_templates/channel5_proof2.json');
const formatted2 = generateTestVerificationCall(proof2);

// Additional checks for common issues
console.log('\n=== COMMON PROOF VERIFICATION ISSUES ===');
console.log('1. Check that proofPart1 elements are within uint128 range');
console.log('2. Check that the proof was generated with smax=256');
console.log('3. Check that the preprocessed data in the contract matches the circuit');
console.log('4. Verify that the proof was generated for the correct public inputs');
console.log('5. Ensure the verifier contract matches the circuit used to generate the proof');

// Create a verification test script
const testScript = `
// Test script for manual verification (use with cast or in Remix)
// Replace VERIFIER_ADDRESS and PREPROCESSED_DATA with actual values

const proofPart1 = [${formatted1.proofPart1.slice(0, 5).join(', ')}...]; // ${formatted1.proofPart1.length} elements
const proofPart2 = [${formatted1.proofPart2.slice(0, 5).join(', ')}...]; // ${formatted1.proofPart2.length} elements  
const publicInputs = [${formatted1.publicInputs.slice(0, 10).join(', ')}...]; // ${formatted1.publicInputs.length} elements
const smax = ${formatted1.smax};

// Call verifier.verify(proofPart1, proofPart2, preprocessedPart1, preprocessedPart2, publicInputs, smax)
`;

console.log('\n=== TEST SCRIPT TEMPLATE ===');
console.log(testScript);