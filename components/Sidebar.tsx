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
      const isMobile = window.innerWidth < 1200; // xl breakpoint (1200px)
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

  // Anyone can create channels now - no authorization required
  const isAuthorized = true;

  // Use the custom hook for dynamic channel leadership and participation checking
  const { hasChannels, isParticipant, isLoading: leadershipLoading } = useUserRolesDynamic();

  // Base navigation items
  const baseNavigation = [
    {
      name: 'Home',
      href: '/',
      icon: '⌂',
      requiresConnection: false
    },
    {
      name: 'State Explorer',
      href: '/state-explorer',
      icon: '📊',
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
        requiresConnection: true
      });
    }

    // DKG Management - available for all connected users
    userActions.push({
      name: 'DKG Management',
      href: '/dkg-management',
      icon: '🔑',
      requiresConnection: true
    });

    // Deposit and Withdraw - available for both participants and leaders
    if (isParticipant || hasChannels) {
      userActions.push(
        {
          name: 'Deposit Tokens',
          href: '/deposit-tokens',
          icon: '💰',
          requiresConnection: true
        },
        {
          name: 'Withdraw Tokens',
          href: '/withdraw-tokens',
          icon: '💳',
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
        icon: '⚡',
        requiresConnection: true
      },
      {
        name: 'Submit Proof',
        href: '/submit-proof',
        icon: '📋',
        requiresConnection: true
      },
      {
        name: 'Sign Proof',
        href: '/sign-proof',
        icon: '✎',
        requiresConnection: true
      },
      {
        name: 'Close Channel',
        href: '/close-channel',
        icon: '⊗',
        requiresConnection: true
      },
      {
        name: 'Delete Channel',
        href: '/delete-channel',
        icon: '✕',
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
          className="fixed inset-0 bg-black bg-opacity-50 z-40 xl:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <div className={`absolute top-0 left-0 h-full bg-black border-r-2 border-gray-800 transition-all duration-300 z-50 m-0 p-0 ${
        isCollapsed ? 'w-16 -translate-x-full xl:translate-x-0' : 'w-64 translate-x-0'
      } xl:translate-x-0`}>
        {/* Subtle glow line */}
        <div className="absolute top-0 right-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-gray-600 to-transparent"></div>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-6">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div 
                className="h-8 w-8 flex items-center justify-center p-1"
              >
                <img 
                  src="/images/logo/tokamak-logo.svg" 
                  alt="Tokamak Logo"
                  className="w-full h-full"
                  style={{
                    filter: 'drop-shadow(0 0 3px #2A72E5) drop-shadow(0 0 5px #2A72E5)'
                  }}
                />
              </div>
              <span className="font-bold arcade-font text-gray-300 text-xs">Tokamak Network</span>
            </div>
          )}
          <button
            onClick={() => {
              const newCollapsed = !isCollapsed;
              setIsCollapsed(newCollapsed);
              onCollapse?.(newCollapsed);
            }}
            className="p-1 hover:bg-[#1A1A2E] transition-colors border-2 border-transparent hover:border-gray-500"
            style={{ clipPath: 'polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)' }}
          >
            <span className="text-gray-400 arcade-font text-xs">{isCollapsed ? '→' : '←'}</span>
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
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-4' : 'gap-3 px-4'} py-3 text-left transition-all border-2 ${
                  isActive 
                    ? 'bg-white text-black border-white' 
                    : isDisabled
                    ? 'text-gray-600 cursor-not-allowed border-transparent'
                    : 'text-gray-400 hover:bg-[#1A1A2E] border-transparent hover:border-gray-400 hover:text-white hover:translate-x-[-2px]'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {!isCollapsed && (
                  <div className={`font-bold text-sm truncate arcade-font`}>
                    {item.name}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* GitHub Link */}
        <div className={`absolute ${isConnected ? 'bottom-28' : 'bottom-16'} left-4 right-4`}>
          <a
            href="https://github.com/tokamak-network/Tokamak-zkp-channel-manager"
            target="_blank"
            rel="noopener noreferrer"
            style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
            className={`w-full flex items-center gap-4 px-4 py-3 bg-black border-2 border-b-0 border-[#95A5A6] text-[#95A5A6] hover:bg-[#1A1A2E] hover:border-[#B0BEC5] hover:text-[#B0BEC5] transition-all duration-200 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <span className="text-xl">⚙</span>
            {!isCollapsed && (
              <div className="font-bold text-sm arcade-font truncate">
                GITHUB
              </div>
            )}
          </a>
        </div>

        {/* Disconnect Button */}
        {isConnected && (
          <div className="absolute bottom-16 left-4 right-4">
            <button
              onClick={handleDisconnect}
              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
              className={`w-full flex items-center gap-4 px-4 py-3 bg-black text-[#808080] hover:bg-[#1A1A2E] border-2 border-b-0 border-[#808080] hover:border-[#95A5A6] hover:text-[#95A5A6] transition-all ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <span className="text-xl">⊗</span>
              {!isCollapsed && (
                <div className="font-bold text-sm arcade-font truncate">
                  DISCONNECT
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
              className={`px-4 py-3 text-center border-2 ${
                isConnected 
                  ? 'bg-black border-[#00FF88] neon-border-green' 
                  : 'bg-black border-[#808080]'
              }`}
            >
              <div className={`font-bold arcade-font text-sm ${
                isConnected ? 'text-[#00FF88]' : 'text-[#808080]'
              }`}>
                {isConnected ? '● ONLINE' : '○ OFFLINE'}
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
        className="absolute top-4 left-4 z-60 xl:hidden bg-[#1A1A2E] border-2 border-gray-700 p-3 hover:border-gray-500 transition-all duration-200"
      >
        <div className="flex flex-col gap-1">
          <span className={`block w-5 h-0.5 bg-gray-400 transition-all duration-300 ${isCollapsed ? '' : 'rotate-45 translate-y-1.5'}`}></span>
          <span className={`block w-5 h-0.5 bg-gray-400 transition-all duration-300 ${isCollapsed ? '' : 'opacity-0'}`}></span>
          <span className={`block w-5 h-0.5 bg-gray-400 transition-all duration-300 ${isCollapsed ? '' : '-rotate-45 -translate-y-1.5'}`}></span>
        </div>
      </button>
    </>
  );
}