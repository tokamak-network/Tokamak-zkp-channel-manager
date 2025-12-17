const fs = require('fs');
const { keccak256, encodePacked } = require('viem');

// Function to compute instance hash like the contract does
function computeInstanceHash(publicInputs, startIndex = 64) {
    // Extract function instance data starting from startIndex
    const functionInstanceData = publicInputs.slice(startIndex);
    
    console.log(`\n=== INSTANCE HASH COMPUTATION (starting at index ${startIndex}) ===`);
    console.log('Function instance data length:', functionInstanceData.length);
    console.log('First 10 elements:', functionInstanceData.slice(0, 10));
    console.log('Last 10 elements:', functionInstanceData.slice(-10));
    
    // Convert to BigInt array (like contract does)
    const functionDataBigInts = functionInstanceData.map(x => {
        if (typeof x === 'string') {
            return BigInt(x);
        }
        return BigInt(x);
    });
    
    // Compute hash using keccak256(abi.encodePacked(functionInstanceData))
    // In Solidity: keccak256(abi.encodePacked(functionInstanceData))
    // Each uint256 becomes 32 bytes
    const hash = keccak256(encodePacked(
        new Array(functionDataBigInts.length).fill('uint256'),
        functionDataBigInts
    ));
    
    console.log('Computed instance hash:', hash);
    return hash;
}

// Read the proof file
const proofFile = './input_templates/channel5_proof1.json';
const proofData = JSON.parse(fs.readFileSync(proofFile, 'utf8'));

console.log('=== PROOF FILE ANALYSIS ===');
console.log('a_pub_user length:', proofData.a_pub_user.length);
console.log('a_pub_block length:', proofData.a_pub_block.length);  
console.log('a_pub_function length:', proofData.a_pub_function.length);

// Concatenate public inputs like the UI does
const publicInputs = [
    ...proofData.a_pub_user,
    ...proofData.a_pub_block, 
    ...proofData.a_pub_function
];

console.log('Total public inputs length:', publicInputs.length);

// Test both the old (wrong) and new (correct) indices
console.log('\n=== TESTING DIFFERENT START INDICES ===');

// Old contract logic (index 66)
const hashFrom66 = computeInstanceHash(publicInputs, 66);

// New contract logic (index 64) 
const hashFrom64 = computeInstanceHash(publicInputs, 64);

// Also test just the a_pub_function array directly
console.log('\n=== TESTING a_pub_function ARRAY DIRECTLY ===');
const hashFromFunction = computeInstanceHash(proofData.a_pub_function, 0);

console.log('\n=== RESULTS SUMMARY ===');
console.log('Hash from index 66 (old):', hashFrom66);
console.log('Hash from index 64 (new):', hashFrom64);
console.log('Hash from a_pub_function directly:', hashFromFunction);

// Additional debugging - show what's at the boundary indices
console.log('\n=== BOUNDARY ANALYSIS ===');
console.log('publicInputs[63] (last block):', publicInputs[63]);
console.log('publicInputs[64] (first function):', publicInputs[64]);
console.log('publicInputs[65]:', publicInputs[65]);
console.log('publicInputs[66]:', publicInputs[66]);

console.log('\na_pub_function[0]:', proofData.a_pub_function[0]);
console.log('a_pub_function[1]:', proofData.a_pub_function[1]);
console.log('a_pub_function[2]:', proofData.a_pub_function[2]);