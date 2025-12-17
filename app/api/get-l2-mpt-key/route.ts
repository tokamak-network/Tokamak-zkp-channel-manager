import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { ethers } from 'ethers';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import { utf8ToBytes, setLengthLeft, bytesToBigInt, bigIntToBytes, bytesToHex, Address, concatBytes, addHexPrefix, hexToBytes } from '@ethereumjs/util';
import { jubjub } from '@noble/curves/misc.js';
import { poseidon2 } from 'poseidon-bls12381';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/N-Gnpjy1WvCfokwj6fiOfuAVL_At6IvE')
});

export const runtime = "nodejs";

// Constants (copied from importedConstants.ts)
const POSEIDON_INPUTS = 2; // Default value, should match the actual circuit

// Poseidon implementation (copied from crypto/index.ts)
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
    // Split input bytes into 32-byte big-endian words → BigInt[] (no Node Buffer dependency)
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
    
    // Repeatedly fold until a single word remains
    let acc: bigint[] = fold(words)
    while (acc.length > 1) acc = fold(acc)
    return setLengthLeft(bigIntToBytes(acc[0]), 32);
}

// Serverless-compatible MPT key generation functions
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

function generateMptKeyFromWalletServerless(
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Create wallet from the private key sent from client
    const wallet = new ethers.Wallet(body.privateKey);
    
    // Use serverless-compatible MPT key generation
    const key = generateMptKeyFromWalletServerless(
      wallet, 
      body.participantName, 
      body.channelId, 
      body.tokenAddress, 
      body.slot || 0
    );
    
    return NextResponse.json({ key });
  } catch (error) {
    console.error('Error generating MPT key:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate MPT key',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const participant = searchParams.get('participant');
    const channelId = searchParams.get('channelId');

    if (!participant || !channelId) {
      return NextResponse.json(
        { error: 'Missing required parameters: participant, channelId' },
        { status: 400 }
      );
    }

    // Get L2 MPT key from contract
    const l2MptKey = await publicClient.readContract({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getL2MptKey',
      args: [BigInt(channelId), participant as `0x${string}`]
    });

    return NextResponse.json({
      success: true,
      key: l2MptKey?.toString() || '0',
      participant,
      channelId
    });

  } catch (error) {
    console.error('Error fetching L2 MPT key:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch L2 MPT key',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}