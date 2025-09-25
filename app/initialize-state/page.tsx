'use client';

import React, { useState, useEffect } from 'react';
import { useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { MobileNavigation } from '@/components/MobileNavigation';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';

export default function InitializeStatePage() {
  const { address, isConnected, hasAccess, isMounted, leaderChannel: hookLeaderChannel } = useLeaderAccess();
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isMounted && isConnected,
  });

  // Get channel stats for each channel to find which ones the user leads
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


  // Initialize channel state transaction
  const { write: initializeChannelState, data: initializeData } = useContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'initializeChannelState',
  });

  const { isLoading: isInitializingTransaction, isSuccess: isInitializeSuccess } = useWaitForTransaction({
    hash: initializeData?.hash,
  });

  // Show success popup when transaction is successful
  useEffect(() => {
    if (isInitializeSuccess) {
      setShowSuccessPopup(true);
    }
  }, [isInitializeSuccess]);


  // Get participants for leader channel
  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: hookLeaderChannel ? [BigInt(hookLeaderChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!hookLeaderChannel,
  });

  // Get token info for leader channel
  const { data: tokenDecimals } = useContractRead({
    address: hookLeaderChannel?.stats?.[1] as `0x${string}`,
    abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'decimals',
    enabled: isMounted && isConnected && hookLeaderChannel?.stats?.[1] && isAddress(hookLeaderChannel.stats[1]) && hookLeaderChannel.stats[1] !== '0x0000000000000000000000000000000000000000',
  });

  const { data: tokenSymbol } = useContractRead({
    address: hookLeaderChannel?.stats?.[1] as `0x${string}`,
    abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'symbol',
    enabled: isMounted && isConnected && hookLeaderChannel?.stats?.[1] && isAddress(hookLeaderChannel.stats[1]) && hookLeaderChannel.stats[1] !== '0x0000000000000000000000000000000000000000',
  });

  // Get participant deposits for leader channel
  const { data: participantDeposits } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelDeposits',
    args: hookLeaderChannel ? [BigInt(hookLeaderChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!hookLeaderChannel,
  });

  // Get channel state name
  const getChannelStateName = (state: number) => {
    switch (state) {
      case 0: return 'None';
      case 1: return 'Initialized';
      case 2: return 'Open';
      case 3: return 'Active';
      case 4: return 'Closing';
      case 5: return 'Closed';
      default: return 'Unknown';
    }
  };

  const handleInitializeState = () => {
    if (hookLeaderChannel) {
      initializeChannelState({
        args: [BigInt(hookLeaderChannel.id)]
      });
    }
  };

  const isETH = !hookLeaderChannel?.stats?.[1] || hookLeaderChannel.stats[1] === '0x0000000000000000000000000000000000000000';
  const displayDecimals = isETH ? 18 : (tokenDecimals || 18);
  const displaySymbol = isETH ? 'ETH' : (typeof tokenSymbol === 'string' ? tokenSymbol : 'TOKEN');

  if (!isMounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <ClientOnly>
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>
      
      <div className={`flex-1 ml-0 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} flex flex-col min-h-screen transition-all duration-300`}>
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
          <div className="px-4 py-4 lg:px-6">
            <div className="flex items-center justify-between">
              <div className="hidden lg:flex items-center gap-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-orange-600 to-orange-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">⚡</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Initialize Channel State</h1>
              </div>
              <div className="flex items-center gap-3">
                <MobileMenuButton 
                  showMobileMenu={showMobileMenu} 
                  setShowMobileMenu={setShowMobileMenu} 
                />
                <ClientOnly>
                  <DarkModeToggle />
                </ClientOnly>
                <ClientOnly>
                  <ConnectButton />
                </ClientOnly>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Menu */}
        <MobileNavigation 
          showMobileMenu={showMobileMenu} 
          setShowMobileMenu={setShowMobileMenu} 
        />

        <main className="flex-1 p-4 sm:p-6">
          {!isConnected ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please connect your wallet to initialize channel state
              </p>
            </div>
          ) : !hasAccess ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚫</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This page is only accessible to channel leaders
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                You need to be a channel leader to initialize channel state
              </p>
            </div>
          ) : !hookLeaderChannel ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Channel to Initialize</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You don't have a channel in "Initialized" state that can be opened
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Create a new channel or wait for participants to deposit tokens in your existing channel
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
              {/* Channel Info */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  Channel {hookLeaderChannel.id} - Ready to Initialize
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Channel ID</div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{hookLeaderChannel.id}</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Current State</div>
                    <div className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">{getChannelStateName(hookLeaderChannel.stats[2])}</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Participants</div>
                    <div className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">{channelParticipants?.length || '0'}</div>
                  </div>
                </div>
              </div>

              {/* Participant Deposits Display */}
              {channelParticipants && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                    <span className="text-lg">👥</span>
                    <span className="hidden sm:inline">Channel {hookLeaderChannel.id} - </span>Participant Deposits
                  </h3>

                  <div className="space-y-2 sm:space-y-3">
                    {channelParticipants.map((participant: string, index: number) => {
                      const participantDeposit = participantDeposits?.[index];
                      return (
                        <div key={participant} className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-semibold text-xs sm:text-sm">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">Participant {index + 1}:</span>
                                </div>
                                <div className="font-mono text-xs sm:text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-2 sm:px-3 py-1 rounded border mt-1 break-all">
                                  {participant}
                                </div>
                              </div>
                            </div>
                            <div className="text-left sm:text-right ml-0 sm:ml-4">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Deposited Balance
                              </div>
                              <div className="font-bold text-base sm:text-lg text-green-700 dark:text-green-300">
                                {participantDeposit && typeof participantDeposit === 'bigint' ? 
                                  `${formatUnits(participantDeposit, displayDecimals)} ${displaySymbol}` : 
                                  '0.00 ' + displaySymbol
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total Summary */}
                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base">Total Channel Value</div>
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {channelParticipants.length} participants ready
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-lg sm:text-xl font-bold text-indigo-700 dark:text-indigo-300">
                          {participantDeposits ? 
                            `${formatUnits(
                              participantDeposits.reduce((sum: bigint, deposit: any) => 
                                sum + (typeof deposit === 'bigint' ? deposit : BigInt(0)), BigInt(0)
                              ),
                              displayDecimals
                            )} ${displaySymbol}` : 
                            '0.00'
                          }
                        </div>
                        <div className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400">
                          Total Value Locked
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit State & Open Channel Button */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                  <div className="text-center">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Ready to Initialize</h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
                      This action will compute the initial state root and open the channel for active operations
                    </p>
                    
                    <button
                      onClick={handleInitializeState}
                      disabled={isInitializingTransaction || hookLeaderChannel.stats[2] !== 1}
                      className={`px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white text-base sm:text-lg transition-all transform hover:scale-105 ${
                        isInitializingTransaction || hookLeaderChannel.stats[2] !== 1
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {isInitializingTransaction ? (
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Initializing State...
                        </div>
                      ) : hookLeaderChannel.stats[2] !== 1 ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{hookLeaderChannel.stats[2] >= 2 ? '✅' : '🚫'}</span>
                          {hookLeaderChannel.stats[2] >= 2 
                            ? `Channel Already Initialized (State: ${getChannelStateName(hookLeaderChannel.stats[2])})`
                            : `Channel Not Ready (State: ${getChannelStateName(hookLeaderChannel.stats[2])})`
                          }
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🚀</span>
                          Submit State & Open Channel
                        </div>
                      )}
                    </button>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 sm:mt-3">
                      This transaction will transition the channel from "Initialized" to "Open" state
                    </p>
                  </div>
                </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap justify-center gap-6 mb-6">
              <a href="https://x.com/Tokamak_Network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="font-medium">X (Twitter)</span>
              </a>
              <a href="https://www.tokamak.network/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span className="font-medium">Website</span>
              </a>
              <a href="https://medium.com/tokamak-network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
                </svg>
                <span className="font-medium">Medium</span>
              </a>
              <a href="https://discord.gg/J4chV2zuAK" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className="font-medium">Discord</span>
              </a>
              <a href="https://t.me/tokamak_network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span className="font-medium">Telegram</span>
              </a>
              <a href="https://www.linkedin.com/company/tokamaknetwork/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span className="font-medium">LinkedIn</span>
              </a>
            </div>
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p>&copy; 2025 Tokamak Network. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Channel Successfully Opened!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The channel state has been initialized and is now in an "Open" state. 
                From now on, all transactions should be managed directly from the channel itself.
              </p>
              <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-6">
                Channel {hookLeaderChannel?.id} is ready for active operations!
              </p>
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}