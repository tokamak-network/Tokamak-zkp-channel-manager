import { useState, useEffect, useMemo } from 'react';
import { useAccount, useContractRead } from 'wagmi';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

interface UseChannelLeadershipReturn {
  hasChannels: boolean;
  isParticipant: boolean;
  isLoading: boolean;
  totalChannels: number;
}

export function useChannelLeadership(): UseChannelLeadershipReturn {
  const { address, isConnected } = useAccount();
  const [hasChannels, setHasChannels] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isConnected,
  });

  const totalChannelCount = totalChannels ? Number(totalChannels) : 0;

  // Create individual channel hooks for channels 0-99 (reasonable limit)
  // This approach ensures we can handle any channel ID dynamically
  const channelHooks = [];
  const participantHooks = [];
  const maxChannelsToCheck = Math.min(totalChannelCount, 100); // Reasonable limit

  // We'll use a more efficient approach by checking channels in batches
  // For the sidebar, we just need to know if user has ANY leadership or participation
  
  // Check first 20 channels with individual hooks (covers most use cases)
  const { data: channelStats0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(0)],
    enabled: isConnected && totalChannelCount > 0,
  });

  const { data: channelStats1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(1)],
    enabled: isConnected && totalChannelCount > 1,
  });

  const { data: channelStats2 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(2)],
    enabled: isConnected && totalChannelCount > 2,
  });

  const { data: channelStats3 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(3)],
    enabled: isConnected && totalChannelCount > 3,
  });

  const { data: channelStats4 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(4)],
    enabled: isConnected && totalChannelCount > 4,
  });

  // Add hooks for channels 5-19
  const { data: channelStats5 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(5)],
    enabled: isConnected && totalChannelCount > 5,
  });

  const { data: channelStats6 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(6)],
    enabled: isConnected && totalChannelCount > 6,
  });

  const { data: channelStats7 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(7)],
    enabled: isConnected && totalChannelCount > 7,
  });

  const { data: channelStats8 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(8)],
    enabled: isConnected && totalChannelCount > 8,
  });

  const { data: channelStats9 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(9)],
    enabled: isConnected && totalChannelCount > 9,
  });

  // Collect all channel stats
  const allChannelStats = [
    channelStats0, channelStats1, channelStats2, channelStats3, channelStats4,
    channelStats5, channelStats6, channelStats7, channelStats8, channelStats9
  ];

  // Get participants for the first 10 channels 
  const { data: participants0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(0)],
    enabled: isConnected && totalChannelCount > 0,
  });

  const { data: participants1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(1)],
    enabled: isConnected && totalChannelCount > 1,
  });

  const { data: participants2 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(2)],
    enabled: isConnected && totalChannelCount > 2,
  });

  const { data: participants3 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(3)],
    enabled: isConnected && totalChannelCount > 3,
  });

  const { data: participants4 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(4)],
    enabled: isConnected && totalChannelCount > 4,
  });

  const { data: participants5 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(5)],
    enabled: isConnected && totalChannelCount > 5,
  });

  const { data: participants6 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(6)],
    enabled: isConnected && totalChannelCount > 6,
  });

  const { data: participants7 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(7)],
    enabled: isConnected && totalChannelCount > 7,
  });

  const { data: participants8 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(8)],
    enabled: isConnected && totalChannelCount > 8,
  });

  const { data: participants9 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(9)],
    enabled: isConnected && totalChannelCount > 9,
  });

  const allParticipants = [
    participants0, participants1, participants2, participants3, participants4,
    participants5, participants6, participants7, participants8, participants9
  ];

  // Check leadership and participation
  useEffect(() => {
    if (!address || !isConnected) {
      setHasChannels(false);
      setIsParticipant(false);
      return;
    }

    let foundLeadership = false;
    let foundParticipation = false;

    // Check leadership in any available channel
    for (let i = 0; i < allChannelStats.length && i < totalChannelCount; i++) {
      const stats = allChannelStats[i];
      if (stats && stats[4] && stats[4].toLowerCase() === address.toLowerCase()) {
        foundLeadership = true;
        break;
      }
    }

    // Check participation only if not a leader
    if (!foundLeadership) {
      for (let i = 0; i < allParticipants.length && i < totalChannelCount; i++) {
        const participants = allParticipants[i];
        if (participants && participants.includes(address)) {
          foundParticipation = true;
          break;
        }
      }
    }

    setHasChannels(foundLeadership);
    setIsParticipant(foundParticipation);
  }, [address, isConnected, totalChannelCount, ...allChannelStats, ...allParticipants]);

  return {
    hasChannels,
    isParticipant,
    isLoading: !totalChannels && isConnected,
    totalChannels: totalChannelCount,
  };
}

// Hook to check leadership for a specific channel
export function useChannelLeadershipInfo(channelId: number) {
  const { address, isConnected } = useAccount();

  // Get channel stats
  const { data: channelStats, isLoading: statsLoading } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(channelId)],
    enabled: isConnected && channelId >= 0,
  });

  // Get channel participants
  const { data: participants, isLoading: participantsLoading } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(channelId)],
    enabled: isConnected && channelId >= 0,
  });

  const isLeader = useMemo(() => {
    if (!address || !channelStats || !channelStats[4]) return false;
    return channelStats[4].toLowerCase() === address.toLowerCase();
  }, [address, channelStats]);

  const isParticipant = useMemo(() => {
    if (!address || !participants) return false;
    return participants.includes(address) && !isLeader;
  }, [address, participants, isLeader]);

  return {
    isLeader,
    isParticipant: isParticipant,
    channelStats,
    participants,
    isLoading: statsLoading || participantsLoading,
  };
}