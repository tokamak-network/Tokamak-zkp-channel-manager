/**
 * MPT Key Generation Utilities
 * 
 * This module provides utilities for generating MPT keys that match
 * the on-chain deposit process.
 */

import { utf8ToBytes, setLengthLeft, bytesToBigInt, bigIntToBytes, bytesToHex, Address, concatBytes, addHexPrefix, hexToBytes } from '@ethereumjs/util';
import { jubjub } from '@noble/curves/misc';
import { ethers } from 'ethers';

function batchBigIntTo32BytesEach(...inVals: bigint[]): Uint8Array {
    return concatBytes(...inVals.map(x => setLengthLeft(bigIntToBytes(x), 32)))
}

function fromEdwardsToAddress(point: any | Uint8Array): Address {
    const edwardsToAffineBytes = (point: any): Uint8Array => {
        const affine = point.toAffine()
        return batchBigIntTo32BytesEach(affine.x, affine.y)
    }
    let pointBytes: Uint8Array
    if( point instanceof Uint8Array ) {
        if (point.length === 32) {
            // compressed point
            pointBytes = edwardsToAffineBytes(jubjub.Point.fromBytes(point))
        }
        else if (point.length === 64) {
            // Uncompressed Affine coordinates
            pointBytes = point
        }
        else {
            throw new Error('Invalid EdwardsPoint format')
        }
            
    } else {
        pointBytes = edwardsToAffineBytes(point)
    }
    const addressByte = ethers.getBytes(ethers.keccak256(pointBytes)).slice(-20)
    return new Address(addressByte)
}

function getUserStorageKey(parts: Array<Address | number | bigint | string>, layer: 'L1' | 'TokamakL2'): Uint8Array {
    const bytesArray: Uint8Array[] = []

    for (const p of parts) {
        let b: Uint8Array

        if (p instanceof Address) {
        b = p.toBytes()
        } else if (typeof p === 'number') {
        b = bigIntToBytes(BigInt(p))
        } else if (typeof p === 'bigint') {
        b = bigIntToBytes(p)
        } else if (typeof p === 'string') {
        b = hexToBytes(addHexPrefix(p))
        } else {
        throw new Error('getStorageKey accepts only Address | number | bigint | string');
        }

        bytesArray.push(setLengthLeft(b, 32))
    }
    const packed = concatBytes(...bytesArray)
    let hash
    switch (layer) {
        case 'L1': {
            hash = ethers.getBytes(ethers.keccak256(packed));
        }
        break;
        case 'TokamakL2': {
            hash = ethers.getBytes(ethers.keccak256(packed));
        }
        break;
        default: {
            throw new Error(`Error while making a user's storage key: Undefined layer "${layer}"`);
        }
    }
    return hash
}

/**
 * Generate MPT key for a participant using the same logic as deposit-ton.ts
 *
 * Steps:
 * 1. Extract public key from L1 wallet (EOA public key)
 * 2. Create seed from L1 public key + channel ID + participant name => keccak256 hash
 * 3. Generate private key from seed using jubjub
 * 4. Generate public key from private key
 * 5. Derive L2 address from public key
 * 6. Generate MPT key using getUserStorageKey([l2Address, slot], 'TokamakL2') with keccak hash
 *
 * @param wallet - ethers.js Wallet instance (contains L1 private key)
 * @param participantName - Name of the participant (Alice, Bob, Charlie)
 * @param channelId - Channel ID
 * @param tokenAddress - Token address (TON in this case)
 * @param slot - Storage slot number (default: 0 for ERC20 balance)
 * @returns MPT key as hex string (bytes32)
 */
export function generateMptKeyFromWallet(
  wallet: ethers.Wallet,
  participantName: string,
  channelId: number,
  tokenAddress: string,
  slot: number = 0,
): string {
  
  console.log(`\n   📝 [generateMptKeyFromWallet] Starting MPT key generation...`);
  console.log(`      Input parameters:`);
  console.log(`         - participantName: ${participantName}`);
  console.log(`         - channelId: ${channelId}`);
  console.log(`         - tokenAddress: ${tokenAddress}`);
  console.log(`         - slot: ${slot}`);

  // Step 1: Extract public key from L1 wallet (EOA public key)
  // ethers.js v6: wallet.signingKey.publicKey (compressed, 33 bytes with 0x prefix)
  // Convert to hex string for seed generation
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
  console.log(`      - seedBytes (hex): ${bytesToHex(seedBytes)}`);
  console.log(`      - seedHashBytes length: ${seedHashBytes.length} bytes`);
  console.log(`      - seedHashBytes (hex): ${bytesToHex(seedHashBytes)}`);

  // Step 3: Generate private key from seed hash
  // Convert seed hash to bigint and ensure it's within JubJub scalar field range
  const seedHashBigInt = bytesToBigInt(seedHashBytes);
  const privateKeyBigInt = seedHashBigInt % jubjub.Point.Fn.ORDER;
  console.log(`\n   📝 Step 3: Generate private key from seed hash`);
  console.log(`      - seedHashBigInt: ${seedHashBigInt.toString()}`);
  console.log(`      - jubjub.Point.Fn.ORDER: ${jubjub.Point.Fn.ORDER.toString()}`);
  console.log(`      - privateKeyBigInt (before zero check): ${privateKeyBigInt.toString()}`);

  // Ensure private key is not zero (JubJub requires 1 <= sc < curve.n)
  const privateKeyValue = privateKeyBigInt === BigInt(0) ? BigInt(1) : privateKeyBigInt;
  const privateKey = setLengthLeft(bigIntToBytes(privateKeyValue), 32);
  console.log(`      - privateKeyValue (after zero check): ${privateKeyValue.toString()}`);
  console.log(`      - privateKey length: ${privateKey.length} bytes`);
  console.log(`      - privateKey (hex): ${bytesToHex(privateKey)}`);

  // Step 4: Generate public key from private key
  const publicKey = jubjub.Point.BASE.multiply(bytesToBigInt(privateKey)).toBytes();
  console.log(`\n   📝 Step 4: Generate public key from private key`);
  console.log(`      - publicKey length: ${publicKey.length} bytes`);
  console.log(`      - publicKey (hex): ${bytesToHex(publicKey)}`);

  // Step 5: Derive L2 address from public key
  const l2Address = fromEdwardsToAddress(jubjub.Point.fromBytes(publicKey));
  console.log(`\n   📝 Step 5: Derive L2 address from public key`);
  console.log(`      - l2Address: ${l2Address.toString()}`);

  // Step 6: Generate MPT key using getUserStorageKey
  // This matches the on-chain MPT key generation logic
  // Note: getUserStorageKey uses keccak hash for 'TokamakL2' layer
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
 * Generate MPT key from L1 address by looking up the wallet
 * This requires the private key to be available in the environment
 *
 * @param l1Address - L1 address (EOA)
 * @param participantName - Name of the participant (Alice, Bob, Charlie)
 * @param channelId - Channel ID
 * @param tokenAddress - Token address
 * @param slot - Storage slot number (default: 0 for ERC20 balance)
 * @param privateKeys - Array of private keys corresponding to participants
 * @param participantNames - Array of participant names
 * @returns MPT key as hex string (bytes32)
 */
export function generateMptKeyFromL1Address(
  l1Address: string,
  participantName: string,
  channelId: number,
  tokenAddress: string,
  slot: number = 0,
  privateKeys: string[],
  participantNames: string[],
): string {
  // Find the index of the participant
  const participantIndex = participantNames.indexOf(participantName);
  if (participantIndex === -1 || !privateKeys[participantIndex]) {
    throw new Error(`Private key not found for participant ${participantName} (${l1Address})`);
  }

  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKeys[participantIndex]);

  // Verify the address matches
  if (wallet.address.toLowerCase() !== l1Address.toLowerCase()) {
    throw new Error(`Address mismatch: expected ${l1Address}, got ${wallet.address}`);
  }

  // Generate MPT key using the wallet
  return generateMptKeyFromWallet(wallet, participantName, channelId, tokenAddress, slot);
}

/**
 * Generate MPT key from address (for use with connected wallet)
 *
 * @param address - Connected wallet address
 * @param participantName - Name of the participant
 * @param channelId - Channel ID
 * @param tokenAddress - Token address
 * @param slot - Storage slot number (default: 0 for ERC20 balance)
 * @returns Promise<string> MPT key as hex string
 */
export async function generateMptKeyFromAddress(
  address: string,
  participantName: string,
  channelId: number,
  tokenAddress: string,
  slot: number = 0,
): Promise<string> {
  
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