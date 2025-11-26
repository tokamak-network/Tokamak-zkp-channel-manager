import { NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem, decodeFunctionData } from 'viem';
import { sepolia } from 'viem/chains';
import { ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS, ROLLUP_BRIDGE_CORE_ADDRESS } from '@/lib/contracts';

// Create a public client for reading blockchain data
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/N-Gnpjy1WvCfokwj6fiOfuAVL_At6IvE'),
});

// Event signatures
const stateInitializedEvent = parseAbiItem(
  'event StateInitialized(uint256 indexed channelId, bytes32 currentStateRoot)'
);

const channelOpenedEvent = parseAbiItem(
  'event ChannelOpened(uint256 indexed channelId, address[] allowedTokens)'
);

// Search for logs in chunks (to handle RPC limitations - Alchemy free tier = 10 blocks max)
async function searchLogsInChunks(
  address: `0x${string}`,
  event: any,
  args: any,
  startBlock: bigint,
  endBlock: bigint,
  chunkSize: bigint = BigInt(9) // Alchemy free tier limit
): Promise<any[]> {
  const allLogs: any[] = [];
  let currentBlock = startBlock;
  let iterations = 0;
  const maxIterations = 10000; // Safety limit

  while (currentBlock <= endBlock && iterations < maxIterations) {
    iterations++;
    const toBlock = currentBlock + chunkSize > endBlock ? endBlock : currentBlock + chunkSize;
    
    try {
      const logs = await publicClient.getLogs({
        address,
        event,
        args,
        fromBlock: currentBlock,
        toBlock: toBlock,
      });
      allLogs.push(...logs);
      
      // If we found logs, we can stop
      if (logs.length > 0) {
        break;
      }
    } catch (error: any) {
      // If error is about block range, reduce chunk size
      if (error?.message?.includes('block range') && chunkSize > BigInt(1)) {
        return searchLogsInChunks(address, event, args, currentBlock, endBlock, chunkSize / BigInt(2));
      }
      throw error;
    }
    
    currentBlock = toBlock + BigInt(1);
    
    // Log progress every 1000 iterations
    if (iterations % 1000 === 0) {
      console.log(`  Searched ${iterations} chunks, current block: ${currentBlock}`);
    }
  }

  return allLogs;
}

// ABI for decoding initializeChannelState calldata
const initializeChannelStateAbi = [
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      {
        name: 'proof',
        type: 'tuple',
        components: [
          { name: 'pA', type: 'uint256[4]' },
          { name: 'pB', type: 'uint256[8]' },
          { name: 'pC', type: 'uint256[4]' },
          { name: 'merkleRoot', type: 'bytes32' }
        ]
      }
    ],
    name: 'initializeChannelState',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

/**
 * Helper function to get proof directly from transaction hash
 */
async function getProofFromTxHash(txHash: `0x${string}`) {
  try {
    console.log(`🔍 Getting proof from transaction ${txHash}...`);
    
    const tx = await publicClient.getTransaction({ hash: txHash });
    
    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found', txHash },
        { status: 404 }
      );
    }

    // Get transaction receipt for block info
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

    // Decode the calldata
    let decodedProof;
    let channelId;
    try {
      const decoded = decodeFunctionData({
        abi: initializeChannelStateAbi,
        data: tx.input,
      });
      channelId = decoded.args[0];
      decodedProof = decoded.args[1];
    } catch (decodeError) {
      return NextResponse.json(
        { 
          error: 'Failed to decode transaction. Make sure this is an initializeChannelState transaction.',
          txHash,
          details: decodeError instanceof Error ? decodeError.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      channelId: channelId.toString(),
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      merkleRoot: decodedProof.merkleRoot,
      proof: {
        pA: decodedProof.pA.map(String),
        pB: decodedProof.pB.map(String),
        pC: decodedProof.pC.map(String),
        merkleRoot: decodedProof.merkleRoot,
      },
      proofRaw: {
        pA: decodedProof.pA,
        pB: decodedProof.pB,
        pC: decodedProof.pC,
        merkleRoot: decodedProof.merkleRoot,
      },
      metadata: {
        contractAddress: ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
        network: 'sepolia',
        retrievedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to retrieve proof from transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/get-initial-proof?channelId=0
 * GET /api/get-initial-proof?txHash=0x...  (faster - directly decode tx)
 * 
 * Retrieves the initial Groth16 proof for a channel by:
 * 1. Finding the StateInitialized event for the channel (or using provided txHash)
 * 2. Getting the transaction that emitted the event
 * 3. Decoding the calldata to extract the proof
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelIdParam = searchParams.get('channelId');
    const txHashParam = searchParams.get('txHash');
    const startBlockParam = searchParams.get('startBlock'); // Optional: specify start block

    // If txHash is provided, directly decode it (much faster)
    if (txHashParam) {
      return await getProofFromTxHash(txHashParam as `0x${string}`);
    }

    if (!channelIdParam) {
      return NextResponse.json(
        { error: 'Either channelId or txHash parameter is required' },
        { status: 400 }
      );
    }

    const channelId = BigInt(channelIdParam);
    const currentBlock = await publicClient.getBlockNumber();
    
    // Determine search start block
    let searchStartBlock = BigInt(0);
    if (startBlockParam) {
      searchStartBlock = BigInt(startBlockParam);
    } else {
      // Search recent blocks (last 10000 blocks ~ 1.5 days on Sepolia)
      // This is a reasonable range that won't timeout with 10-block chunks
      searchStartBlock = currentBlock > BigInt(10000) ? currentBlock - BigInt(10000) : BigInt(0);
    }

    console.log(`🔍 Searching for StateInitialized event for channel ${channelId} from block ${searchStartBlock}...`);
    
    // Search for StateInitialized event
    const logs = await searchLogsInChunks(
      ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
      stateInitializedEvent,
      { channelId },
      searchStartBlock,
      currentBlock
    );

    if (logs.length === 0) {
      return NextResponse.json(
        { 
          error: 'Channel not initialized or StateInitialized event not found',
          channelId: channelIdParam,
        },
        { status: 404 }
      );
    }

    // Get the first (and should be only) initialization event
    const initEvent = logs[0];
    const txHash = initEvent.transactionHash;
    const blockNumber = initEvent.blockNumber;
    const merkleRoot = initEvent.args.currentStateRoot;

    console.log(`✅ Found StateInitialized event in tx ${txHash}`);

    // 2. Get the transaction data
    const tx = await publicClient.getTransaction({
      hash: txHash,
    });

    if (!tx) {
      return NextResponse.json(
        { 
          error: 'Transaction not found',
          txHash,
        },
        { status: 404 }
      );
    }

    // 3. Decode the calldata to extract the proof
    let decodedProof;
    try {
      const decoded = decodeFunctionData({
        abi: initializeChannelStateAbi,
        data: tx.input,
      });
      
      decodedProof = decoded.args[1];
    } catch (decodeError) {
      console.error('Failed to decode calldata:', decodeError);
      return NextResponse.json(
        { 
          error: 'Failed to decode transaction calldata',
          txHash,
          details: decodeError instanceof Error ? decodeError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // 4. Format the response
    const response = {
      success: true,
      channelId: channelIdParam,
      txHash,
      blockNumber: blockNumber.toString(),
      merkleRoot: merkleRoot,
      proof: {
        pA: decodedProof.pA.map(String),
        pB: decodedProof.pB.map(String),
        pC: decodedProof.pC.map(String),
        merkleRoot: decodedProof.merkleRoot,
      },
      // Also include raw format for direct contract usage
      proofRaw: {
        pA: decodedProof.pA,
        pB: decodedProof.pB,
        pC: decodedProof.pC,
        merkleRoot: decodedProof.merkleRoot,
      },
      metadata: {
        contractAddress: ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
        network: 'sepolia',
        retrievedAt: new Date().toISOString(),
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error retrieving initial proof:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve initial proof',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

