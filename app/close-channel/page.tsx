'use client';

import React, { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { Footer } from '@/components/Footer';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { 
  ROLLUP_BRIDGE_WITHDRAW_MANAGER_ADDRESS, 
  ROLLUP_BRIDGE_WITHDRAW_MANAGER_ABI,
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI 
} from '@/lib/contracts';
import { XCircle, Link, ShieldOff, CheckCircle2, Clock, AlertCircle, ListChecks } from 'lucide-react';

export default function CloseChannelPage() {
  const { isConnected, hasAccess, isMounted, leaderChannel } = useLeaderAccess();
  const { address } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Channel information from core contract
  const { data: channelInfo } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelInfo',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });

  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });

  const { data: allowedTokens } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelAllowedTokens',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });

  const { data: signatureVerified } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'isSignatureVerified',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
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
      1: 'text-[#4fc3f7]',
      2: 'text-green-400',
      3: 'text-green-400',
      4: 'text-yellow-400',
      5: 'text-red-400'
    };
    return colors[stateNumber as keyof typeof colors] || 'text-gray-500 dark:text-gray-400';
  };
  
  // Contract write preparation for closeAndFinalizeChannel
  const { config, error: prepareError } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_WITHDRAW_MANAGER_ADDRESS,
    abi: ROLLUP_BRIDGE_WITHDRAW_MANAGER_ABI,
    functionName: 'closeAndFinalizeChannel',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel && isChannelReadyToClose())
  });
  
  const { data, write } = useContractWrite(config);
  
  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  // Check if channel is ready to close
  function isChannelReadyToClose(): boolean {
    if (!channelInfo || !signatureVerified) return false;
    
    const channelState = Number(channelInfo[1]);
    return channelState === 4 && signatureVerified; // Closing state and signature verified
  }
  
  // Submit handler
  const handleCloseChannel = async () => {
    console.log('🔍 CLOSE CHANNEL DEBUG:');
    console.log('  Channel ID:', leaderChannel?.id);
    console.log('  Channel Info:', channelInfo);
    console.log('  Channel State:', channelInfo ? Number(channelInfo[1]) : 'undefined');
    console.log('  Signature Verified:', signatureVerified);
    console.log('  Is Ready To Close:', isChannelReadyToClose());
    console.log('  Contract Address:', ROLLUP_BRIDGE_WITHDRAW_MANAGER_ADDRESS);
    console.log('  Connected Address:', address);
    
    if (!write) {
      if (prepareError) {
        console.error('Prepare Error:', prepareError);
        alert(`Contract error: ${prepareError.message || 'Transaction preparation failed'}`);
      } else {
        alert('Transaction not ready. Please ensure the channel is in Closing state with verified signatures.');
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
  
  // Check if channel is in correct state for closure (Closing=4 and signature verified)
  const isChannelStateValid = channelInfo && Number(channelInfo[1]) === 4;
  const isSignatureValid = Boolean(signatureVerified);
  const canCloseChannel = isConnected && hasAccess && leaderChannel && isChannelReadyToClose() && !isLoading && !isTransactionLoading;

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
                <XCircle className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Close & Finalize Channel</h1>
            </div>
            <p className="text-gray-300 ml-13">
              Permanently close your channel and enable participant withdrawals
            </p>
          </div>

          {!isConnected ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Link className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-300 mb-6">
                Please connect your wallet to close channels
              </p>
              <ConnectButton />
            </div>
          ) : !hasAccess ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <ShieldOff className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
              <p className="text-gray-300">
                Only channel leaders can close channels
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Channel Overview */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                    <XCircle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Channel Information</h2>
                    <p className="text-gray-300 mt-1">
                      Review channel status before finalizing closure
                    </p>
                  </div>
                </div>
                
                {leaderChannel && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Channel ID</div>
                      <div className="text-lg font-semibold text-white">#{leaderChannel.id}</div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Status</div>
                      <div className={`text-lg font-semibold ${channelInfo ? getChannelStateColor(Number(channelInfo[1])) : 'text-gray-400'}`}>
                        {channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'Loading...'}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Participants</div>
                      <div className="text-lg font-semibold text-white">
                        {channelParticipants ? channelParticipants.length : '...'}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Allowed Tokens</div>
                      <div className="text-lg font-semibold text-white">
                        {allowedTokens ? allowedTokens.length : '...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Channel Closure Process */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                <div className="p-6 border-b border-[#4fc3f7]/30">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Channel Closure Process
                  </h3>
                  <p className="text-gray-400">
                    Finalize channel closure to enable participant withdrawals using the new withdraw manager
                  </p>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Pre-closure Checklist */}
                  <div className="bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 p-6">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <ListChecks className="w-6 h-6 text-[#4fc3f7]" />
                      Pre-Closure Requirements
                    </h4>
                    <div className="space-y-3">
                      <div className={`flex items-center gap-3 p-3 ${
                        isChannelStateValid 
                          ? 'bg-green-500/10 border border-green-500/30' 
                          : 'bg-[#0a1930]/50 border border-[#4fc3f7]/30'
                      }`}>
                        {isChannelStateValid ? (
                          <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                        ) : (
                          <Clock className="w-6 h-6 text-gray-400 flex-shrink-0" />
                        )}
                        <div>
                          <div className={`font-medium ${
                            isChannelStateValid ? 'text-green-300' : 'text-gray-300'
                          }`}>
                            Channel in "Closing" State
                          </div>
                          <div className="text-sm text-gray-400">
                            Current state: {channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'Loading...'}
                          </div>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-3 p-3 ${
                        isSignatureValid 
                          ? 'bg-green-500/10 border border-green-500/30' 
                          : 'bg-[#0a1930]/50 border border-[#4fc3f7]/30'
                      }`}>
                        {isSignatureValid ? (
                          <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                        ) : (
                          <Clock className="w-6 h-6 text-gray-400 flex-shrink-0" />
                        )}
                        <div>
                          <div className={`font-medium ${
                            isSignatureValid ? 'text-green-300' : 'text-gray-300'
                          }`}>
                            Group Signature Verified
                          </div>
                          <div className="text-sm text-gray-400">
                            Multi-proof and threshold signature must be submitted and verified
                          </div>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-3 p-3 ${
                        hasAccess 
                          ? 'bg-green-500/10 border border-green-500/30' 
                          : 'bg-red-500/10 border border-red-500/30'
                      }`}>
                        {hasAccess ? (
                          <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                        )}
                        <div>
                          <div className={`font-medium ${
                            hasAccess ? 'text-green-300' : 'text-red-300'
                          }`}>
                            Channel Leadership
                          </div>
                          <div className="text-sm text-gray-400">
                            Only the channel leader can finalize closure
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Warning Notice */}
                  <div className="bg-amber-500/10 border border-amber-500/30 p-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-300 mb-2">Important Notice</h4>
                        <ul className="text-sm text-amber-200/90 space-y-1">
                          <li>• Channel closure is <strong>permanent and irreversible</strong></li>
                          <li>• All participants will be able to withdraw their final balances</li>
                          <li>• This uses the new withdraw manager contract architecture</li>
                          <li>• Withdrawals are processed individually by each participant</li>
                          <li>• Ensure all off-chain state transitions are complete</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contract Information */}
                  <div className="bg-[#4fc3f7]/5 border border-[#4fc3f7]/20 p-4">
                    <h4 className="text-sm font-semibold text-[#4fc3f7] mb-2">Contract Details</h4>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>Withdraw Manager: <span className="text-[#4fc3f7] font-mono">{ROLLUP_BRIDGE_WITHDRAW_MANAGER_ADDRESS}</span></div>
                      <div>Function: <span className="text-[#4fc3f7] font-mono">closeAndFinalizeChannel(uint256 channelId)</span></div>
                    </div>
                  </div>
                  
                  {/* Close Button */}
                  <div className="pt-6 border-t border-[#4fc3f7]/30">
                    {/* Status Messages */}
                    {!canCloseChannel && !isChannelStateValid && channelInfo && (
                      <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                        <ShieldOff className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-red-300">
                          <strong className="block mb-1">Invalid Channel State</strong>
                          Channel must be in "Closing" state to finalize. Current: {getChannelStateDisplay(Number(channelInfo[1]))}
                        </div>
                      </div>
                    )}

                    {!canCloseChannel && isChannelStateValid && !isSignatureValid && (
                      <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-300">
                          <strong className="block mb-1">Signatures Required</strong>
                          Group threshold signatures must be verified before closure.
                        </div>
                      </div>
                    )}
                    
                    {isSuccess && (
                      <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-300">
                          <strong className="block mb-1">Channel Closed Successfully!</strong>
                          Channel has been finalized. Participants can now withdraw their final balances.
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={handleCloseChannel}
                      disabled={!canCloseChannel}
                      className={`w-full px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
                        canCloseChannel
                          ? 'bg-[#4fc3f7] hover:bg-[#029bee] text-white shadow-lg shadow-[#4fc3f7]/30 hover:shadow-xl hover:shadow-[#4fc3f7]/50'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isLoading || isTransactionLoading ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Finalizing Channel Closure...</span>
                        </div>
                      ) : (
                        'Close & Finalize Channel'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
        
        <Footer className="mt-auto" />
      </div>
    </div>
  );
}