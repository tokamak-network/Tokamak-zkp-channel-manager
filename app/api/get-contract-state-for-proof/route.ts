import { NextRequest, NextResponse } from 'next/server';
import { readContracts } from '@wagmi/core';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import '@/lib/wagmi-core';

export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: channelId' },
        { status: 400 }
      );
    }

    const channelReadResults = await readContracts({
      contracts: [
        {
          address: ROLLUP_BRIDGE_CORE_ADDRESS,
          abi: ROLLUP_BRIDGE_CORE_ABI,
          functionName: 'getChannelInfo',
          args: [BigInt(channelId)]
        },
        {
          address: ROLLUP_BRIDGE_CORE_ADDRESS,
          abi: ROLLUP_BRIDGE_CORE_ABI,
          functionName: 'getChannelLeader',
          args: [BigInt(channelId)]
        },
        {
          address: ROLLUP_BRIDGE_CORE_ADDRESS,
          abi: ROLLUP_BRIDGE_CORE_ABI,
          functionName: 'getChannelParticipants',
          args: [BigInt(channelId)]
        }
      ]
    });

    const channelStats = channelReadResults?.[0]?.result as readonly [
      string,
      number,
      bigint,
      string
    ];

    const [targetContract, state, participantCount, initialRoot] = channelStats;
    
    const leader = channelReadResults?.[1]?.result as string;
    const participants = channelReadResults?.[2]?.result as readonly string[];

    // Build the state data exactly as the contract does
    const stateData: Array<{ participant: string; targetContract: string; l2MptKey: string; balance: string; entryIndex: number }> = [];
    const storageKeys: string[] = [];
    const storageValues: string[] = [];

    let entryIndex = 0;
    // Iterate through participants (only one target contract per channel now)
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      
      try {
        // Get balance from contract (no token parameter needed)
        const [balanceResult, l2MptKeyResult] = await readContracts({
          contracts: [
            {
              address: ROLLUP_BRIDGE_CORE_ADDRESS,
              abi: ROLLUP_BRIDGE_CORE_ABI,
              functionName: 'getParticipantDeposit',
              args: [BigInt(channelId), participant as `0x${string}`]
            },
            {
              address: ROLLUP_BRIDGE_CORE_ADDRESS,
              abi: ROLLUP_BRIDGE_CORE_ABI,
              functionName: 'getL2MptKey',
              args: [BigInt(channelId), participant as `0x${string}`]
            }
          ]
        });

        if (!balanceResult || balanceResult.status !== 'success') {
          throw new Error('Failed to fetch participant balance');
        }

        const balance = balanceResult.result as bigint;

        // Get L2 MPT key
        let l2MptKey = '0';
        if (l2MptKeyResult?.status === 'success' && l2MptKeyResult.result !== undefined) {
          l2MptKey = (l2MptKeyResult.result as bigint).toString();
        } else {
          console.warn(`Could not fetch L2 MPT key for participant ${participant}`);
        }

        stateData.push({
          participant,
          targetContract,
          l2MptKey,
          balance: balance.toString(),
          entryIndex
        });

        storageKeys.push(l2MptKey);
        storageValues.push(balance.toString());
        entryIndex++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Error fetching data for participant ${participant}:`, errorMessage);
        // Add zero entry
        stateData.push({
          participant,
          targetContract,
          l2MptKey: '0',
          balance: '0',
          entryIndex
        });
        storageKeys.push('0');
        storageValues.push('0');
        entryIndex++;
      }
    }

    // Pad to 16 entries as required by circuit
    while (storageKeys.length < 16) {
      storageKeys.push('0');
      storageValues.push('0');
    }

    // Truncate if over 16 (shouldn't happen with current setup)
    if (storageKeys.length > 16) {
      storageKeys.splice(16);
      storageValues.splice(16);
    }

    return NextResponse.json({
      success: true,
      channelId,
      channelState: {
        id: channelId,
        targetContract: targetContract,
        state,
        participantCount: participantCount.toString(),
        leader,
        participants: participants as string[]
      },
      stateData,
      circuitInput: {
        storage_keys_L2MPT: storageKeys,
        storage_values: storageValues
      }
    });

  } catch (error) {
    console.error('Error fetching contract state for proof:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch contract state for proof',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
