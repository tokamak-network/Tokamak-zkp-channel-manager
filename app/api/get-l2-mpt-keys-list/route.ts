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

    // Get all L2 MPT keys for the token from contract
    const result = await publicClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getL2MptKeysList',
      args: [BigInt(channelId), token as `0x${string}`]
    });

    const [participants, l2MptKeys] = result as [readonly `0x${string}`[], readonly bigint[]];

    // Convert bigints to strings and create a mapping
    const keyMap: { [participant: string]: string } = {};
    const keysList: Array<{ participant: string; key: string }> = [];

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const key = l2MptKeys[i]?.toString() || '0';
      keyMap[participant] = key;
      keysList.push({ participant, key });
    }

    return NextResponse.json({
      success: true,
      channelId,
      token,
      participants: participants as string[],
      l2MptKeys: l2MptKeys.map(key => key.toString()),
      keyMap,
      keysList
    });

  } catch (error) {
    console.error('Error fetching L2 MPT keys list:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch L2 MPT keys list',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}