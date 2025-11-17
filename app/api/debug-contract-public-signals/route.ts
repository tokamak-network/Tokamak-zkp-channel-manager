import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/N-Gnpjy1WvCfokwj6fiOfuAVL_At6IvE')
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const merkleRoot = searchParams.get('merkleRoot');

    if (!channelId || !merkleRoot) {
      return NextResponse.json(
        { error: 'Missing required parameters: channelId, merkleRoot' },
        { status: 400 }
      );
    }

    // Get channel info
    const channelStats = await publicClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelStats',
      args: [BigInt(channelId)]
    }) as readonly [bigint, readonly string[], number, bigint, string];

    const [id, allowedTokens, state, participantCount, leader] = channelStats;

    // Get channel participants
    const participants = await publicClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelParticipants',
      args: [BigInt(channelId)]
    }) as readonly string[];

    // Build the public signals array exactly as the contract does
    const publicSignals = new Array(33).fill('0');

    // First element is the merkle root (from the proof)
    publicSignals[0] = merkleRoot;

    // Fill merkle keys (L2 MPT keys) and storage values (balances)
    let entryIndex = 0;
    for (const participant of participants) {
      for (const token of allowedTokens) {
        // Get balance
        const balance = await publicClient.readContract({
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: 'getParticipantTokenDeposit',
          args: [BigInt(channelId), participant as `0x${string}`, token as `0x${string}`]
        }) as bigint;

        // Get L2 MPT key
        let l2MptKey = '0';
        try {
          const [participantsList, l2MptKeys] = await publicClient.readContract({
            address: ROLLUP_BRIDGE_ADDRESS,
            abi: ROLLUP_BRIDGE_ABI,
            functionName: 'getL2MptKeysList',
            args: [BigInt(channelId), token as `0x${string}`]
          }) as [readonly string[], readonly bigint[]];

          const participantIndex = participantsList.findIndex(p => p.toLowerCase() === participant.toLowerCase());
          if (participantIndex >= 0 && l2MptKeys[participantIndex]) {
            l2MptKey = l2MptKeys[participantIndex].toString();
          }
        } catch (error) {
          console.warn(`Could not fetch L2 MPT key for ${participant}:${token}`);
        }

        // Add to public signals exactly as contract does:
        // - indices 1-16 are merkle_keys (L2 MPT keys)  
        // - indices 17-32 are storage_values (balances)
        publicSignals[entryIndex + 1] = l2MptKey; // L2 MPT key
        publicSignals[entryIndex + 17] = balance.toString(); // storage value

        entryIndex++;
      }
    }

    // Pad remaining slots with zeros (circuit expects exactly 16 entries)
    const totalEntries = participants.length * allowedTokens.length;
    for (let i = totalEntries; i < 16; i++) {
      publicSignals[i + 1] = '0'; // merkle key
      publicSignals[i + 17] = '0'; // storage value
    }

    return NextResponse.json({
      success: true,
      channelId,
      merkleRoot,
      participants: participants as string[],
      allowedTokens: allowedTokens as string[],
      totalEntries,
      contractPublicSignals: publicSignals,
      explanation: {
        "indices 0": "merkle root (from proof)",
        "indices 1-16": "L2 MPT keys for each participant-token combination",
        "indices 17-32": "balance values for each participant-token combination"
      }
    });

  } catch (error) {
    console.error('Error building contract public signals:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to build contract public signals',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}