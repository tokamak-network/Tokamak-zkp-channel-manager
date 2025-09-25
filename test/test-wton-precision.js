#!/usr/bin/env node

/**
 * Test WTON precision handling specifically
 */

function tokenToSmallestUnit(tokenAmount, decimals) {
  if (!tokenAmount || tokenAmount === '') {
    return BigInt(0);
  }
  
  // Validate decimals
  if (decimals < 0 || decimals > 77) {
    throw new Error(`Invalid decimals: ${decimals}. Must be between 0 and 77.`);
  }
  
  const cleanAmount = tokenAmount.trim();
  const dotIndex = cleanAmount.indexOf('.');
  
  if (dotIndex === -1) {
    // No decimal point - use string multiplication for high precision
    const zeros = '0'.repeat(decimals);
    return BigInt(cleanAmount + zeros);
  }
  
  // Has decimal point - handle precision carefully
  const integerPart = cleanAmount.substring(0, dotIndex);
  const fractionalPart = cleanAmount.substring(dotIndex + 1);
  
  // Pad or truncate fractional part to match decimals
  let paddedFractionalPart;
  if (fractionalPart.length > decimals) {
    paddedFractionalPart = fractionalPart.substring(0, decimals);
  } else {
    paddedFractionalPart = fractionalPart.padEnd(decimals, '0');
  }
  
  const combinedString = integerPart + paddedFractionalPart;
  return BigInt(combinedString);
}

console.log('🧪 Testing WTON Precision Fix\n');

// Test the specific case that was causing issues
const wtonDecimals = 27;
const testCases = [
  '12',     // Your case - 12 WTON
  '12.0',   // Same as above with decimal
  '12.000000000000000000000000000', // Explicit 27 decimals
  '1.5',    // With fractional part
];

console.log('Testing WTON (27 decimals) precision:');
testCases.forEach((amount, index) => {
  try {
    const result = tokenToSmallestUnit(amount, wtonDecimals);
    const expected = amount === '12' || amount === '12.0' ? 
      BigInt('12000000000000000000000000000') : null;
    
    console.log(`\n  Test ${index + 1}: "${amount}"`);
    console.log(`    Result:   ${result.toString()}`);
    
    if (expected) {
      console.log(`    Expected: ${expected.toString()}`);
      console.log(`    Match:    ${result === expected ? '✅ PERFECT' : '❌ MISMATCH'}`);
      
      if (result !== expected) {
        const diff = result - expected;
        console.log(`    Difference: ${diff.toString()} wei`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
});

console.log('\n✨ The fix should now generate exactly:');
console.log('   12000000000000000000000000000');
console.log('   instead of:');
console.log('   12000000000000000159450660864');
console.log('\n🔧 Try regenerating your MPT leaves now!');