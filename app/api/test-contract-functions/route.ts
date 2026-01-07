import { NextRequest, NextResponse } from 'next/server';
import { readContracts } from '@wagmi/core';
import type { Address } from 'viem';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import '@/lib/wagmi-core';

export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId') || '0';

    console.log('Testing contract functions...');
    console.log('Contract address:', ROLLUP_BRIDGE_CORE_ADDRESS);
    console.log('Channel ID:', channelId);

    const results: any = {};

    // Test basic functions first
    try {
      const totalChannelsData = await readContracts({
        contracts: [
          {
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: 'getTotalChannels'
          }
        ]
      });
      const totalChannels = totalChannelsData?.[0]?.result as bigint;
      results.totalChannels = totalChannels.toString();
      console.log('✓ totalChannels works:', totalChannels);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.totalChannelsError = errorMessage;
      console.log('✗ totalChannels failed:', errorMessage);
    }

    // Test getChannelParticipants
    try {
      const participantsData = await readContracts({
        contracts: [
          {
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: 'getChannelParticipants',
            args: [BigInt(channelId)]
          }
        ]
      });
      const participants = participantsData?.[0]?.result as readonly Address[];
      results.participants = participants;
      console.log('✓ getChannelParticipants works:', participants);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.participantsError = errorMessage;
      console.log('✗ getChannelParticipants failed:', errorMessage);
    }

    // Test getL2MptKey (individual)
    if (results.participants && results.participants.length > 0) {
      try {
        const participant = results.participants[0];
        const testToken = '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd';
        
        const l2MptKeyData = await readContracts({
          contracts: [
            {
              address: ROLLUP_BRIDGE_CORE_ADDRESS,
              abi: ROLLUP_BRIDGE_CORE_ABI,
              functionName: 'getL2MptKey',
              args: [BigInt(channelId), participant]
            }
          ]
        });
        const l2MptKey = l2MptKeyData?.[0]?.result as bigint;
        results.l2MptKey = l2MptKey.toString();
        console.log('✓ getL2MptKey works:', l2MptKey);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.l2MptKeyError = errorMessage;
        console.log('✗ getL2MptKey failed:', errorMessage);
      }
    }

    // Test getL2MptKey (bulk) - requires all 3 parameters
    if (results.participants && results.participants.length > 0) {
      try {
        const testToken = '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd';
        const participant = results.participants[0];
        
        const keysListData = await readContracts({
          contracts: [
            {
              address: ROLLUP_BRIDGE_CORE_ADDRESS,
              abi: ROLLUP_BRIDGE_CORE_ABI,
              functionName: 'getL2MptKey',
              args: [BigInt(channelId), participant]
            }
          ]
        });
        const keysList = keysListData?.[0]?.result as bigint;
        results.l2MptKeysList = keysList.toString();
        console.log('✓ getL2MptKey (bulk) works:', keysList);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.l2MptKeysListError = errorMessage;
        console.log('✗ getL2MptKey (bulk) failed:', errorMessage);
      }
    }

    return NextResponse.json({
      success: true,
      contractAddress: ROLLUP_BRIDGE_CORE_ADDRESS,
      channelId,
      results
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
