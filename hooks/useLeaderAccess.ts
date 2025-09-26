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

  const { data: channelStats3 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(3)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 3,
  });

  const { data: channelStats4 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(4)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 4,
  });

  const { data: channelStats5 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(5)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 5,
  });

  const { data: channelStats6 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(6)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 6,
  });

  const { data: channelStats7 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(7)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 7,
  });

  const { data: channelStats8 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(8)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 8,
  });

  const { data: channelStats9 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(9)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 9,
  });

  // Check if user is owner
  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  // Check if user is a channel leader
  const isLeader = address && (
    (channelStats0 && channelStats0[5] && channelStats0[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats1 && channelStats1[5] && channelStats1[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats2 && channelStats2[5] && channelStats2[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats3 && channelStats3[5] && channelStats3[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats4 && channelStats4[5] && channelStats4[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats5 && channelStats5[5] && channelStats5[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats6 && channelStats6[5] && channelStats6[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats7 && channelStats7[5] && channelStats7[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats8 && channelStats8[5] && channelStats8[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats9 && channelStats9[5] && channelStats9[5].toLowerCase() === address.toLowerCase())
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
    if (channelStats3 && channelStats3[5] && channelStats3[5].toLowerCase() === address.toLowerCase()) {
      return { id: 3, stats: channelStats3 };
    }
    if (channelStats4 && channelStats4[5] && channelStats4[5].toLowerCase() === address.toLowerCase()) {
      return { id: 4, stats: channelStats4 };
    }
    if (channelStats5 && channelStats5[5] && channelStats5[5].toLowerCase() === address.toLowerCase()) {
      return { id: 5, stats: channelStats5 };
    }
    if (channelStats6 && channelStats6[5] && channelStats6[5].toLowerCase() === address.toLowerCase()) {
      return { id: 6, stats: channelStats6 };
    }
    if (channelStats7 && channelStats7[5] && channelStats7[5].toLowerCase() === address.toLowerCase()) {
      return { id: 7, stats: channelStats7 };
    }
    if (channelStats8 && channelStats8[5] && channelStats8[5].toLowerCase() === address.toLowerCase()) {
      return { id: 8, stats: channelStats8 };
    }
    if (channelStats9 && channelStats9[5] && channelStats9[5].toLowerCase() === address.toLowerCase()) {
      return { id: 9, stats: channelStats9 };
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