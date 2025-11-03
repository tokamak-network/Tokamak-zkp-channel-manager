'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDisconnect, useAccount, useContractRead } from 'wagmi';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';

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

  // Use the custom hook for dynamic channel leadership and participation checking
  const { hasChannels, isParticipant, isLoading: leadershipLoading } = useUserRolesDynamic();

  // Base navigation items
  const baseNavigation = [
    {
      name: 'Home',
      href: '/',
      icon: '⌂',
      description: 'Dashboard and overview',
      requiresConnection: false
    },
    {
      name: 'State Explorer',
      href: '/state-explorer',
      icon: '📊',
      description: 'View session states and activity',
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
        icon: '+',
        description: 'Create multi-party bridge channel',
        requiresConnection: true
      });
    }

    // DKG Management - available for all connected users
    userActions.push({
      name: 'DKG Management',
      href: '/dkg-management',
      icon: '◆',
      description: 'Distributed Key Generation',
      requiresConnection: true
    });

    // Deposit and Withdraw - available for both participants and leaders
    if (isParticipant || hasChannels) {
      userActions.push(
        {
          name: 'Deposit Tokens',
          href: '/deposit-tokens',
          icon: '↓',
          description: '',
          requiresConnection: true
        },
        {
          name: 'Withdraw Tokens',
          href: '/withdraw-tokens',
          icon: '↑',
          description: '',
          requiresConnection: true
        }
      );
    }
  }

  // Channel explorer actions - shown only when user has channels or is a participant
  const channelActions = [];
  if (isConnected && (hasChannels || isParticipant)) {
    channelActions.push({
      name: 'Channel Explorer',
      href: '/channel-explorer',
      icon: '🔍',
      description: 'View all channels and activity',
      requiresConnection: true
    });
  }

  // Channel leader actions
  const leaderActions = [];
  if (isConnected && hasChannels) {
    leaderActions.push(
      {
        name: 'Initialize State',
        href: '/initialize-state',
        icon: '⚙',
        description: '',
        requiresConnection: true
      },
      {
        name: 'Submit Proof',
        href: '/submit-proof',
        icon: '▣',
        description: '',
        requiresConnection: true
      },
      {
        name: 'Sign Proof',
        href: '/sign-proof',
        icon: '✎',
        description: '',
        requiresConnection: true
      },
      {
        name: 'Close Channel',
        href: '/close-channel',
        icon: '⊗',
        description: '',
        requiresConnection: true
      },
      {
        name: 'Delete Channel',
        href: '/delete-channel',
        icon: '✕',
        description: '',
        requiresConnection: true
      }
    );
  }

  const navigation = [...baseNavigation, ...userActions, ...channelActions, ...leaderActions];

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
      <div className={`absolute top-0 left-0 h-full bg-black border-r-2 border-[#00FFFF] transition-all duration-300 z-50 m-0 p-0 ${
        isCollapsed ? 'w-16 -translate-x-full lg:translate-x-0' : 'w-64 translate-x-0'
      } lg:translate-x-0`}>
        {/* Neon glow line */}
        <div className="absolute top-0 right-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-[#00FFFF] to-transparent neon-border-cyan"></div>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#00FFFF]">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div 
                className="h-8 w-8 bg-black border-2 border-[#FFFF00] flex items-center justify-center neon-border-yellow"
                style={{ clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)' }}
              >
                <span className="text-[#FFFF00] font-bold text-sm pixel-font neon-glow-yellow">ZK</span>
              </div>
              <span className="font-semibold text-[#FFFF00] pixel-font neon-glow-yellow">Tokamak ZKP</span>
            </div>
          )}
          <button
            onClick={() => {
              const newCollapsed = !isCollapsed;
              setIsCollapsed(newCollapsed);
              onCollapse?.(newCollapsed);
            }}
            className="p-1 hover:bg-[#1A1A2E] transition-colors border-2 border-transparent hover:border-[#00FFFF] hover:neon-border-cyan"
            style={{ clipPath: 'polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)' }}
          >
            <span className="text-[#00FFFF] pixel-font neon-glow-cyan">{isCollapsed ? '→' : '←'}</span>
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
                style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'gap-3 px-3'} py-2 text-left transition-all border-2 ${
                  isActive 
                    ? 'bg-[#1A1A2E] text-[#FFFF00] border-[#FFFF00] neon-border-yellow' 
                    : isDisabled
                    ? 'text-gray-600 cursor-not-allowed border-transparent'
                    : 'text-[#00FFFF] hover:bg-[#1A1A2E] border-[#00FFFF] hover:border-[#FF00FF] hover:neon-border-pink hover:translate-x-[-2px]'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm truncate pixel-font ${isActive ? 'neon-glow-yellow' : ''}`}>{item.name}</div>
                    <div className="text-xs text-[#00FFFF] truncate">{item.description}</div>
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
            style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
            className={`w-full flex items-center gap-3 px-3 py-2 bg-[#1A1A2E] border-2 border-[#00FFFF] text-[#00FFFF] hover:bg-[#2A2A3E] hover:border-[#FF00FF] hover:neon-border-pink transition-all duration-200 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
            </svg>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm flex items-center gap-1 pixel-font">
                  GitHub Repo
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <div className="text-xs text-[#00FFFF] truncate">View source code</div>
              </div>
            )}
          </a>
        </div>

        {/* Disconnect Button */}
        {isConnected && (
          <div className="absolute bottom-20 left-4 right-4">
            <button
              onClick={handleDisconnect}
              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-[#FF1493] hover:bg-[#1A1A2E] border-2 border-transparent hover:border-[#FF1493] hover:neon-border-pink transition-all ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <span className="text-lg">🔌</span>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm pixel-font">Disconnect</div>
                  <div className="text-xs text-[#FF1493]">Disconnect wallet</div>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Connection Status */}
        {!isCollapsed && (
          <div className="absolute bottom-4 left-4 right-4">
            <div 
              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
              className={`px-3 py-2 text-xs border-2 ${
                isConnected 
                  ? 'bg-[#1A1A2E] text-[#00FF00] border-[#00FF00]' 
                  : 'bg-[#1A1A2E] text-[#FFFF00] border-[#FFFF00] neon-border-yellow'
              }`}
            >
              <div className={`font-medium pixel-font ${isConnected ? '' : 'neon-glow-yellow'}`}>
                {isConnected ? 'Wallet Connected' : 'Not Connected'}
              </div>
              <div className="text-[#00FFFF] text-xs">
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
        style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
        className="absolute top-4 left-4 z-60 lg:hidden bg-[#1A1A2E] border-2 border-[#00FFFF] p-3 neon-border-cyan hover:border-[#FF00FF] transition-all duration-200"
      >
        <div className="flex flex-col gap-1">
          <span className={`block w-5 h-0.5 bg-[#C8EDFF] transition-all duration-300 ${isCollapsed ? '' : 'rotate-45 translate-y-1.5'}`}></span>
          <span className={`block w-5 h-0.5 bg-[#C8EDFF] transition-all duration-300 ${isCollapsed ? '' : 'opacity-0'}`}></span>
          <span className={`block w-5 h-0.5 bg-[#C8EDFF] transition-all duration-300 ${isCollapsed ? '' : '-rotate-45 -translate-y-1.5'}`}></span>
        </div>
      </button>
    </>
  );
}