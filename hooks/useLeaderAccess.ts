import { useState, useEffect } from 'react';
import { useAccount, useContractRead } from 'wagmi';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';

export function useLeaderAccess() {
  const { address, isConnected } = useAccount();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use the working dynamic hook instead
  const { hasChannels, leadingChannels, channelStatsData } = useUserRolesDynamic();


  // Get contract owner from Core contract
  const { data: owner } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'owner',
    enabled: isMounted && isConnected && !!address,
  });

  // Check if user is owner
  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  // Use the dynamic hook data for leader detection
  const isLeader = hasChannels;

  // Get the channel the user leads (if any) 
  const getLeaderChannel = () => {
    if (!address || !leadingChannels || leadingChannels.length === 0) return null;
    
    const firstLeadingChannelId = leadingChannels[0];
    const stats = channelStatsData[firstLeadingChannelId];
    
    return stats ? { id: firstLeadingChannelId, stats } : null;
  };

  const leaderChannel = getLeaderChannel();

  const hasAccess = isConnected && (isLeader || false);
  const hasOwnerAccess = isConnected && (isLeader || isOwner);


  return {
    isMounted,
    isConnected,
    address,
    isOwner,
    isLeader,
    leaderChannel,
    hasAccess, // Only leaders have access (owner separate for delete)
    hasOwnerAccess, // Leaders and owner have access
  };
}