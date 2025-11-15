import { useState, useEffect } from 'react';
import { useAccount, useContractRead, usePublicClient } from 'wagmi';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

// Custom hook to dynamically check user roles across all channels
export function useUserRoles() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [hasLeadership, setHasLeadership] = useState(false);
  const [hasParticipation, setHasParticipation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isConnected,
  });

  useEffect(() => {
    if (!isConnected || !address || !totalChannels || !publicClient) {
      setHasLeadership(false);
      setHasParticipation(false);
      setIsLoading(false);
      return;
    }

    const checkUserRoles = async () => {
      setIsLoading(true);
      let foundLeadership = false;
      let foundParticipation = false;
      const channelCount = Number(totalChannels);

      console.log(`Checking ${channelCount} channels for user roles...`);

      try {

        // Check each channel dynamically
        for (let channelId = 0; channelId < channelCount; channelId++) {
          try {
            // Check channel stats to see if user is leader
            const channelStats = await publicClient.readContract({
              address: ROLLUP_BRIDGE_ADDRESS,
              abi: ROLLUP_BRIDGE_ABI,
              functionName: 'getChannelStats',
              args: [BigInt(channelId)],
            }) as readonly [bigint, readonly `0x${string}`[], number, bigint, `0x${string}`];

            // Check if user is the leader (index 4 is leader address in new contract)
            if (channelStats[4] && channelStats[4].toLowerCase() === address.toLowerCase()) {
              foundLeadership = true;
              console.log(`User is leader of channel ${channelId}`);
            }

            // If not a leader, check if user is a participant
            if (!foundLeadership) {
              const participants = await publicClient.readContract({
                address: ROLLUP_BRIDGE_ADDRESS,
                abi: ROLLUP_BRIDGE_ABI,
                functionName: 'getChannelParticipants',
                args: [BigInt(channelId)],
              }) as readonly string[];

              if (participants && participants.includes(address)) {
                foundParticipation = true;
                console.log(`User is participant in channel ${channelId}`);
              }
            }

            // If we found leadership, we can break early
            if (foundLeadership) break;

          } catch (channelError) {
            console.error(`Error checking channel ${channelId}:`, channelError);
            // Continue to next channel
          }
        }

      } catch (error) {
        console.error('Error checking user roles:', error);
      }

      console.log(`Final results: hasLeadership=${foundLeadership}, hasParticipation=${foundParticipation && !foundLeadership}`);
      setHasLeadership(foundLeadership);
      setHasParticipation(foundParticipation && !foundLeadership);
      setIsLoading(false);
    };

    checkUserRoles();
  }, [isConnected, address, totalChannels, publicClient]);

  return {
    hasLeadership,
    hasParticipation,
    isLoading,
  };
}