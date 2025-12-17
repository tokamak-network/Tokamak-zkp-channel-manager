'use client';

import { utf8ToBytes, setLengthLeft, bytesToBigInt, bigIntToBytes, bytesToHex, Address, concatBytes, addHexPrefix, hexToBytes } from '@ethereumjs/util';
import { jubjub } from '@noble/curves/misc.js';
import { poseidon2 } from 'poseidon-bls12381';
import { ethers } from 'ethers';

// Constants
const POSEIDON_INPUTS = 2;

// Poseidon implementation for client-side use
const poseidon_raw = (inVals: bigint[]): bigint => {
  if (inVals.length !== POSEIDON_INPUTS) {
    throw new Error(`Expected an array with ${POSEIDON_INPUTS} elements, but got ${inVals.length} elements`)
  }
  return poseidon2(inVals)
}

function poseidon(msg: Uint8Array): Uint8Array {
    if (msg.length === 0 ) {
        return setLengthLeft(bigIntToBytes(poseidon_raw(Array<bigint>(POSEIDON_INPUTS).fill(0n))), 32)
    }
    
    const words: bigint[] = Array.from({ length: Math.ceil(msg.byteLength / 32) }, (_, i) => {
      const slice = msg.subarray(i * 32, (i + 1) * 32)
      return bytesToBigInt(slice)
    });

    const fold = (arr: bigint[]): bigint[] => {
        const n1xChunks = Math.ceil(arr.length / POSEIDON_INPUTS);
        const nPaddedChildren = n1xChunks * POSEIDON_INPUTS;
        const mode2x: boolean = nPaddedChildren % (POSEIDON_INPUTS ** 2) === 0

        let placeFunction = mode2x ?
            (chunk: bigint[]) => poseidon_raw([poseidon_raw(chunk.slice(0, POSEIDON_INPUTS)), poseidon_raw(chunk.slice(POSEIDON_INPUTS))]) :
            poseidon_raw
              
        const nChildren = mode2x ? (POSEIDON_INPUTS ** 2) : POSEIDON_INPUTS
        
        const out: bigint[] = [];
        for (let childId = 0; childId < nPaddedChildren; childId += nChildren) {
            const chunk = Array.from({ length: nChildren }, (_, localChildId) => arr[childId + localChildId] ?? 0n);
            out.push(placeFunction(chunk));
        }
        return out;
    };
    
    let acc: bigint[] = fold(words)
    while (acc.length > 1) acc = fold(acc)
    return setLengthLeft(bigIntToBytes(acc[0]), 32);
}

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
            pointBytes = edwardsToAffineBytes(jubjub.Point.fromBytes(point))
        }
        else if (point.length === 64) {
            pointBytes = point
        }
        else {
            throw new Error('Invalid EdwardsPoint format')
        }
    } else {
        pointBytes = edwardsToAffineBytes(point)
    }
    const addressByte = poseidon(pointBytes).subarray(-20)
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
            hash = poseidon(packed);
        }
        break;
        default: {
            throw new Error(`Error while making a user's storage key: Undefined layer "${layer}"`);
        }
    }
    return hash
}

/**
 * Generate MPT key for a participant using poseidon hash (client-side)
 */
export function generateMptKeyFromWalletClient(
  wallet: ethers.Wallet,
  participantName: string,
  channelId: number,
  tokenAddress: string,
  slot: number = 0,
): string {
  // Step 1: Extract public key from L1 wallet
  const l1PublicKeyHex = wallet.signingKey.publicKey;

  // Step 2: Create seed from L1 public key + channel ID + participant name
  const seedString = `${l1PublicKeyHex}${channelId}${participantName}`;
  const seedBytes = utf8ToBytes(seedString);
  const seedHashHex = ethers.keccak256(seedBytes);
  const seedHashBytes = ethers.getBytes(seedHashHex);

  // Step 3: Generate private key from seed hash
  const seedHashBigInt = bytesToBigInt(seedHashBytes);
  const privateKeyBigInt = seedHashBigInt % jubjub.Point.Fn.ORDER;

  // Ensure private key is not zero
  const privateKeyValue = privateKeyBigInt === BigInt(0) ? BigInt(1) : privateKeyBigInt;
  const privateKey = setLengthLeft(bigIntToBytes(privateKeyValue), 32);

  // Step 4: Generate public key from private key
  const publicKey = jubjub.Point.BASE.multiply(bytesToBigInt(privateKey)).toBytes();

  // Step 5: Derive L2 address from public key
  const l2Address = fromEdwardsToAddress(jubjub.Point.fromBytes(publicKey));

  // Step 6: Generate MPT key using getUserStorageKey
  const mptKeyBytes = getUserStorageKey([l2Address, slot], 'TokamakL2');
  const mptKey = bytesToHex(mptKeyBytes);

  return mptKey;
}