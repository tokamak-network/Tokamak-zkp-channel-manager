import { useState, useEffect, useMemo } from 'react';
import { useAccount, useContractRead } from 'wagmi';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';

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
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'nextChannelId',
    enabled: isConnected,
  });

  const totalChannelCount = totalChannels ? Number(totalChannels) : 0;

  // Check first 10 channel leaders (covers most use cases)
  const { data: channelLeader0 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(0)],
    enabled: isConnected && totalChannelCount > 0,
  });

  const { data: channelLeader1 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(1)],
    enabled: isConnected && totalChannelCount > 1,
  });

  const { data: channelLeader2 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(2)],
    enabled: isConnected && totalChannelCount > 2,
  });

  const { data: channelLeader3 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(3)],
    enabled: isConnected && totalChannelCount > 3,
  });

  const { data: channelLeader4 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(4)],
    enabled: isConnected && totalChannelCount > 4,
  });

  const { data: channelLeader5 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(5)],
    enabled: isConnected && totalChannelCount > 5,
  });

  const { data: channelLeader6 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(6)],
    enabled: isConnected && totalChannelCount > 6,
  });

  const { data: channelLeader7 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(7)],
    enabled: isConnected && totalChannelCount > 7,
  });

  const { data: channelLeader8 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(8)],
    enabled: isConnected && totalChannelCount > 8,
  });

  const { data: channelLeader9 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(9)],
    enabled: isConnected && totalChannelCount > 9,
  });

  // Collect all channel leaders
  const allChannelLeaders = [
    channelLeader0, channelLeader1, channelLeader2, channelLeader3, channelLeader4,
    channelLeader5, channelLeader6, channelLeader7, channelLeader8, channelLeader9
  ];

  // Get participants for the first 10 channels 
  const { data: participants0 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(0)],
    enabled: isConnected && totalChannelCount > 0,
  });

  const { data: participants1 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(1)],
    enabled: isConnected && totalChannelCount > 1,
  });

  const { data: participants2 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(2)],
    enabled: isConnected && totalChannelCount > 2,
  });

  const { data: participants3 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(3)],
    enabled: isConnected && totalChannelCount > 3,
  });

  const { data: participants4 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(4)],
    enabled: isConnected && totalChannelCount > 4,
  });

  const { data: participants5 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(5)],
    enabled: isConnected && totalChannelCount > 5,
  });

  const { data: participants6 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(6)],
    enabled: isConnected && totalChannelCount > 6,
  });

  const { data: participants7 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(7)],
    enabled: isConnected && totalChannelCount > 7,
  });

  const { data: participants8 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(8)],
    enabled: isConnected && totalChannelCount > 8,
  });

  const { data: participants9 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
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
    for (let i = 0; i < allChannelLeaders.length && i < totalChannelCount; i++) {
      const leader = allChannelLeaders[i];
      if (leader && leader.toLowerCase() === address.toLowerCase()) {
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
  }, [address, isConnected, totalChannelCount, ...allChannelLeaders, ...allParticipants]);

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

  // Get channel leader
  const { data: channelLeader, isLoading: leaderLoading } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(channelId)],
    enabled: isConnected && channelId >= 0,
  });

  // Get channel participants
  const { data: participants, isLoading: participantsLoading } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(channelId)],
    enabled: isConnected && channelId >= 0,
  });

  // Get channel state
  const { data: channelState, isLoading: stateLoading } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelState',
    args: [BigInt(channelId)],
    enabled: isConnected && channelId >= 0,
  });

  const isLeader = useMemo(() => {
    if (!address || !channelLeader) return false;
    return channelLeader.toLowerCase() === address.toLowerCase();
  }, [address, channelLeader]);

  const isParticipant = useMemo(() => {
    if (!address || !participants) return false;
    return participants.includes(address) && !isLeader;
  }, [address, participants, isLeader]);

  return {
    isLeader,
    isParticipant: isParticipant,
    channelLeader,
    channelState,
    participants,
    isLoading: leaderLoading || participantsLoading || stateLoading,
  };
}