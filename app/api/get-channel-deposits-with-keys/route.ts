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
          functionName: 'getChannelParticipants',
          args: [BigInt(channelId)]
        },
        {
          address: ROLLUP_BRIDGE_CORE_ADDRESS,
          abi: ROLLUP_BRIDGE_CORE_ABI,
          functionName: 'getChannelTargetContract',
          args: [BigInt(channelId)]
        }
      ]
    });
    const participants = channelReadResults?.[0]?.result as readonly string[];
    const targetContract = channelReadResults?.[1]?.result as string;

    // Fetch all deposits and generate circuit inputs
    const deposits: Array<{ participant: string; amount: string; mptKey: string }> = [];
    
    for (const participant of participants) {
      try {
        const [amountResult, l2MptKeyResult] = await readContracts({
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

        if (!amountResult || amountResult.status !== 'success') {
          throw new Error('Failed to fetch participant deposit');
        }

        const amount = amountResult.result as bigint;

        // Try to get actual L2 MPT key, fall back to deterministic generation
        let mptKey = '0';
        if (l2MptKeyResult?.status === 'success' && l2MptKeyResult.result !== undefined) {
          mptKey = (l2MptKeyResult.result as bigint).toString();
        } else {
          // Generate deterministic MPT key based on participant only (no token needed)
          const hash = BigInt(`0x${Buffer.from(participant).toString('hex').slice(0, 64).padStart(64, '0')}`);
          mptKey = (hash % BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE')).toString();
        }

        deposits.push({
          participant,
          amount: amount.toString(),
          mptKey
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Failed to fetch deposit for ${participant}:`, errorMessage);
        // Include participant with 0 deposit and deterministic MPT key
        const hash = BigInt(`0x${Buffer.from(participant).toString('hex').slice(0, 64).padStart(64, '0')}`);
        const mptKey = (hash % BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE')).toString();
        
        deposits.push({
          participant,
          amount: '0',
          mptKey
        });
      }
    }

    // Prepare circuit input format (16 leaves required)
    const storageKeys: string[] = [];
    const storageValues: string[] = [];

    // Add actual deposits
    for (const deposit of deposits) {
      if (deposit.amount !== '0') {
        storageKeys.push(deposit.mptKey);
        storageValues.push(deposit.amount);
      }
    }

    // Fill remaining slots with zeros to reach 16 leaves
    while (storageKeys.length < 16) {
      storageKeys.push('0');
      storageValues.push('0');
    }

    // If we have more than 16, truncate (should not happen with current setup)
    if (storageKeys.length > 16) {
      storageKeys.splice(16);
      storageValues.splice(16);
    }

    return NextResponse.json({
      success: true,
      channelId,
      targetContract,
      participants: participants as string[],
      deposits,
      circuitInput: {
        storage_keys_L2MPT: storageKeys,
        storage_values: storageValues
      }
    });

  } catch (error) {
    console.error('Error fetching channel deposits with keys:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch channel deposits with keys',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
