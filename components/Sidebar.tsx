'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAccount, useContractRead } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';
import { ClientOnly } from '@/components/ClientOnly';
import { NetworkDropdown } from '@/components/NetworkDropdown';
import { Home, PlusCircle, Key, ArrowDownCircle, ArrowUpCircle, Search, Settings, FileCheck, PenTool, Trash2, Activity, FileSignature, Unlock } from 'lucide-react';

interface SidebarProps {
  isConnected: boolean;
  onCollapse?: (isCollapsed: boolean) => void;
}

export function Sidebar({ isConnected, onCollapse }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { address } = useAccount();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Anyone can create channels now - no authorization required
  const isAuthorized = true;

  // Use the custom hook for dynamic channel leadership and participation checking
  const { hasChannels, isParticipant, isLoading: leadershipLoading } = useUserRolesDynamic();

  // Base navigation items
  const baseNavigation = [
    {
      name: 'Home',
      href: '/',
      icon: Home,
      description: 'Main navigation hub',
      requiresConnection: false
    },
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Activity,
      description: 'Account status and balances',
      requiresConnection: true
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
        icon: PlusCircle,
        description: 'Create private channel',
        requiresConnection: true
      });
    }

    // Deposit and Withdraw - available for both participants and leaders
    if (isParticipant || hasChannels) {
      userActions.push(
        {
          name: 'Freeze State',
          href: '/deposit-tokens',
          icon: ArrowDownCircle,
          description: '',
          requiresConnection: true
        },
        {
          name: 'Unfreeze State',
          href: '/unfreeze-state',
          icon: Unlock,
          description: 'Verify final balances and close channel',
          requiresConnection: true
        },
        {
          name: 'Withdraw Tokens',
          href: '/withdraw-tokens',
          icon: ArrowUpCircle,
          description: '',
          requiresConnection: true
        }
      );
    }
  }

  // Threshold Signature section - available for all connected users
  const thresholdSignatureActions = [];
  if (isConnected) {
    thresholdSignatureActions.push(
      {
        name: 'DKG Management',
        href: '/dkg-management',
        icon: Key,
        description: 'Key generation ceremonies',
        requiresConnection: true
      },
      {
        name: 'Signing',
        href: '/threshold-signing',
        icon: FileSignature,
        description: 'Threshold signature signing',
        requiresConnection: true
      }
    );
  }

  // Channel explorer actions - shown only when user has channels or is a participant
  const channelActions = [];
  if (isConnected && (hasChannels || isParticipant)) {
    channelActions.push({
      name: 'Channel Explorer',
      href: '/channel-explorer',
      icon: Search,
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
        icon: Settings,
        description: '',
        requiresConnection: true
      }
    );
  }

  // General actions for all connected users
  const generalActions = [];
  if (isConnected) {
    generalActions.push({
      name: 'Submit Proofs',
      href: '/submit-proof',
      icon: FileCheck,
      description: 'Submit proofs and signatures',
      requiresConnection: true
    });
  }

  const navigation = [...baseNavigation, ...userActions, ...channelActions, ...generalActions, ...leaderActions];

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

  const isActivePath = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Organize navigation into sections
  const navSections = [
    {
      title: 'Main',
      items: baseNavigation
    },
    ...(userActions.length > 0 ? [{
      title: 'Channel Actions',
      items: userActions
    }] : []),
    ...(thresholdSignatureActions.length > 0 ? [{
      title: 'Threshold Signature',
      items: thresholdSignatureActions
    }] : []),
    ...(channelActions.length > 0 ? [{
      title: 'Explorer',
      items: channelActions
    }] : []),
    ...(generalActions.length > 0 ? [{
      title: 'Channel Operations',
      items: generalActions
    }] : []),
    ...(leaderActions.length > 0 ? [{
      title: 'Leader Actions',
      items: leaderActions
    }] : [])
  ];

  return (
    <>
      {/* Sidebar - Always Visible on Desktop, Hidden on Mobile */}
      <div className="hidden lg:flex fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-[#0f1b2e] to-[#0a1218] border-r border-[#4fc3f7] z-50 flex-col shadow-2xl">
        {/* Logo Header */}
        <div className="px-6 py-8 border-b border-[#4fc3f7]/30 bg-gradient-to-r from-[#1a2347]/50 to-[#0a1930]/50">
          <div className="flex items-center justify-center cursor-pointer group" onClick={() => router.push('/')}>
            <Image 
              src="/assets/header/logo.svg" 
              alt="Tokamak Network" 
              width={240} 
              height={20}
              className="h-6 w-auto transition-all group-hover:scale-105"
            />
          </div>
          <div className="mt-3 text-center">
            <p className="text-xs text-[#4fc3f7] font-medium tracking-wide">ZK CHANNEL MANAGER</p>
          </div>
          
                  {/* Connect Wallet Button or Wallet Info */}
                  <div className="mt-6">
                    <ClientOnly>
                      {isConnected && address ? (
                        <div className="space-y-3">
                          {/* Wallet Address Display */}
                          <div className="bg-[#0a1930] border border-[#4fc3f7]/30 px-3 py-2">
                            <div className="text-xs text-gray-400 mb-1">Connected Wallet</div>
                            <div className="text-sm text-white font-mono flex items-center justify-between">
                              <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(address)}
                                className="text-[#4fc3f7] hover:text-white transition-colors"
                                title="Copy address"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Network Selection */}
                          <NetworkDropdown />
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <ConnectButton />
                        </div>
                      )}
                    </ClientOnly>
                  </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-5 overflow-y-auto custom-scrollbar">
          {navSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {/* Section Header */}
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {section.title}
                </h3>
              </div>
              
              {/* Section Items */}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = isActivePath(item.href);
                  const isDisabled = item.requiresConnection && !isConnected;
                  
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-200 group relative ${
                        isActive 
                          ? 'text-white' 
                          : isDisabled
                          ? 'text-gray-600 cursor-not-allowed opacity-40'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4fc3f7]"></div>
                      )}
                      
                      {/* Icon */}
                      <div className={`transition-colors ${isActive ? 'text-[#4fc3f7]' : 'text-gray-500 group-hover:text-[#4fc3f7]'}`}>
                        {typeof item.icon === 'string' ? (
                          <span className="text-sm">{item.icon}</span>
                        ) : (
                          <item.icon className="w-4 h-4" />
                        )}
                      </div>
                      
                      {/* Text content */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                          {item.name}
                        </div>
                        {item.description && (
                          <div className={`text-xs truncate mt-0.5 ${isActive ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-400'}`}>
                            {item.description}
                          </div>
                        )}
                      </div>
                      
                      {/* Hover indicator */}
                      {!isActive && !isDisabled && (
                        <div className="absolute inset-0 bg-[#4fc3f7]/0 group-hover:bg-[#4fc3f7]/5 transition-colors pointer-events-none"></div>
                      )}
                      
                      {/* Active background */}
                      {isActive && (
                        <div className="absolute inset-0 bg-[#4fc3f7]/10 pointer-events-none"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Section */}
        <div className="border-t border-[#4fc3f7]/30 bg-gradient-to-r from-[#1a2347]/30 to-[#0a1930]/30 p-4 space-y-2">
          {/* GitHub Link */}
          <a
            href="https://github.com/tokamak-network/Tokamak-zkp-channel-manager"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a2347]/50 border border-[#4fc3f7]/30 text-gray-300 hover:bg-[#4fc3f7]/10 hover:border-[#4fc3f7] hover:text-white transition-all duration-200 text-sm group"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">GitHub Repo</span>
          </a>
        </div>
      </div>
    </>
  );
}