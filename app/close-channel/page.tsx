'use client';

import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { MobileNavigation } from '@/components/MobileNavigation';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { ETH_TOKEN_ADDRESS } from '@/lib/contracts';

export default function CloseChannelPage() {
  const { isConnected, hasAccess, isMounted, leaderChannel } = useLeaderAccess();
  const { address } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Channel information
  const { data: channelInfo } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelInfo',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  const { data: channelTimeoutInfo } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelTimeoutInfo',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  const { data: isChannelReadyToClose } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'isChannelReadyToClose',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  const { data: channelDeposits } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelDeposits',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });

  // Get token information for the channel
  const tokenAddress = channelInfo?.[0] as `0x${string}` | undefined; // targetContract from getChannelInfo
  const participantCount = channelInfo?.[2] ? Number(channelInfo[2]) : 0;
  
  const { data: tokenInfo } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'debugTokenInfo',
    args: tokenAddress && address ? [tokenAddress, address] : undefined,
    enabled: Boolean(tokenAddress && address)
  });
  
  // Extract token metadata
  const tokenSymbol = tokenInfo?.[5] || 'TOKEN';
  const tokenDecimals = tokenInfo?.[6] || 18;
  const isETH = tokenAddress === ETH_TOKEN_ADDRESS;
  
  // Helper function to get channel state display name
  const getChannelStateDisplay = (stateNumber: number) => {
    const states = {
      0: 'None',
      1: 'Initialized', 
      2: 'Open',
      3: 'Active',
      4: 'Closing',
      5: 'Closed'
    };
    return states[stateNumber as keyof typeof states] || 'Unknown';
  };

  // Get channel state colors
  const getChannelStateColor = (stateNumber: number) => {
    const colors = {
      0: 'text-gray-500 dark:text-gray-400',        // None
      1: 'text-blue-600 dark:text-blue-400',        // Initialized  
      2: 'text-green-600 dark:text-green-400',      // Open
      3: 'text-green-600 dark:text-green-400',      // Active
      4: 'text-yellow-600 dark:text-yellow-400',    // Closing
      5: 'text-red-600 dark:text-red-400'           // Closed
    };
    return colors[stateNumber as keyof typeof colors] || 'text-gray-500 dark:text-gray-400';
  };
  
  // Prepare the closeChannel transaction
  const { config, error: prepareError } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'closeChannel',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  const { data, write } = useContractWrite(config);
  
  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });
  
  const handleCloseChannel = async () => {
    // Debug logging
    console.log('=== CLOSE CHANNEL DEBUG INFO ===');
    console.log('Channel ID:', leaderChannel?.id);
    console.log('Channel Info:', channelInfo);
    console.log('Channel State:', channelInfo ? Number(channelInfo[1]) : 'undefined');
    console.log('Channel State Name:', channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'undefined');
    console.log('Channel Deposits:', channelDeposits);
    console.log('Token Address:', tokenAddress);
    console.log('Token Info:', tokenInfo);
    console.log('Token Symbol:', tokenSymbol);
    console.log('Token Decimals:', tokenDecimals);
    console.log('Is Ready To Close:', isChannelReadyToClose);
    console.log('Is Leader:', hasAccess);
    console.log('Connected Address:', address);
    console.log('=================');
    
    if (!write) {
      if (prepareError) {
        console.log('Prepare Error:', prepareError);
        alert(`Contract error: ${prepareError.message || 'Transaction preparation failed'}`);
      } else {
        alert('Transaction not ready. Please ensure you have the correct wallet permissions and the channel is ready to close.');
      }
      return;
    }
    
    try {
      setIsLoading(true);
      write();
    } catch (error) {
      console.error('Error closing channel:', error);
      alert('Error closing channel. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check if channel is in correct state for closure (Closing=4 and sigVerified=true)
  const isChannelStateValid = channelInfo && Number(channelInfo[1]) === 4;
  const canCloseChannel = isConnected && hasAccess && leaderChannel && isChannelStateValid && isChannelReadyToClose && !isLoading && !isTransactionLoading;

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
                  <span className="text-white text-sm font-bold">🔐</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Close Channel</h1>
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

        <main className="flex-1 p-6">
          {!isConnected ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔌</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Please connect your wallet to close channels
              </p>
              <ConnectButton />
            </div>
          ) : !hasAccess ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚫</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Only channel leaders can close channels
              </p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Channel Overview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xl">🔐</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Close Channel</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Finalize and permanently close your channel to enable withdrawals
                    </p>
                  </div>
                </div>
                
                {leaderChannel && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Channel ID</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">#{leaderChannel.id}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                      <div className={`text-lg font-semibold ${channelInfo ? getChannelStateColor(Number(channelInfo[1])) : 'text-gray-500 dark:text-gray-400'}`}>
                        {channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'Loading...'}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Participants</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {channelParticipants ? channelParticipants.length : '...'}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Deposits</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {channelDeposits && tokenDecimals ? 
                          `${(Number(channelDeposits[0] || BigInt(0)) / Math.pow(10, tokenDecimals)).toFixed(4)} ${isETH ? 'ETH' : tokenSymbol}` 
                          : '...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Channel Closure Information */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Channel Closure Process
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Close your channel to finalize all transactions and enable participant withdrawals
                  </p>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Pre-closure Checklist */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
                    <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                      <span className="text-xl">📋</span>
                      Pre-Closure Checklist
                    </h4>
                    <div className="space-y-3">
                      <div className={`flex items-center gap-3 p-3 rounded-lg ${
                        isChannelStateValid 
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' 
                          : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                      }`}>
                        <span className={`text-lg ${
                          isChannelStateValid ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {isChannelStateValid ? '✅' : '⏳'}
                        </span>
                        <div>
                          <div className={`font-medium ${
                            isChannelStateValid ? 'text-green-800 dark:text-green-200' : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            Channel in "Closing" State
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Current state: {channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'Loading...'}
                          </div>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-3 p-3 rounded-lg ${
                        isChannelReadyToClose 
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' 
                          : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                      }`}>
                        <span className={`text-lg ${
                          isChannelReadyToClose ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {isChannelReadyToClose ? '✅' : '⏳'}
                        </span>
                        <div>
                          <div className={`font-medium ${
                            isChannelReadyToClose ? 'text-green-800 dark:text-green-200' : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            All Signatures Verified
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Group threshold signatures must be submitted and verified
                          </div>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-3 p-3 rounded-lg ${
                        leaderChannel 
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' 
                          : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                      }`}>
                        <span className={`text-lg ${
                          leaderChannel ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {leaderChannel ? '✅' : '❌'}
                        </span>
                        <div>
                          <div className={`font-medium ${
                            leaderChannel ? 'text-green-800 dark:text-green-200' : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            Channel Leadership
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            You are the channel leader with closure permissions
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Warning Notice */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6 border border-amber-200 dark:border-amber-700">
                    <div className="flex items-start gap-3">
                      <span className="text-amber-600 dark:text-amber-400 text-xl flex-shrink-0">⚠️</span>
                      <div>
                        <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Important Notice</h4>
                        <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                          <li>• Closing a channel is <strong>irreversible</strong></li>
                          <li>• All participants will be able to withdraw their final balances</li>
                          <li>• The channel cannot be reopened once closed</li>
                          <li>• Ensure all off-chain computations are complete</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  {/* Close Button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleCloseChannel}
                      disabled={!canCloseChannel}
                      className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                        canCloseChannel
                          ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isLoading || isTransactionLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Closing Channel...</span>
                        </div>
                      ) : (
                        'Close Channel Permanently'
                      )}
                    </button>
                    
                    {!canCloseChannel && isChannelStateValid && !isChannelReadyToClose && (
                      <div className="text-sm text-amber-600 dark:text-amber-400">
                        ⚠️ Channel not ready to close. All signatures must be verified first.
                      </div>
                    )}
                    
                    {!canCloseChannel && !isChannelStateValid && channelInfo && (
                      <div className="text-sm text-red-600 dark:text-red-400">
                        🚫 Channel must be in "Closing" state to close. Current state: {getChannelStateDisplay(Number(channelInfo[1]))}
                      </div>
                    )}
                    
                    {isSuccess && (
                      <div className="text-sm text-green-600 dark:text-green-400">
                        ✅ Channel closed successfully! Participants can now withdraw.
                      </div>
                    )}
                  </div>
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
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span className="font-medium">Official Website</span>
              </a>
              <a href="https://medium.com/@tokamak.network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
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
    </div>
  );
}