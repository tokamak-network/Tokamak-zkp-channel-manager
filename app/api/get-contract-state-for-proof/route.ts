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

    if (!channelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: channelId' },
        { status: 400 }
      );
    }

    // Get channel info
    const channelStats = await publicClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelInfo',
      args: [BigInt(channelId)]
    }) as readonly [readonly string[], number, bigint, string];

    const [allowedTokens, state, participantCount, initialRoot] = channelStats;
    
    // Get leader separately
    const leader = await publicClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelLeader',
      args: [BigInt(channelId)]
    }) as string;

    // Get channel participants
    const participants = await publicClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelParticipants',
      args: [BigInt(channelId)]
    }) as readonly string[];

    // Build the state data exactly as the contract does
    const stateData: Array<{ participant: string; token: string; l2MptKey: string; balance: string; entryIndex: number }> = [];
    const storageKeys: string[] = [];
    const storageValues: string[] = [];

    let entryIndex = 0;
    // Iterate exactly as the contract does: for each participant, for each token
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      
      for (let j = 0; j < allowedTokens.length; j++) {
        const token = allowedTokens[j];
        try {
          // Get balance from contract
          const balance = await publicClient.readContract({
            address: ROLLUP_BRIDGE_ADDRESS,
            abi: ROLLUP_BRIDGE_ABI,
            functionName: 'getParticipantTokenDeposit',
            args: [BigInt(channelId), participant as `0x${string}`, token as `0x${string}`]
          }) as bigint;

          // Get L2 MPT keys using bulk function
          let l2MptKey = '0';
          try {
            // TODO: Fix function signature mismatch
            // const l2MptKeyResult = await publicClient.readContract({
            //   address: ROLLUP_BRIDGE_ADDRESS,
            //   abi: ROLLUP_BRIDGE_ABI,
            //   functionName: 'getL2MptKey',
            //   args: [BigInt(channelId), participant as `0x${string}`, token as `0x${string}`]
            // }) as bigint;
            const participantsList = participants;
            const l2MptKeys = [BigInt(0)]; // Placeholder

            // Find this participant's L2 MPT key
            const participantIndex = participantsList.findIndex(p => p.toLowerCase() === participant.toLowerCase());
            if (participantIndex >= 0 && l2MptKeys[participantIndex]) {
              l2MptKey = l2MptKeys[participantIndex].toString();
            }
          } catch (keyError) {
            const errorMessage = keyError instanceof Error ? keyError.message : 'Unknown error';
            console.warn(`Could not fetch L2 MPT keys list for token ${token}:`, errorMessage);
            // Fallback to individual key fetch
            if (balance > BigInt(0)) {
              try {
                const key = await publicClient.readContract({
                  address: ROLLUP_BRIDGE_ADDRESS,
                  abi: ROLLUP_BRIDGE_ABI,
                  functionName: 'getL2MptKey',
                  args: [BigInt(channelId), participant as `0x${string}`, token as `0x${string}`]
                }) as bigint;
                l2MptKey = key.toString();
              } catch (individualKeyError) {
                console.error(`Balance exists but no L2 MPT key available for ${participant}:${token}`);
              }
            }
          }

          stateData.push({
            participant,
            token,
            l2MptKey,
            balance: balance.toString(),
            entryIndex
          });

          storageKeys.push(l2MptKey);
          storageValues.push(balance.toString());
          entryIndex++;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`Error fetching data for ${participant}:${token}:`, errorMessage);
          // Add zero entry
          stateData.push({
            participant,
            token,
            l2MptKey: '0',
            balance: '0',
            entryIndex
          });
          storageKeys.push('0');
          storageValues.push('0');
          entryIndex++;
        }
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
        allowedTokens: allowedTokens as string[],
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