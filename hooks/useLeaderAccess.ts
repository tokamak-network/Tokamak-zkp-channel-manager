import { useState, useEffect } from 'react';
import { useAccount, useContractRead } from 'wagmi';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

export function useLeaderAccess() {
  const { address, isConnected } = useAccount();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Get contract owner
  const { data: owner } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'owner',
    enabled: isMounted && isConnected,
  });

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isMounted && isConnected,
  });

  // Get channel stats for each channel to check leadership
  const { data: channelStats0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(0)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: channelStats1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(1)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  const { data: channelStats2 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(2)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 2,
  });

  // Check if user is owner
  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  // Check if user is a channel leader
  const isLeader = address && (
    (channelStats0 && channelStats0[5] && channelStats0[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats1 && channelStats1[5] && channelStats1[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats2 && channelStats2[5] && channelStats2[5].toLowerCase() === address.toLowerCase())
  );

  // Get the channel the user leads (if any)
  const getLeaderChannel = () => {
    if (!address) return null;
    
    if (channelStats0 && channelStats0[5] && channelStats0[5].toLowerCase() === address.toLowerCase()) {
      return { id: 0, stats: channelStats0 };
    }
    if (channelStats1 && channelStats1[5] && channelStats1[5].toLowerCase() === address.toLowerCase()) {
      return { id: 1, stats: channelStats1 };
    }
    if (channelStats2 && channelStats2[5] && channelStats2[5].toLowerCase() === address.toLowerCase()) {
      return { id: 2, stats: channelStats2 };
    }
    
    return null;
  };

  const leaderChannel = getLeaderChannel();

  return {
    isMounted,
    isConnected,
    address,
    isOwner,
    isLeader,
    leaderChannel,
    hasAccess: isConnected && (isLeader || false), // Only leaders have access (owner separate for delete)
    hasOwnerAccess: isConnected && (isLeader || isOwner), // Leaders and owner have access
  };
}