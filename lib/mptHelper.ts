/**
 * MPT (Merkle Patricia Tree) Helper Functions
 * 
 * This module provides off-chain utilities to generate MPT leaves compatible
 * with the RollupBridge contract, similar to the _createMPTLeaves function
 * in RollupBridge.t.sol
 */

import { keccak256 } from 'viem';

/**
 * Simple RLP encoding implementation for our specific use case
 * This handles the encoding of account data in Ethereum's RLP format
 */
class RLPEncoder {
  static encodeLength(length: number, offset: number): Uint8Array {
    if (length < 56) {
      return new Uint8Array([length + offset]);
    } else {
      const hexLength = length.toString(16);
      const lengthLength = Math.ceil(hexLength.length / 2);
      const lengthBytes = new Uint8Array(lengthLength);
      
      for (let i = 0; i < lengthLength; i++) {
        const byteIndex = (lengthLength - 1 - i) * 2;
        lengthBytes[i] = parseInt(hexLength.slice(byteIndex, byteIndex + 2) || '00', 16);
      }
      
      const result = new Uint8Array(1 + lengthBytes.length);
      result[0] = lengthLength + offset + 55;
      result.set(lengthBytes, 1);
      return result;
    }
  }

  static encodeBytes(data: Uint8Array): Uint8Array {
    if (data.length === 1 && data[0] < 0x80) {
      return data;
    } else {
      const lengthPrefix = this.encodeLength(data.length, 0x80);
      const result = new Uint8Array(lengthPrefix.length + data.length);
      result.set(lengthPrefix);
      result.set(data, lengthPrefix.length);
      return result;
    }
  }

  static encodeList(items: Uint8Array[]): Uint8Array {
    const concatenated = new Uint8Array(items.reduce((sum, item) => sum + item.length, 0));
    let offset = 0;
    
    for (const item of items) {
      concatenated.set(item, offset);
      offset += item.length;
    }
    
    const lengthPrefix = this.encodeLength(concatenated.length, 0xc0);
    const result = new Uint8Array(lengthPrefix.length + concatenated.length);
    result.set(lengthPrefix);
    result.set(concatenated, lengthPrefix.length);
    return result;
  }

  static encode(data: bigint | Uint8Array): Uint8Array {
    if (typeof data === 'bigint') {
      // Convert bigint to 32-byte representation (matching Solidity's abi.encodePacked behavior)
      const hex = data.toString(16).padStart(64, '0'); // Always pad to 32 bytes (64 hex chars)
      const bytes = new Uint8Array(32);
      
      for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      
      return this.encodeBytes(bytes);
    } else {
      return this.encodeBytes(data);
    }
  }
}

/**
 * Creates a mock MPT leaf for a given balance
 * Replicates the _createMockMPTLeaf function from RollupBridge.t.sol
 * 
 * @param balance - The account balance in wei
 * @returns RLP-encoded account data as hex string
 */
export function createMockMPTLeaf(balance: bigint): `0x${string}` {
  // Account fields: [nonce, balance, storageHash, codeHash]
  const accountFields: Uint8Array[] = [];
  
  // nonce = 0
  accountFields.push(RLPEncoder.encode(BigInt(0)));
  
  // balance
  accountFields.push(RLPEncoder.encode(balance));
  
  // storageHash (empty storage) - keccak256("")
  const emptyHash = keccak256(new Uint8Array(0));
  const emptyHashBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    emptyHashBytes[i] = parseInt(emptyHash.slice(2 + i * 2, 4 + i * 2), 16);
  }
  accountFields.push(RLPEncoder.encode(emptyHashBytes));
  
  // codeHash (empty code) - keccak256("")  
  accountFields.push(RLPEncoder.encode(emptyHashBytes));
  
  // RLP encode the list
  const encoded = RLPEncoder.encodeList(accountFields);
  
  // Convert to hex string
  return `0x${Array.from(encoded).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

/**
 * Creates MPT leaves for multiple balances
 * Replicates the _createMPTLeaves function from RollupBridge.t.sol
 * 
 * @param balances - Array of account balances in wei
 * @returns Array of RLP-encoded MPT leaves as hex strings
 */
export function createMPTLeaves(balances: bigint[]): `0x${string}`[] {
  return balances.map(balance => createMockMPTLeaf(balance));
}

/**
 * Helper function to convert token amounts to smallest unit
 * 
 * @param tokenAmount - Amount in token units (e.g., "1.5")
 * @param decimals - Token decimals (e.g., 6 for USDT, 18 for ETH, 27 for WTON)
 * @returns Amount in smallest unit as bigint
 */
export function tokenToSmallestUnit(tokenAmount: string, decimals: number): bigint {
  if (!tokenAmount || tokenAmount === '') {
    return BigInt(0);
  }
  
  // Validate decimals - ensure it's a reasonable number
  if (decimals < 0 || decimals > 77) { // 77 is theoretical max for JavaScript numbers
    throw new Error(`Invalid decimals: ${decimals}. Must be between 0 and 77.`);
  }
  
  // Handle high-precision tokens like WTON (27 decimals) by using string manipulation
  // to avoid JavaScript floating point precision issues
  const cleanAmount = tokenAmount.trim();
  const dotIndex = cleanAmount.indexOf('.');
  
  if (dotIndex === -1) {
    // No decimal point - just multiply by 10^decimals
    // Use string multiplication for high precision
    const zeros = '0'.repeat(decimals);
    return BigInt(cleanAmount + zeros);
  }
  
  // Has decimal point - need to handle precision carefully
  const integerPart = cleanAmount.substring(0, dotIndex);
  const fractionalPart = cleanAmount.substring(dotIndex + 1);
  
  // Pad or truncate fractional part to match decimals
  let paddedFractionalPart: string;
  if (fractionalPart.length > decimals) {
    // Truncate excess precision
    paddedFractionalPart = fractionalPart.substring(0, decimals);
  } else {
    // Pad with zeros
    paddedFractionalPart = fractionalPart.padEnd(decimals, '0');
  }
  
  // Combine integer and fractional parts
  const combinedString = integerPart + paddedFractionalPart;
  return BigInt(combinedString);
}

/**
 * Helper function to convert smallest unit to token amount for display
 * 
 * @param smallestUnitAmount - Amount in smallest unit
 * @param decimals - Token decimals
 * @returns Amount in token units as string
 */
export function smallestUnitToToken(smallestUnitAmount: bigint, decimals: number): string {
  if (smallestUnitAmount === BigInt(0)) {
    return '0';
  }
  
  // Validate decimals
  if (decimals < 0 || decimals > 77) {
    throw new Error(`Invalid decimals: ${decimals}. Must be between 0 and 77.`);
  }
  
  // Convert bigint to handle high-precision tokens
  const divisor = BigInt(10 ** decimals);
  
  // Perform division and get remainder for precision
  const quotient = smallestUnitAmount / divisor;
  const remainder = smallestUnitAmount % divisor;
  
  if (remainder === BigInt(0)) {
    return quotient.toString();
  }
  
  // Handle fractional part by padding remainder to full decimal places
  const remainderStr = remainder.toString().padStart(decimals, '0');
  // Remove trailing zeros from fractional part
  const trimmedRemainder = remainderStr.replace(/0+$/, '');
  
  if (trimmedRemainder === '') {
    return quotient.toString();
  }
  
  return `${quotient}.${trimmedRemainder}`;
}

/**
 * Helper function to convert ETH amounts to wei (backward compatibility)
 * 
 * @param ethAmount - Amount in ETH (e.g., "1.5")
 * @returns Amount in wei as bigint
 */
export function ethToWei(ethAmount: string): bigint {
  return tokenToSmallestUnit(ethAmount, 18);
}

/**
 * Helper function to convert wei to ETH for display (backward compatibility)
 * 
 * @param weiAmount - Amount in wei
 * @returns Amount in ETH as string
 */
export function weiToEth(weiAmount: bigint): string {
  return smallestUnitToToken(weiAmount, 18);
}

/**
 * Generate MPT leaves from token balance strings
 * Convenience function for UI usage
 * 
 * @param tokenBalances - Array of balance strings in token units (e.g., ["1.0", "2.0", "3.0"])
 * @param decimals - Token decimals (e.g., 6 for USDT, 18 for ETH, 27 for WTON)
 * @returns Array of RLP-encoded MPT leaves as hex strings
 */
export function generateMPTLeavesFromToken(tokenBalances: string[], decimals: number): `0x${string}`[] {
  try {
    const smallestUnitBalances = tokenBalances.map((token) => {
      const result = tokenToSmallestUnit(token, decimals);
      
      // Additional validation for high-decimal tokens like WTON
      if (decimals >= 27) {
        const expectedForInteger = token.includes('.') ? null : BigInt(token + '0'.repeat(decimals));
        if (expectedForInteger && result !== expectedForInteger) {
          return expectedForInteger;
        }
      }
      
      return result;
    });
    
    const leaves = createMPTLeaves(smallestUnitBalances);
    return leaves;
  } catch (error) {
    throw new Error(`Failed to generate MPT leaves: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate MPT leaves from ETH balance strings (backward compatibility)
 * Convenience function for UI usage
 * 
 * @param ethBalances - Array of balance strings in ETH (e.g., ["1.0", "2.0", "3.0"])
 * @returns Array of RLP-encoded MPT leaves as hex strings
 */
export function generateMPTLeavesFromETH(ethBalances: string[]): `0x${string}`[] {
  return generateMPTLeavesFromToken(ethBalances, 18);
}

/**
 * Validate that initial and final balances conserve total value
 * 
 * @param initialBalances - Initial balances in wei
 * @param finalBalances - Final balances in wei  
 * @returns True if total is conserved
 */
export function validateBalanceConservation(initialBalances: bigint[], finalBalances: bigint[]): boolean {
  const initialTotal = initialBalances.reduce((sum, balance) => sum + balance, BigInt(0));
  const finalTotal = finalBalances.reduce((sum, balance) => sum + balance, BigInt(0));
  return initialTotal === finalTotal;
}

/**
 * Standard test balances used in RollupBridge tests
 * These match the _initializeChannel function: 1 ETH, 2 ETH, 3 ETH
 */
export const STANDARD_TEST_INITIAL_BALANCES = [
  ethToWei("1.0"), // 1 ether = 0xde0b6b3a7640000
  ethToWei("2.0"), // 2 ether = 0x1bc16d674ec80000  
  ethToWei("3.0")  // 3 ether = 0x29a2241af62c0000
];

/**
 * Example final balances for testing (total = 6 ETH conserved)
 */
export const STANDARD_TEST_FINAL_BALANCES = [
  ethToWei("6.0"), // All transferred to first account
  ethToWei("0.0"),
  ethToWei("0.0")
];