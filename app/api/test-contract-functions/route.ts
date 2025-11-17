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
    const channelId = searchParams.get('channelId') || '0';

    console.log('Testing contract functions...');
    console.log('Contract address:', ROLLUP_BRIDGE_ADDRESS);
    console.log('Channel ID:', channelId);

    const results: any = {};

    // Test basic functions first
    try {
      const totalChannels = await publicClient.readContract({
        address: ROLLUP_BRIDGE_ADDRESS,
        abi: ROLLUP_BRIDGE_ABI,
        functionName: 'getTotalChannels'
      });
      results.totalChannels = totalChannels.toString();
      console.log('✓ getTotalChannels works:', totalChannels);
    } catch (error) {
      results.totalChannelsError = error.message;
      console.log('✗ getTotalChannels failed:', error.message);
    }

    // Test getChannelParticipants
    try {
      const participants = await publicClient.readContract({
        address: ROLLUP_BRIDGE_ADDRESS,
        abi: ROLLUP_BRIDGE_ABI,
        functionName: 'getChannelParticipants',
        args: [BigInt(channelId)]
      });
      results.participants = participants;
      console.log('✓ getChannelParticipants works:', participants);
    } catch (error) {
      results.participantsError = error.message;
      console.log('✗ getChannelParticipants failed:', error.message);
    }

    // Test getL2MptKey (individual)
    if (results.participants && results.participants.length > 0) {
      try {
        const participant = results.participants[0];
        const testToken = '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd';
        
        const l2MptKey = await publicClient.readContract({
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: 'getL2MptKey',
          args: [BigInt(channelId), participant, testToken]
        });
        results.l2MptKey = l2MptKey.toString();
        console.log('✓ getL2MptKey works:', l2MptKey);
      } catch (error) {
        results.l2MptKeyError = error.message;
        console.log('✗ getL2MptKey failed:', error.message);
      }
    }

    // Test getL2MptKeysList (bulk)
    try {
      const testToken = '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd';
      
      const keysList = await publicClient.readContract({
        address: ROLLUP_BRIDGE_ADDRESS,
        abi: ROLLUP_BRIDGE_ABI,
        functionName: 'getL2MptKeysList',
        args: [BigInt(channelId), testToken]
      });
      results.l2MptKeysList = keysList;
      console.log('✓ getL2MptKeysList works:', keysList);
    } catch (error) {
      results.l2MptKeysListError = error.message;
      console.log('✗ getL2MptKeysList failed:', error.message);
    }

    return NextResponse.json({
      success: true,
      contractAddress: ROLLUP_BRIDGE_ADDRESS,
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