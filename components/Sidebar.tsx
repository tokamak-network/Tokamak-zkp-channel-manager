'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDisconnect, useAccount, useContractRead } from 'wagmi';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

interface SidebarProps {
  isConnected: boolean;
  onCollapse?: (isCollapsed: boolean) => void;
}

export function Sidebar({ isConnected, onCollapse }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { disconnect } = useDisconnect();
  const { address } = useAccount();
  const [isCollapsed, setIsCollapsed] = useState(false); // Will be set based on screen size
  const [isMounted, setIsMounted] = useState(false);

  // Set initial collapsed state based on screen size
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024; // lg breakpoint
      setIsCollapsed(isMobile);
      onCollapse?.(isMobile);
    };

    // Set initial state
    handleResize();
    setIsMounted(true);

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onCollapse]);

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
    // Create Channel - for authorized users (even if they are participants, but not if they're already leaders)
    if (isAuthorized && !hasChannels) {
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
          description: '',
          requiresConnection: true
        },
        {
          name: 'Withdraw Tokens',
          href: '/withdraw-tokens',
          icon: '💳',
          description: '',
          requiresConnection: true
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
        href: '/initialize-state',
        icon: '⚡',
        description: '',
        requiresConnection: true
      },
      {
        name: 'Submit Proof',
        href: '/submit-proof',
        icon: '📋',
        description: '',
        requiresConnection: true
      },
      {
        name: 'Sign Proof',
        href: '/sign-proof',
        icon: '✍️',
        description: '',
        requiresConnection: true
      },
      {
        name: 'Close Channel',
        href: '/close-channel',
        icon: '🔐',
        description: '',
        requiresConnection: true
      },
      {
        name: 'Delete Channel',
        href: '/delete-channel',
        icon: '🗑️',
        description: '',
        requiresConnection: true
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
        isCollapsed ? 'w-16 -translate-x-full lg:translate-x-0' : 'w-64 translate-x-0'
      } lg:translate-x-0`}>
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
            onClick={() => {
              const newCollapsed = !isCollapsed;
              setIsCollapsed(newCollapsed);
              onCollapse?.(newCollapsed);
            }}
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

        {/* GitHub Link */}
        <div className={`absolute ${isConnected ? 'bottom-36' : 'bottom-20'} left-4 right-4`}>
          <a
            href="https://github.com/tokamak-network/Tokamak-zkp-channel-manager"
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
            </svg>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm flex items-center gap-1">
                  GitHub Repository
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">View source code & contribute</div>
              </div>
            )}
          </a>
        </div>

        {/* Disconnect Button */}
        {isConnected && (
          <div className="absolute bottom-20 left-4 right-4">
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
          <div className="absolute bottom-4 left-4 right-4">
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
        onClick={() => {
          const newCollapsed = !isCollapsed;
          setIsCollapsed(newCollapsed);
          onCollapse?.(newCollapsed);
        }}
        className="fixed top-4 left-4 z-60 lg:hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg hover:shadow-xl transition-all duration-200"
      >
        <div className="flex flex-col gap-1">
          <span className={`block w-5 h-0.5 bg-gray-600 dark:bg-gray-300 transition-all duration-300 ${isCollapsed ? '' : 'rotate-45 translate-y-1.5'}`}></span>
          <span className={`block w-5 h-0.5 bg-gray-600 dark:bg-gray-300 transition-all duration-300 ${isCollapsed ? '' : 'opacity-0'}`}></span>
          <span className={`block w-5 h-0.5 bg-gray-600 dark:bg-gray-300 transition-all duration-300 ${isCollapsed ? '' : '-rotate-45 -translate-y-1.5'}`}></span>
        </div>
      </button>
    </>
  );
}