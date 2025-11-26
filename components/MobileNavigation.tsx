'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useContractRead } from 'wagmi';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import { Home, PlusCircle, FileCheck, ArrowDownCircle, ArrowUpCircle, Settings, XCircle, Trash2, Activity } from 'lucide-react';

interface MobileNavigationProps {
  showMobileMenu: boolean;
  setShowMobileMenu: (show: boolean) => void;
}

export function MobileNavigation({ showMobileMenu, setShowMobileMenu }: MobileNavigationProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Anyone can create channels now - no authorization required
  const isAuthorized = true;

  // Get total number of channels to check leadership
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'nextChannelId',
    enabled: isConnected,
  });

  // Check if user is a channel leader by getting channel leaders
  const { data: channelLeader0 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(0)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: channelLeader1 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(1)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  // Check if user is a leader of any channels
  const hasChannels = address && (
    (channelLeader0 && String(channelLeader0).toLowerCase() === address.toLowerCase()) ||
    (channelLeader1 && String(channelLeader1).toLowerCase() === address.toLowerCase())
  );

  // Check if user is a participant (not leader) in channels
  const { data: participantsChannel0 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(0)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: participantsChannel1 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(1)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  // Check if user is participating in any channels (as participant, not leader)
  const isParticipant = address && (
    (participantsChannel0 && participantsChannel0.includes(address)) ||
    (participantsChannel1 && participantsChannel1.includes(address))
  ) && !hasChannels; // Participant but not leader

  const handleNavigation = (path: string) => {
    router.push(path);
    setShowMobileMenu(false);
  };

  if (!showMobileMenu) return null;

  return (
    <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="px-4 py-2 space-y-1">
        {/* Navigation Links */}
        <div
          onClick={() => handleNavigation('/')}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
        >
          <Home className="w-5 h-5" />
          <span className="font-medium">Home</span>
        </div>
        
        {isConnected && (
          <div
            onClick={() => handleNavigation('/dashboard')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <Activity className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </div>
        )}
        
        {isConnected && isAuthorized && !isParticipant && (
          <div 
            onClick={() => handleNavigation('/create-channel')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <PlusCircle className="w-5 h-5" />
            <span className="font-medium">Create Channel</span>
          </div>
        )}
        
        {isConnected && (isParticipant || hasChannels) && (
          <>
            <div 
              onClick={() => handleNavigation('/deposit-tokens')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <ArrowDownCircle className="w-5 h-5" />
              <span className="font-medium">Freeze State</span>
            </div>
            
            <div 
              onClick={() => handleNavigation('/withdraw-tokens')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <ArrowUpCircle className="w-5 h-5" />
              <span className="font-medium">Withdraw Tokens</span>
            </div>
          </>
        )}

        {/* Channel Leader Actions */}
        {isConnected && hasChannels && (
          <>
            <div 
              onClick={() => handleNavigation('/initialize-state')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">Initialize State</span>
            </div>
            
            <div
              onClick={() => handleNavigation('/submit-proof')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <FileCheck className="w-5 h-5" />
              <span className="font-medium">Submit Proof</span>
            </div>
            
            <div 
              onClick={() => handleNavigation('/close-channel')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Close Channel</span>
            </div>
            
            <div 
              onClick={() => handleNavigation('/delete-channel')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <Trash2 className="w-5 h-5" />
              <span className="font-medium">Delete Channel</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}