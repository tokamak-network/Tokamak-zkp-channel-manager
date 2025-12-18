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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetContract = searchParams.get('targetContract');
    const mptKey = searchParams.get('mptKey');

    if (!targetContract || !mptKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: targetContract, mptKey' },
        { status: 400 }
      );
    }

    const result = await publicClient.readContract({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getPreAllocatedLeaf',
      args: [targetContract as `0x${string}`, mptKey as `0x${string}`]
    });

    const [value, exists] = result as [bigint, boolean];

    return NextResponse.json({
      success: true,
      value: value?.toString() || '0',
      exists: exists || false,
      targetContract,
      mptKey
    });

  } catch (error) {
    console.error('Error fetching pre-allocated leaf:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch pre-allocated leaf',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
