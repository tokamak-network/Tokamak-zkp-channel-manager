import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';

export const runtime = 'edge';
export const dynamic = 'force-static';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/N-Gnpjy1WvCfokwj6fiOfuAVL_At6IvE')
});

export async function POST(request: NextRequest) {
  try {
    const { channelId, merkleRoot } = await request.json();

    if (!channelId || !merkleRoot) {
      return NextResponse.json(
        { error: 'Missing required parameters: channelId, merkleRoot' },
        { status: 400 }
      );
    }

    // Get channel info
    const channelStats = await publicClient.readContract({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getChannelInfo',
      args: [BigInt(channelId)]
    }) as readonly [string, number, bigint, string];

    const [targetContract, state, participantCount, initialRoot] = channelStats;
    
    // Get leader separately
    const leader = await publicClient.readContract({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getChannelLeader',
      args: [BigInt(channelId)]
    }) as string;

    // Get channel participants
    const participants = await publicClient.readContract({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getChannelParticipants',
      args: [BigInt(channelId)]
    }) as readonly string[];

    const totalEntries = participants.length; // Only one token per channel now
    
    console.log('=== CONTRACT PUBLIC SIGNALS SIMULATION ===');
    console.log('Participants:', participants);
    console.log('Target contract:', targetContract);
    console.log('Total entries:', totalEntries);

    // Build the public signals array exactly as the contract does
    const publicSignals = new Array(33).fill('0');
    const debug: any[] = [];

    // First element is the merkle root
    publicSignals[0] = merkleRoot.replace('0x', '');
    if (publicSignals[0].startsWith('0x')) {
      publicSignals[0] = BigInt(merkleRoot).toString();
    } else {
      publicSignals[0] = merkleRoot;
    }
    debug.push({step: 'merkle_root', index: 0, value: publicSignals[0]});

    // Fill merkle keys (L2 MPT keys) and storage values (balances)
    let entryIndex = 0;
    for (const participant of participants) {
      // Get balance for the single target contract
      const balance = await publicClient.readContract({
        address: ROLLUP_BRIDGE_CORE_ADDRESS,
        abi: ROLLUP_BRIDGE_CORE_ABI,
        functionName: 'getParticipantDeposit',
        args: [BigInt(channelId), participant as `0x${string}`]
      }) as bigint;

      // Get L2 MPT key
      let l2MptKey = '0';
      try {
        const l2MptKeyResult = await publicClient.readContract({
          address: ROLLUP_BRIDGE_CORE_ADDRESS,
          abi: ROLLUP_BRIDGE_CORE_ABI,
          functionName: 'getL2MptKey',
          args: [BigInt(channelId), participant as `0x${string}`]
        }) as bigint;
        l2MptKey = l2MptKeyResult.toString();
      } catch (error) {
        console.warn(`Could not fetch L2 MPT key for ${participant}`);
      }

      // Contract logic: Add to public signals:
      // - indices 1-16 are merkle_keys (L2 MPT keys)
      // - indices 17-32 are storage_values (balances)
      const l2MptIndex = entryIndex + 1;
      const balanceIndex = entryIndex + 17;
      
      publicSignals[l2MptIndex] = l2MptKey;
      publicSignals[balanceIndex] = balance.toString();

      debug.push({
        step: 'participant_entry',
        participant: participant,
        entryIndex: entryIndex,
        l2MptKey: l2MptKey,
        balance: balance.toString(),
        l2MptIndex: l2MptIndex,
        balanceIndex: balanceIndex
      });

      entryIndex++;
    }

    // Pad remaining slots with zeros (circuit expects exactly 16 entries)
    for (let i = totalEntries; i < 16; i++) {
      publicSignals[i + 1] = '0'; // merkle key
      publicSignals[i + 17] = '0'; // storage value
      debug.push({
        step: 'padding',
        entryIndex: i,
        l2MptIndex: i + 1,
        balanceIndex: i + 17
      });
    }

    return NextResponse.json({
      success: true,
      channelId,
      merkleRoot,
      totalEntries,
      publicSignals,
      debug,
      comparison: {
        "contract_builds": "publicSignals array with contract state",
        "circuit_expects": "same array structure from circuit inputs"
      }
    });

  } catch (error) {
    console.error('Error simulating contract public signals:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to simulate contract public signals',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}