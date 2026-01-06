import { NextRequest, NextResponse } from 'next/server';
import { readContracts } from '@wagmi/core';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import '@/lib/wagmi-core';

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

    const resultData = await readContracts({
      contracts: [
        {
          address: ROLLUP_BRIDGE_CORE_ADDRESS,
          abi: ROLLUP_BRIDGE_CORE_ABI,
          functionName: 'getPreAllocatedLeaf',
          args: [targetContract as `0x${string}`, mptKey as `0x${string}`]
        }
      ]
    });

    const [value, exists] = (resultData?.[0]?.result as [bigint, boolean]) || [
      0n,
      false,
    ];

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
