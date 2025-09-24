'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDisconnect, useAccount, useContractRead } from 'wagmi';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

interface SidebarProps {
  isConnected: boolean;
}

export function Sidebar({ isConnected }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { disconnect } = useDisconnect();
  const { address } = useAccount();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Check if user is authorized to create channels
  const { data: isAuthorized } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'isAuthorizedCreator',
    args: address ? [address] : undefined,
    enabled: isConnected && !!address,
  });

  // Get total number of channels to check leadership
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isConnected,
  });

  // Check if user is a channel leader by getting channel stats
  const { data: channelStats0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(0)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: channelStats1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(1)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  // Check if user is a leader of any channels
  const hasChannels = address && (
    (channelStats0 && channelStats0[5] && channelStats0[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats1 && channelStats1[5] && channelStats1[5].toLowerCase() === address.toLowerCase())
  );

  // Check if user is a participant (not leader) in channels
  const { data: participantsChannel0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(0)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: participantsChannel1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(1)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  // Check if user is participating in any channels (as participant, not leader)
  const isParticipant = address && (
    (participantsChannel0 && participantsChannel0.includes(address)) ||
    (participantsChannel1 && participantsChannel1.includes(address))
  ) && !hasChannels; // Participant but not leader

  // Base navigation items
  const baseNavigation = [
    {
      name: 'Home',
      href: '/',
      icon: '🏠',
      description: 'Dashboard and overview',
      requiresConnection: false
    },
  ];

  // User action items (shown when connected)
  const userActions = [];
  if (isConnected) {
    // Create Channel - only for authorized users who are not just participants
    if (isAuthorized && !isParticipant) {
      userActions.push({
        name: 'Create Channel',
        href: '/create-channel',
        icon: '⚒',
        description: 'Create multi-party bridge channel',
        requiresConnection: true
      });
    }

    // Deposit and Withdraw - always available when connected (for both participants and leaders)
    if (isParticipant || hasChannels) {
      userActions.push(
        {
          name: 'Deposit Tokens',
          href: '/deposit-tokens',
          icon: '💰',
          description: 'Deposit ETH and ERC20 tokens',
          requiresConnection: true
        },
        {
          name: 'Withdraw Tokens',
          href: '#',
          icon: '💳',
          description: 'Withdraw from closed channel',
          requiresConnection: true,
          onClick: () => console.log('Withdraw tokens clicked')
        }
      );
    }
  }

  // Channel leader actions
  const leaderActions = [];
  if (isConnected && hasChannels) {
    leaderActions.push(
      {
        name: 'Initialize State',
        href: '#',
        icon: '⚡',
        description: 'Initialize channel state',
        requiresConnection: true,
        onClick: () => console.log('Initialize state clicked')
      },
      {
        name: 'Submit Proof',
        href: '#',
        icon: '📋',
        description: 'Submit aggregated proof',
        requiresConnection: true,
        onClick: () => console.log('Submit proof clicked')
      },
      {
        name: 'Sign Proof',
        href: '#',
        icon: '✍️',
        description: 'Sign aggregated proof',
        requiresConnection: true,
        onClick: () => console.log('Sign proof clicked')
      },
      {
        name: 'Close Channel',
        href: '#',
        icon: '🔐',
        description: 'Close the channel',
        requiresConnection: true,
        onClick: () => console.log('Close channel clicked')
      },
      {
        name: 'Delete Channel',
        href: '#',
        icon: '🗑️',
        description: 'Delete the channel',
        requiresConnection: true,
        onClick: () => console.log('Delete channel clicked')
      }
    );
  }

  const navigation = [...baseNavigation, ...userActions, ...leaderActions];

  const handleNavigation = (item: any) => {
    if (item.requiresConnection && !isConnected) {
      return;
    }
    if (item.onClick) {
      item.onClick();
    } else if (item.href !== '#') {
      router.push(item.href);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const isActivePath = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-50 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">ZK</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Tokamak ZK</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-gray-600 dark:text-gray-300">{isCollapsed ? '→' : '←'}</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = isActivePath(item.href);
            const isDisabled = item.requiresConnection && !isConnected;
            
            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700' 
                    : isDisabled
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Disconnect Button */}
        {isConnected && (
          <div className="absolute bottom-4 left-4 right-4">
            <button
              onClick={handleDisconnect}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <span className="text-lg">🔌</span>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">Disconnect</div>
                  <div className="text-xs text-red-500 dark:text-red-400">Disconnect wallet</div>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Connection Status */}
        {!isCollapsed && (
          <div className={`absolute ${isConnected ? 'bottom-20' : 'bottom-4'} left-4 right-4`}>
            <div className={`px-3 py-2 rounded-lg text-xs ${
              isConnected 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700'
            }`}>
              <div className="font-medium">
                {isConnected ? 'Wallet Connected' : 'Wallet Not Connected'}
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                {isConnected ? 'Ready to interact' : 'Connect to continue'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toggle button for mobile */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="fixed top-4 left-4 z-60 lg:hidden bg-white border border-gray-200 rounded-lg p-2 shadow-sm"
      >
        <span className="text-gray-600">☰</span>
      </button>
    </>
  );
}