import { useState, useEffect } from 'react';
import { useAccount, useContractReads } from 'wagmi';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

export function useUserRolesDynamic() {
  const { address, isConnected } = useAccount();
  const [hasChannels, setHasChannels] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalChannels, setTotalChannels] = useState(0);
  const [participatingChannels, setParticipatingChannels] = useState<number[]>([]);
  const [leadingChannels, setLeadingChannels] = useState<number[]>([]);
  const [channelStatsData, setChannelStatsData] = useState<Record<number, readonly [bigint, `0x${string}`, number, bigint, `0x${string}`] | null>>({});

  // Get total number of channels first
  const { data: totalChannelsData, isLoading: totalChannelsLoading } = useContractReads({
    contracts: [
      {
        address: ROLLUP_BRIDGE_CORE_ADDRESS,
        abi: ROLLUP_BRIDGE_CORE_ABI,
        functionName: 'nextChannelId',
      }
    ],
    enabled: isConnected,
  });

  // Get the actual channel count, fallback to checking first 10 if no data
  const channelCount = totalChannelsData?.[0]?.result ? Number(totalChannelsData[0].result) : 10;
  const maxChannelsToCheck = Math.min(channelCount, 20); // Reasonable limit
  const channelContracts = [];

  for (let i = 0; i < maxChannelsToCheck; i++) {
    // Get channel leader to check leadership
    channelContracts.push({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getChannelLeader',
      args: [BigInt(i)],
    });
    
    // Get channel participants to check participation
    channelContracts.push({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getChannelParticipants',
      args: [BigInt(i)],
    });

    // Get channel state for deposit page
    channelContracts.push({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getChannelState',
      args: [BigInt(i)],
    });

    // Get channel target contract (token) for deposit page
    channelContracts.push({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getChannelTargetContract',
      args: [BigInt(i)],
    });
  }

  const { data: channelData, isLoading: channelDataLoading } = useContractReads({
    contracts: channelContracts,
    enabled: isConnected,
  });

  useEffect(() => {
    if (!isConnected || !address || channelDataLoading || totalChannelsLoading) {
      setIsLoading(true);
      return;
    }


    let foundLeadership = false;
    let foundParticipation = false;
    const participantChannels: number[] = [];
    const leaderChannels: number[] = [];
    const statsData: Record<number, readonly [bigint, `0x${string}`, number, bigint, `0x${string}`] | null> = {};

    // Process the channel data
    let actualChannelCount = 0;
    for (let i = 0; i < maxChannelsToCheck; i++) {
      // Now we have 4 calls per channel: leader, participants, state, allowedTokens
      const leaderIndex = i * 4;
      const participantsIndex = i * 4 + 1;
      const stateIndex = i * 4 + 2;
      const allowedTokensIndex = i * 4 + 3;
      
      const leader = channelData?.[leaderIndex]?.result as string | undefined;
      const participants = channelData?.[participantsIndex]?.result as readonly string[] | undefined;
      const state = channelData?.[stateIndex]?.result as number | undefined;
      const targetContract = channelData?.[allowedTokensIndex]?.result as `0x${string}` | undefined;

      // Skip if channel doesn't exist (no leader returned or zero address)
      if (!leader || leader === '0x0000000000000000000000000000000000000000') {
        continue;
      }

      actualChannelCount++;

      // Populate stats data in the format expected by deposit page
      // Format: [bigint, `0x${string}`, number, bigint, `0x${string}`]
      // Index 0: Some bigint value (we'll use 0 as placeholder)
      // Index 1: targetContract (single token address)
      // Index 2: state (number)
      // Index 3: participant count as bigint
      // Index 4: leader address
      statsData[i] = [
        BigInt(0), // placeholder
        targetContract || '0x0000000000000000000000000000000000000000' as `0x${string}`,
        state || 0,
        BigInt(participants?.length || 0),
        leader as `0x${string}`
      ];

      // Check leadership
      const isLeader = leader && leader.toLowerCase() === address.toLowerCase();
      if (isLeader) {
        foundLeadership = true;
        leaderChannels.push(i);
      }

      // Check participation (user can be both leader in some channels and participant in others)
      const isParticipant = participants && participants.includes(address);
      if (isParticipant) {
        foundParticipation = true;
        participantChannels.push(i);
      }
    }

    setHasChannels(foundLeadership);
    setIsParticipant(foundParticipation && !foundLeadership);
    setTotalChannels(actualChannelCount);
    setParticipatingChannels(participantChannels);
    setLeadingChannels(leaderChannels);
    setChannelStatsData(statsData);
    setIsLoading(false);
  }, [isConnected, address, channelData, channelDataLoading, totalChannelsLoading, maxChannelsToCheck]);

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