import { useState, useEffect } from 'react';
import { useAccount, useContractReads } from 'wagmi';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

export function useUserRolesDynamic() {
  const { address, isConnected } = useAccount();
  const [hasChannels, setHasChannels] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalChannels, setTotalChannels] = useState(0);
  const [participatingChannels, setParticipatingChannels] = useState<number[]>([]);
  const [leadingChannels, setLeadingChannels] = useState<number[]>([]);
  const [channelStatsData, setChannelStatsData] = useState<Record<number, readonly [bigint, `0x${string}`, number, bigint, bigint, `0x${string}`] | null>>({});

  // First get the total number of channels
  const { data: totalChannelsData, isLoading: totalChannelsLoading } = useContractReads({
    contracts: [
      {
        address: ROLLUP_BRIDGE_ADDRESS,
        abi: ROLLUP_BRIDGE_ABI,
        functionName: 'getTotalChannels',
      }
    ],
    enabled: isConnected,
  });

  // Once we have total channels, create contract calls for checking channels dynamically
  const channelCount = totalChannelsData?.[0]?.result ? Number(totalChannelsData[0].result) : 0;

  // Create contract calls for the first 20 channels (reasonable limit)
  const maxChannelsToCheck = Math.min(channelCount, 20);
  const channelContracts = [];

  for (let i = 0; i < maxChannelsToCheck; i++) {
    // Get channel stats to check leadership
    channelContracts.push({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelStats',
      args: [BigInt(i)],
    });
    
    // Get channel participants to check participation
    channelContracts.push({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelParticipants',
      args: [BigInt(i)],
    });
  }

  const { data: channelData, isLoading: channelDataLoading } = useContractReads({
    contracts: channelContracts,
    enabled: isConnected && channelCount > 0,
  });

  useEffect(() => {
    if (!isConnected || !address || totalChannelsLoading || channelDataLoading) {
      setIsLoading(true);
      return;
    }

    if (channelCount === 0) {
      setHasChannels(false);
      setIsParticipant(false);
      setIsLoading(false);
      setTotalChannels(0);
      setParticipatingChannels([]);
      setLeadingChannels([]);
      return;
    }

    let foundLeadership = false;
    let foundParticipation = false;
    const participantChannels: number[] = [];
    const leaderChannels: number[] = [];
    const statsData: Record<number, readonly [bigint, `0x${string}`, number, bigint, bigint, `0x${string}`] | null> = {};

    console.log(`Total channels from contract: ${channelCount}, maxChannelsToCheck: ${maxChannelsToCheck}`);
    console.log(`Checking ${Math.min(channelCount, maxChannelsToCheck)} channels for user roles...`);

    // Process the channel data
    for (let i = 0; i < maxChannelsToCheck && i < channelCount; i++) {
      const statsIndex = i * 2;
      const participantsIndex = i * 2 + 1;
      
      const channelStats = channelData?.[statsIndex]?.result as readonly [bigint, `0x${string}`, number, bigint, bigint, `0x${string}`];
      const participants = channelData?.[participantsIndex]?.result as readonly string[];

      // Store channel stats data for later use
      statsData[i] = channelStats || null;

      console.log(`Channel ${i}:`, {
        statsIndex,
        participantsIndex,
        channelStats: channelStats ? {
          id: channelStats[0]?.toString(),
          targetContract: channelStats[1],
          state: channelStats[2],
          leader: channelStats[5]
        } : null,
        participants,
        userAddress: address
      });

      // Check leadership (index 5 is leader address)
      if (channelStats && channelStats[5] && channelStats[5].toLowerCase() === address.toLowerCase()) {
        foundLeadership = true;
        leaderChannels.push(i);
        console.log(`✅ User is leader of channel ${i}`);
      }

      // Check participation (user can be both leader in some channels and participant in others)
      if (participants && participants.includes(address)) {
        foundParticipation = true;
        participantChannels.push(i);
        console.log(`✅ User is participant in channel ${i}`);
      }
    }

    console.log(`Final results: hasChannels=${foundLeadership}, isParticipant=${foundParticipation && !foundLeadership}`);
    console.log(`Participating channels: ${participantChannels.join(', ')}`);
    console.log(`Leading channels: ${leaderChannels.join(', ')}`);
    
    setHasChannels(foundLeadership);
    setIsParticipant(foundParticipation && !foundLeadership);
    setTotalChannels(channelCount);
    setParticipatingChannels(participantChannels);
    setLeadingChannels(leaderChannels);
    setChannelStatsData(statsData);
    setIsLoading(false);
  }, [isConnected, address, channelData, channelCount, totalChannelsLoading, channelDataLoading, maxChannelsToCheck]);

  return {
    hasChannels,
    isParticipant,
    isLoading,
    totalChannels,
    participatingChannels,
    leadingChannels,
    channelStatsData,
  };
}