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
    const token = searchParams.get('token');

    if (!channelId || !token) {
      return NextResponse.json(
        { error: 'Missing required parameters: channelId, token' },
        { status: 400 }
      );
    }

    // Get channel participants first
    const participants = await publicClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelParticipants',
      args: [BigInt(channelId)]
    }) as readonly string[];

    // Fetch all deposits and generate circuit inputs
    const deposits: Array<{ participant: string; amount: string; mptKey: string }> = [];
    
    for (const participant of participants) {
      try {
        const amount = await publicClient.readContract({
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: 'getParticipantTokenDeposit',
          args: [BigInt(channelId), participant as `0x${string}`, token as `0x${string}`]
        }) as bigint;

        // Generate deterministic MPT key based on participant and token
        // This is a temporary solution until the L2 MPT key functions are available on the contract
        const hash = BigInt(`0x${Buffer.from(participant + token).toString('hex').slice(0, 64).padStart(64, '0')}`);
        const mptKey = (hash % BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE')).toString();

        deposits.push({
          participant,
          amount: amount.toString(),
          mptKey
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Failed to fetch deposit for ${participant}:`, errorMessage);
        // Include participant with 0 deposit and deterministic MPT key
        const hash = BigInt(`0x${Buffer.from(participant + token).toString('hex').slice(0, 64).padStart(64, '0')}`);
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
      token,
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