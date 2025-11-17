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
    const participant = searchParams.get('participant');
    const token = searchParams.get('token');
    const channelId = searchParams.get('channelId');

    if (!participant || !token || !channelId) {
      return NextResponse.json(
        { error: 'Missing required parameters: participant, token, channelId' },
        { status: 400 }
      );
    }

    // Get L2 MPT key from contract
    const l2MptKey = await publicClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getL2MptKey',
      args: [BigInt(channelId), participant as `0x${string}`, token as `0x${string}`]
    });

    return NextResponse.json({
      success: true,
      key: l2MptKey?.toString() || '0',
      participant,
      token,
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