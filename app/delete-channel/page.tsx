'use client';

import React, { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { MobileNavigation } from '@/components/MobileNavigation';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

export default function DeleteChannelPage() {
  const { isConnected, hasOwnerAccess, isMounted, leaderChannel, isOwner } = useLeaderAccess();
  const { address } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(
    leaderChannel ? leaderChannel.id : null
  );
  
  // Get total channels to fetch all channels for owner
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isOwner && isConnected
  });
  
  // Get channel info for selected channel
  const { data: channelInfo } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelInfo',
    args: selectedChannelId !== null ? [BigInt(selectedChannelId)] : undefined,
    enabled: selectedChannelId !== null
  });
  
  // Get channel timestamps for selected channel
  const { data: channelTimestamps } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelTimestamps',
    args: selectedChannelId !== null ? [BigInt(selectedChannelId)] : undefined,
    enabled: selectedChannelId !== null
  });
  
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
      0: 'text-gray-500 dark:text-gray-400',
      1: 'text-blue-600 dark:text-blue-400',
      2: 'text-green-600 dark:text-green-400',
      3: 'text-green-600 dark:text-green-400',
      4: 'text-yellow-600 dark:text-yellow-400',
      5: 'text-red-600 dark:text-red-400'
    };
    return colors[stateNumber as keyof typeof colors] || 'text-gray-500 dark:text-gray-400';
  };
  
  // Calculate challenge period info
  const CHALLENGE_PERIOD = 14 * 24 * 60 * 60; // 14 days in seconds
  const currentTime = Math.floor(Date.now() / 1000);
  const closeTimestamp = channelTimestamps && Array.isArray(channelTimestamps) && channelTimestamps.length > 1 ? Number(channelTimestamps[1]) : 0;
  const challengePeriodEnd = closeTimestamp + CHALLENGE_PERIOD;
  const timeRemaining = Math.max(0, challengePeriodEnd - currentTime);
  const canDelete = timeRemaining === 0 && closeTimestamp > 0;
  
  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Ready to delete';
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };
  
  // Prepare the deleteChannel transaction
  const { config, error: prepareError } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'deleteChannel',
    args: selectedChannelId !== null ? [BigInt(selectedChannelId)] : undefined,
    enabled: Boolean(selectedChannelId !== null && canDelete)
  });
  
  const { data, write } = useContractWrite(config);
  
  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });
  
  const handleDeleteChannel = async () => {
    console.log('=== DELETE CHANNEL DEBUG INFO ===');
    console.log('Selected Channel ID:', selectedChannelId);
    console.log('Channel Info:', channelInfo);
    console.log('Channel State:', channelInfo ? Number(channelInfo[1]) : 'undefined');
    console.log('Channel State Name:', channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'undefined');
    console.log('Channel Timestamps:', channelTimestamps);
    console.log('Close Timestamp:', closeTimestamp);
    console.log('Current Time:', currentTime);
    console.log('Challenge Period End:', challengePeriodEnd);
    console.log('Time Remaining:', timeRemaining);
    console.log('Can Delete:', canDelete);
    console.log('Is Owner:', isOwner);
    console.log('Connected Address:', address);
    console.log('=================');
    
    if (!write) {
      if (prepareError) {
        console.log('Prepare Error:', prepareError);
        alert(`Contract error: ${prepareError.message || 'Transaction preparation failed'}`);
      } else {
        alert('Transaction not ready. Please ensure the channel is closed and the challenge period has ended.');
      }
      return;
    }
    
    try {
      setIsLoading(true);
      write();
    } catch (error) {
      console.error('Error deleting channel:', error);
      alert('Error deleting channel. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check if channel is in correct state for deletion (Closed=5)
  const isChannelStateValid = channelInfo && Number(channelInfo[1]) === 5;
  const canDeleteChannel = isConnected && hasOwnerAccess && selectedChannelId !== null && isChannelStateValid && canDelete && !isLoading && !isTransactionLoading;
  
  // Component to fetch and display channel info for a given ID
  const ChannelInfoDisplay = ({ channelId }: { channelId: number }) => {
    const { data: info } = useContractRead({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelInfo',
      args: [BigInt(channelId)],
      enabled: Boolean(channelId)
    });
    
    const { data: timestamps } = useContractRead({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelTimestamps',
      args: [BigInt(channelId)],
      enabled: Boolean(channelId)
    });
    
    const closeTime = timestamps && Array.isArray(timestamps) && timestamps.length > 1 ? Number(timestamps[1]) : 0;
    const periodEnd = closeTime + CHALLENGE_PERIOD;
    const timeLeft = Math.max(0, periodEnd - currentTime);
    const isDeletable = timeLeft === 0 && closeTime > 0;
    const state = info && Array.isArray(info) && info.length > 1 ? Number(info[1]) : 0;
    
    return (
      <div className={`p-3 border rounded-lg cursor-pointer transition-all ${
        selectedChannelId === channelId 
          ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
      }`}
      onClick={() => setSelectedChannelId(channelId)}>
        <div className="flex justify-between items-start mb-2">
          <div className="font-medium text-gray-900 dark:text-gray-100">Channel #{channelId}</div>
          <div className={`text-sm px-2 py-1 rounded ${
            state === 5 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}>
            {getChannelStateDisplay(state)}
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {isDeletable ? (
            <span className="text-green-600 dark:text-green-400">✓ Ready to delete</span>
          ) : timeLeft > 0 ? (
            <span className="text-yellow-600 dark:text-yellow-400">⏳ {formatTimeRemaining(timeLeft)}</span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">Not closed</span>
          )}
        </div>
      </div>
    );
  };

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
                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">✕</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Delete Channel</h1>
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

        <MobileNavigation 
          showMobileMenu={showMobileMenu} 
          setShowMobileMenu={setShowMobileMenu} 
        />

        <main className="flex-1 p-4 sm:p-6">
          {!isConnected ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔌</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Please connect your wallet to delete channels
              </p>
              <ConnectButton />
            </div>
          ) : !hasOwnerAccess ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚫</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Only channel leaders and contract owners can delete channels
              </p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Channel Selector for Owners */}
              {isOwner && totalChannels && Number(totalChannels) > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <span className="text-white text-xl">👑</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Owner: Select Channel</h2>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        As contract owner, you can delete any closed channel after the challenge period
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: Number(totalChannels) }, (_, i) => (
                      <ChannelInfoDisplay key={i} channelId={i} />
                    ))}
                  </div>
                  
                  {selectedChannelId !== null && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                      <p className="text-blue-800 dark:text-blue-200 text-sm">
                        📍 Selected: <strong>Channel #{selectedChannelId}</strong> for deletion
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Channel Overview */}
              {selectedChannelId !== null && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                      <span className="text-white text-xl">✕</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Delete Channel</h2>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Permanently remove channel data after the challenge period
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Channel ID</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        #{selectedChannelId}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                      <div className={`text-lg font-semibold ${channelInfo ? getChannelStateColor(Number(channelInfo[1])) : 'text-gray-500 dark:text-gray-400'}`}>
                        {channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'Loading...'}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Challenge Period</div>
                      <div className={`text-lg font-semibold ${
                        canDelete ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {formatTimeRemaining(timeRemaining)}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Your Access</div>
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {isOwner ? '⛂ Owner' : '▣ Leader'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Deletion Interface */}
              {selectedChannelId !== null && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Channel Deletion Process
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Permanently delete channel data after the 14-day challenge period
                    </p>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Danger Zone */}
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border border-red-200 dark:border-red-700">
                      <div className="flex items-start gap-3">
                        <span className="text-red-600 dark:text-red-400 text-xl flex-shrink-0">⚠️</span>
                        <div>
                          <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">DANGER ZONE</h4>
                          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                            Channel deletion is <strong>permanent and irreversible</strong>. Make sure you understand the consequences before proceeding.
                          </p>
                          
                          {/* Risk acknowledgment checkbox */}
                          <div className="mb-4">
                            <label className="flex items-start gap-3 text-sm text-red-700 dark:text-red-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={acknowledgeRisk}
                                onChange={(e) => setAcknowledgeRisk(e.target.checked)}
                                className="mt-0.5 h-4 w-4 text-red-600 focus:ring-red-500 border-red-300 rounded"
                              />
                              <span>
                                I understand that deleting this channel is <strong>permanent and irreversible</strong>. 
                                All channel data will be permanently removed from the blockchain and this action cannot be undone.
                              </span>
                            </label>
                          </div>
                          
                          {!showConfirmation ? (
                            <button
                              onClick={() => setShowConfirmation(true)}
                              disabled={!canDeleteChannel || !acknowledgeRisk}
                              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                                canDeleteChannel && acknowledgeRisk
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              I Want To Delete This Channel
                            </button>
                          ) : (
                            <div className="space-y-4">
                              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-red-300 dark:border-red-600">
                                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-3">
                                  Type "DELETE CHANNEL {selectedChannelId}" to confirm:
                                </p>
                                <input
                                  type="text"
                                  placeholder={`DELETE CHANNEL ${selectedChannelId}`}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
                                  onChange={(e) => {
                                    // Remove the data-confirmed logic since we check directly in onClick
                                  }}
                                />
                              </div>
                              <div className="flex gap-3">
                                <button
                                  disabled={!canDeleteChannel}
                                  className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                                    canDeleteChannel
                                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                  }`}
                                  onClick={(e) => {
                                    const input = e.currentTarget.parentElement?.parentElement?.querySelector('input') as HTMLInputElement;
                                    const expectedText = `DELETE CHANNEL ${selectedChannelId}`;
                                    const isConfirmed = input?.value === expectedText;
                                    if (!isConfirmed) {
                                      alert('Please type the confirmation text exactly as shown.');
                                      return;
                                    }
                                    handleDeleteChannel();
                                  }}
                                >
                                  {isLoading || isTransactionLoading ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                      <span>Deleting...</span>
                                    </div>
                                  ) : (
                                    'DELETE CHANNEL PERMANENTLY'
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setShowConfirmation(false);
                                    setAcknowledgeRisk(false);
                                  }}
                                  className="px-6 py-3 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Status Messages */}
                    <div className="space-y-4">
                      {!canDeleteChannel && !isChannelStateValid && channelInfo && (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          🚫 Channel must be in "Closed" state to delete. Current state: {getChannelStateDisplay(Number(channelInfo[1]))}
                        </div>
                      )}
                      
                      {!canDeleteChannel && isChannelStateValid && !canDelete && (
                        <div className="text-sm text-amber-600 dark:text-amber-400">
                          ⏳ Challenge period in progress. {formatTimeRemaining(timeRemaining)}
                        </div>
                      )}
                      
                      {isSuccess && (
                        <div className="text-sm text-green-600 dark:text-green-400">
                          ✅ Channel deleted successfully! You can now create new channels.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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