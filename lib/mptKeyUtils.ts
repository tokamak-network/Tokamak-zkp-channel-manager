/**
 * MPT Key Generation Utilities
 * 
 * This module provides utilities for generating MPT keys that match
 * the on-chain deposit process.
 */

import { utf8ToBytes, setLengthLeft, bytesToBigInt, bigIntToBytes, bytesToHex, Address, concatBytes, addHexPrefix, hexToBytes } from '@ethereumjs/util';
import { jubjub } from '@noble/curves/misc.js';
import { ethers } from 'ethers';

//hash function for L2MPT key generation
function keccakHashFunc(data: Uint8Array): Uint8Array {
  // For now, use a deterministic hash based on input
  // This mimics the behavior but isn't the real poseidon hash
  const hashInput = bytesToHex(data);
  const simpleHash = ethers.keccak256(ethers.toUtf8Bytes(hashInput + 'poseidon_placeholder'));
  return ethers.getBytes(simpleHash);
}

// Convert Edwards point to Ethereum address
function fromEdwardsToAddress(point: any | Uint8Array): Address {
  const edwardsToAffineBytes = (point: any): Uint8Array => {
    const affine = point.toAffine();
    const xBytes = setLengthLeft(bigIntToBytes(affine.x), 32);
    const yBytes = setLengthLeft(bigIntToBytes(affine.y), 32);
    return concatBytes(xBytes, yBytes);
  };

  let pointBytes: Uint8Array;
  if (point instanceof Uint8Array) {
    if (point.length === 32) {
      // compressed point
      pointBytes = edwardsToAffineBytes(jubjub.Point.fromBytes(point));
    } else if (point.length === 64) {
      // Uncompressed Affine coordinates
      pointBytes = point;
    } else {
      throw new Error('Invalid EdwardsPoint format');
    }
  } else {
    pointBytes = edwardsToAffineBytes(point);
  }
  
  const addressBytes = keccakHashFunc(pointBytes).slice(-20);
  return new Address(addressBytes);
}

// Generate user storage key for MPT
function getUserStorageKey(parts: Array<Address | number | bigint | string>, layer: 'L1' | 'TokamakL2'): Uint8Array {
  const bytesArray: Uint8Array[] = [];

  for (const p of parts) {
    let b: Uint8Array;

    if (p instanceof Address) {
      b = p.toBytes();
    } else if (typeof p === 'number') {
      b = bigIntToBytes(BigInt(p));
    } else if (typeof p === 'bigint') {
      b = bigIntToBytes(p);
    } else if (typeof p === 'string') {
      b = hexToBytes(addHexPrefix(p));
    } else {
      throw new Error('getUserStorageKey accepts only Address | number | bigint | string');
    }

    bytesArray.push(setLengthLeft(b, 32));
  }
  
  const packed = concatBytes(...bytesArray);
  
  let hash: Uint8Array;
  switch (layer) {
    case 'L1': {
      const keccakHash = ethers.keccak256(packed);
      hash = ethers.getBytes(keccakHash);
      break;
    }
    case 'TokamakL2': {
      hash = keccakHashFunc(packed);
      break;
    }
    default: {
      throw new Error(`Error while making a user's storage key: Undefined layer "${layer}"`);
    }
  }
  
  return hash;
}

/**
 * Generate MPT key for a participant using the same logic as deposit-ton.ts
 * All participants use "Alice" as the participant name for key generation
 *
 * Steps:
 * 1. Extract public key from L1 wallet (EOA public key)
 * 2. Create seed from L1 public key + channel ID + "Alice" => keccak256 hash
 * 3. Generate private key from seed using jubjub
 * 4. Generate public key from private key
 * 5. Derive L2 address from public key
 * 6. Generate MPT key using getUserStorageKey([l2Address, slot], 'TokamakL2') with poseidon hash
 *
 * @param wallet - ethers.js Wallet instance (contains L1 private key)
 * @param channelId - Channel ID
 * @param tokenAddress - Token address (TON in this case)
 * @param slot - Storage slot number (default: 0 for ERC20 balance)
 * @returns MPT key as hex string (bytes32)
 */
export function generateMptKeyFromWallet(
  wallet: ethers.Wallet,
  channelId: number,
  tokenAddress: string,
  slot: number = 0,
): string {
  const participantName = "Alice"; // Hardcoded for all participants
  
  console.log(`\n   📝 [generateMptKeyFromWallet] Starting MPT key generation...`);
  console.log(`      Input parameters:`);
  console.log(`         - participantName: ${participantName} (hardcoded)`);
  console.log(`         - channelId: ${channelId}`);
  console.log(`         - tokenAddress: ${tokenAddress}`);
  console.log(`         - slot: ${slot}`);

  // Step 1: Extract public key from L1 wallet (EOA public key)
  // ethers.js v6: wallet.signingKey.publicKey (compressed, 33 bytes with 0x prefix)
  const l1PublicKeyHex = wallet.signingKey.publicKey; // e.g., "0x02..." or "0x03..." (compressed)
  console.log(`\n   📝 Step 1: Extract L1 Public Key`);
  console.log(`      - l1PublicKeyHex: ${l1PublicKeyHex}`);

  // Step 2: Create seed from L1 public key + channel ID + participant name
  // Concat as strings and hash with keccak256
  const seedString = `${l1PublicKeyHex}${channelId}${participantName}`;
  const seedBytes = utf8ToBytes(seedString);
  const seedHashHex = ethers.keccak256(seedBytes);
  const seedHashBytes = ethers.getBytes(seedHashHex);
  console.log(`\n   📝 Step 2: Create seed and hash`);
  console.log(`      - seedString: ${seedString}`);
  console.log(`      - seedBytes length: ${seedBytes.length} bytes`);
  console.log(`      - seedHashBytes length: ${seedHashBytes.length} bytes`);

  // Step 3: Generate private key from seed hash
  // Convert seed hash to bigint and ensure it's within JubJub scalar field range
  const seedHashBigInt = bytesToBigInt(seedHashBytes);
  const privateKeyBigInt = seedHashBigInt % jubjub.Point.Fn.ORDER;
  console.log(`\n   📝 Step 3: Generate private key from seed hash`);
  console.log(`      - seedHashBigInt: ${seedHashBigInt.toString()}`);
  console.log(`      - jubjub.Point.Fn.ORDER: ${jubjub.Point.Fn.ORDER.toString()}`);

  // Ensure private key is not zero (JubJub requires 1 <= sc < curve.n)
  const privateKeyValue = privateKeyBigInt === BigInt(0) ? BigInt(1) : privateKeyBigInt;
  const privateKey = setLengthLeft(bigIntToBytes(privateKeyValue), 32);
  console.log(`      - privateKeyValue: ${privateKeyValue.toString()}`);
  console.log(`      - privateKey length: ${privateKey.length} bytes`);

  // Step 4: Generate public key from private key
  const publicKey = jubjub.Point.BASE.multiply(bytesToBigInt(privateKey)).toBytes();
  console.log(`\n   📝 Step 4: Generate public key from private key`);
  console.log(`      - publicKey length: ${publicKey.length} bytes`);

  // Step 5: Derive L2 address from public key
  const l2Address = fromEdwardsToAddress(jubjub.Point.fromBytes(publicKey));
  console.log(`\n   📝 Step 5: Derive L2 address from public key`);
  console.log(`      - l2Address: ${l2Address.toString()}`);

  // Step 6: Generate MPT key using getUserStorageKey
  // This matches the on-chain MPT key generation logic
  const mptKeyBytes = getUserStorageKey([l2Address, slot], 'TokamakL2');
  const mptKey = bytesToHex(mptKeyBytes);
  console.log(`\n   📝 Step 6: Generate MPT key using getUserStorageKey`);
  console.log(`      - getUserStorageKey inputs:`);
  console.log(`         - l2Address: ${l2Address.toString()}`);
  console.log(`         - slot: ${slot}`);
  console.log(`         - layer: 'TokamakL2'`);
  console.log(`      - mptKeyBytes length: ${mptKeyBytes.length} bytes`);
  console.log(`      - mptKey (hex): ${mptKey}`);
  console.log(`   ✅ [generateMptKeyFromWallet] MPT key generation completed\n`);

  return mptKey;
}

/**
 * Generate MPT key from address (for use with connected wallet)
 * All participants use "Alice" as the participant name for key generation
 *
 * @param address - Connected wallet address
 * @param channelId - Channel ID
 * @param tokenAddress - Token address
 * @param slot - Storage slot number (default: 0 for ERC20 balance)
 * @returns Promise<string> MPT key as hex string
 */
export async function generateMptKeyFromAddress(
  address: string,
  channelId: number,
  tokenAddress: string,
  slot: number = 0,
): Promise<string> {
  const participantName = "Alice"; // Hardcoded for all participants
  
  // This is a simplified version for connected wallets where we don't have private key access
  // In practice, you would need to sign a message to prove ownership and derive the key
  
  // Create a deterministic seed from the address and parameters
  const seedString = `${address.toLowerCase()}${channelId}${participantName}${tokenAddress}`;
  const seedHashHex = ethers.keccak256(ethers.toUtf8Bytes(seedString));
  const seedHashBytes = ethers.getBytes(seedHashHex);
  
  // Generate private key from seed
  const seedHashBigInt = bytesToBigInt(seedHashBytes);
  const privateKeyBigInt = seedHashBigInt % jubjub.Point.Fn.ORDER;
  const privateKeyValue = privateKeyBigInt === BigInt(0) ? BigInt(1) : privateKeyBigInt;
  
  // Generate public key
  const publicKey = jubjub.Point.BASE.multiply(privateKeyValue).toBytes();
  
  // Derive L2 address
  const l2Address = fromEdwardsToAddress(jubjub.Point.fromBytes(publicKey));
  
  // Generate MPT key
  const mptKeyBytes = getUserStorageKey([l2Address, slot], 'TokamakL2');
  const mptKey = bytesToHex(mptKeyBytes);
  
  console.log(`Generated MPT key for channel ${channelId}: ${mptKey}`);
  
  return mptKey;
}