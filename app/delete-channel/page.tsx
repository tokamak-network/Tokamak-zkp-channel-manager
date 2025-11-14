'use client';

import React, { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { Footer } from '@/components/Footer';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { Trash2, Link, ShieldOff, CheckCircle2, Clock, AlertCircle, Crown } from 'lucide-react';

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
      0: 'text-gray-400',
      1: 'text-[#4fc3f7]',
      2: 'text-green-400',
      3: 'text-green-400',
      4: 'text-yellow-400',
      5: 'text-red-400'
    };
    return colors[stateNumber as keyof typeof colors] || 'text-gray-400';
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
      <div className={`p-3 border cursor-pointer transition-all ${
        selectedChannelId === channelId 
          ? 'border-[#4fc3f7] bg-[#4fc3f7]/10 shadow-lg shadow-[#4fc3f7]/20' 
          : 'border-[#4fc3f7]/30 bg-[#0a1930]/50 hover:border-[#4fc3f7] hover:shadow-lg hover:shadow-[#4fc3f7]/10'
      }`}
      onClick={() => setSelectedChannelId(channelId)}>
        <div className="flex justify-between items-start mb-2">
          <div className="font-medium text-white">Channel #{channelId}</div>
          <div className={`text-sm px-2 py-1 ${
            state === 5 ? 'bg-red-500/20 border border-red-500/30 text-red-300' : 'bg-[#0a1930] border border-[#4fc3f7]/20 text-gray-300'
          }`}>
            {getChannelStateDisplay(state)}
          </div>
        </div>
        <div className="text-sm text-gray-300 flex items-center gap-1.5">
          {isDeletable ? (
            <><CheckCircle2 className="w-4 h-4 text-green-400" /> <span className="text-green-400">Ready to delete</span></>
          ) : timeLeft > 0 ? (
            <><Clock className="w-4 h-4 text-yellow-400" /> <span className="text-yellow-400">{formatTimeRemaining(timeLeft)}</span></>
          ) : (
            <span className="text-gray-400">Not closed</span>
          )}
        </div>
      </div>
    );
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"></div>;
  }

  return (
    <div className="min-h-screen space-background">
      <ClientOnly>
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>

      <MobileNavigation 
        showMobileMenu={showMobileMenu} 
        setShowMobileMenu={setShowMobileMenu} 
      />

      <div className="ml-0 lg:ml-72 transition-all duration-300 min-h-screen">
        <main className="px-4 py-8 lg:px-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                <Trash2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Delete Channel</h1>
            </div>
            <p className="text-gray-300 ml-13">
              Permanently remove closed channels after the challenge period
            </p>
          </div>

          {!isConnected ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Link className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-300 mb-6">
                Please connect your wallet to delete channels
              </p>
              <ConnectButton />
            </div>
          ) : !hasOwnerAccess ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <ShieldOff className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
              <p className="text-gray-300">
                Only channel leaders and contract owners can delete channels
              </p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Channel Selector for Owners */}
              {isOwner && totalChannels && Number(totalChannels) > 0 && (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20 p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                      <Crown className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Owner: Select Channel</h2>
                      <p className="text-gray-300 mt-1">
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
                    <div className="mt-4 p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-[#4fc3f7] flex-shrink-0" />
                      <p className="text-[#4fc3f7] text-sm">
                        Selected: <strong>Channel #{selectedChannelId}</strong> for deletion
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Channel Overview */}
              {selectedChannelId !== null && (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20 p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                      <Trash2 className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Delete Channel</h2>
                      <p className="text-gray-300 mt-1">
                        Permanently remove channel data after the challenge period
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-4">
                      <div className="text-sm text-gray-300">Channel ID</div>
                      <div className="text-lg font-semibold text-white">
                        #{selectedChannelId}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-4">
                      <div className="text-sm text-gray-300">Status</div>
                      <div className={`text-lg font-semibold ${channelInfo ? getChannelStateColor(Number(channelInfo[1])) : 'text-gray-500 dark:text-gray-400'}`}>
                        {channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'Loading...'}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-4">
                      <div className="text-sm text-gray-300">Challenge Period</div>
                      <div className={`text-lg font-semibold ${
                        canDelete ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {formatTimeRemaining(timeRemaining)}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-4">
                      <div className="text-sm text-gray-300">Your Access</div>
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {isOwner ? '⛂ Owner' : '▣ Leader'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Deletion Interface */}
              {selectedChannelId !== null && (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                  <div className="p-6 border-b border-[#4fc3f7]/30">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Channel Deletion Process
                    </h3>
                    <p className="text-gray-300">
                      Permanently delete channel data after the 14-day challenge period
                    </p>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Danger Zone */}
                    <div className="bg-red-500/10 border border-red-500/30 p-6">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-red-300 mb-2">DANGER ZONE</h4>
                          <p className="text-sm text-red-200/90 mb-4">
                            Channel deletion is <strong>permanent and irreversible</strong>. Make sure you understand the consequences before proceeding.
                          </p>
                          
                          {/* Risk acknowledgment checkbox */}
                          <div className="mb-4">
                            <label className="flex items-start gap-3 text-sm text-red-200/90 cursor-pointer">
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
                                  ? 'bg-[#4fc3f7] hover:bg-[#029bee] text-white'
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
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
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
                                      ? 'bg-[#4fc3f7] hover:bg-[#029bee] text-white shadow-lg hover:shadow-xl transform hover:scale-105'
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
                        <div className="p-4 bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                          <ShieldOff className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-red-300">
                            <strong className="block mb-1">Invalid Channel State</strong>
                            Channel must be in "Closed" state to delete. Current state: {getChannelStateDisplay(Number(channelInfo[1]))}
                          </div>
                        </div>
                      )}
                      
                      {!canDeleteChannel && isChannelStateValid && !canDelete && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-300">
                            <strong className="block mb-1">Challenge Period Active</strong>
                            Challenge period in progress. {formatTimeRemaining(timeRemaining)}
                          </div>
                        </div>
                      )}
                      
                      {isSuccess && (
                        <div className="p-4 bg-green-500/10 border border-green-500/30 flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-green-300">
                            <strong className="block mb-1">Success!</strong>
                            Channel deleted successfully! You can now create new channels.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
        
        <Footer className="mt-auto" />
      </div>
    </div>
  );
}