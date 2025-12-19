'use client';

import { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { 
  ROLLUP_BRIDGE_ADDRESS,
  ROLLUP_BRIDGE_ABI,
  ROLLUP_BRIDGE_WITHDRAW_MANAGER_ADDRESS,
  ROLLUP_BRIDGE_WITHDRAW_MANAGER_ABI
} from '@/lib/contracts';
import { ClientOnly } from '@/components/ClientOnly';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Sidebar } from '@/components/Sidebar';
import { ArrowUpCircle, CheckCircle2, AlertCircle, Info, Settings } from 'lucide-react';

export default function WithdrawTokensPage() {
  const { address, isConnected } = useAccount();
  
  // Form state
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Parse channel ID
  const parsedChannelId = selectedChannelId ? parseInt(selectedChannelId) : null;
  const isValidChannelId = parsedChannelId !== null && !isNaN(parsedChannelId) && parsedChannelId >= 0;

  // Get channel information for the selected channel
  const { data: channelState } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelState',
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  const { data: targetContract } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelTargetContract',
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  const { data: userDeposit } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getParticipantDeposit',
    args: isValidChannelId && address ? [BigInt(parsedChannelId), address] : undefined,
    enabled: isMounted && isConnected && isValidChannelId && !!address,
  });

  const { data: hasWithdrawn } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'hasUserWithdrawn',
    args: isValidChannelId && address ? [BigInt(parsedChannelId), address] : undefined,
    enabled: isMounted && isConnected && isValidChannelId && !!address,
  });


  // Get token information for ERC20 tokens
  const isETH = !targetContract || targetContract === '0x0000000000000000000000000000000000000000';

  // Check if user can withdraw from this channel
  const canUserWithdraw = () => {
    if (channelState === undefined || !channelParticipants || !address) return false;
    
    const state = Number(channelState);
    const isParticipant = (channelParticipants as string[]).includes(address);
    const hasNotWithdrawn = !hasWithdrawn;
    
    return state === 4 && isParticipant && hasNotWithdrawn; // State 4 = Closed
  };

  const { data: withdrawableAmount } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getWithdrawableAmount',
    args: isValidChannelId && address ? [BigInt(parsedChannelId), address] : undefined,
    enabled: isMounted && isConnected && isValidChannelId && !!address && canUserWithdraw(),
  });

  const { data: tokenDecimals } = useContractRead({
    address: targetContract,
    abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view' as const, type: 'function' as const, inputs: [] }],
    functionName: 'decimals',
    enabled: isMounted && isConnected && !isETH && !!targetContract,
  });

  const { data: tokenSymbol } = useContractRead({
    address: targetContract,
    abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view' as const, type: 'function' as const, inputs: [] }],
    functionName: 'symbol',
    enabled: isMounted && isConnected && !isETH && !!targetContract,
  });

  // Helper functions
  const getChannelStateName = (state: number) => {
    switch (state) {
      case 0: return 'None';
      case 1: return 'Initialized';
      case 2: return 'Open';
      case 3: return 'Closing';
      case 4: return 'Closed';
      default: return 'Unknown';
    }
  };

  const getChannelStateColor = (state: number) => {
    switch (state) {
      case 0: return 'text-gray-500';
      case 1: return 'text-blue-400';
      case 2: return 'text-green-400';
      case 3: return 'text-orange-400';
      case 4: return 'text-yellow-400';
      default: return 'text-gray-500';
    }
  };

  // Get token display information
  const getTokenInfo = () => {
    if (isETH) {
      return { symbol: 'ETH', decimals: 18 };
    } else {
      return {
        symbol: typeof tokenSymbol === 'string' ? tokenSymbol : 'TOKEN',
        decimals: typeof tokenDecimals === 'number' ? tokenDecimals : 18
      };
    }
  };

  // Prepare withdraw transaction
  const { write: withdrawTokens, isLoading: isWithdrawing, data: withdrawData } = useContractWrite({
    address: ROLLUP_BRIDGE_WITHDRAW_MANAGER_ADDRESS,
    abi: ROLLUP_BRIDGE_WITHDRAW_MANAGER_ABI,
    functionName: 'withdraw',
  });

  // Wait for withdraw transaction
  const { isLoading: isWaitingWithdraw, isSuccess: withdrawSuccess } = useWaitForTransaction({
    hash: withdrawData?.hash,
    enabled: !!withdrawData?.hash,
  });

  const handleChannelChange = (channelId: string) => {
    setSelectedChannelId(channelId);
    setProofError(null);
  };

  // Simple withdraw function - no complex proof generation needed
  const handleWithdraw = async () => {
    if (!withdrawTokens || !isValidChannelId || !address) return;
    
    setIsSubmitting(true);
    try {
      console.log('Withdrawing from channel:', parsedChannelId, 'for address:', address);
      
      withdrawTokens({
        args: [BigInt(parsedChannelId)]
      });
    } catch (error) {
      console.error('Withdraw error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setProofError(`Withdrawal failed: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  const isFormValid = isValidChannelId && 
                     canUserWithdraw() &&
                     withdrawableAmount &&
                     Number(withdrawableAmount) > 0;

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a1930] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#4fc3f7] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="min-h-screen space-background">
        <Sidebar isConnected={isConnected} onCollapse={() => {}} />

        <div className="ml-0 lg:ml-72 transition-all duration-300 min-h-screen space-background flex flex-col">
          <main className="px-4 py-8 lg:px-8 flex-1">
            <div className="max-w-5xl mx-auto">
              {/* Page Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                    <ArrowUpCircle className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white">Withdraw Tokens</h1>
                </div>
                <p className="text-gray-300 ml-13">
                  Withdraw your tokens from closed channels. Enter a channel ID to check withdrawal eligibility.
                </p>
              </div>

              {!isConnected ? (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
                  <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                    <ArrowUpCircle className="w-8 h-8 text-[#4fc3f7]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
                  <p className="text-gray-300 mb-6">Please connect your wallet to withdraw tokens</p>
                  <ConnectButton />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Channel ID Input Section */}
                  <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-[#4fc3f7]" />
                      Select Channel to Withdraw From
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Channel ID
                        </label>
                        <input
                          type="number"
                          value={selectedChannelId}
                          onChange={(e) => handleChannelChange(e.target.value)}
                          placeholder="Enter channel ID..."
                          className="w-full px-4 py-3 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-lg text-white placeholder-gray-400 focus:border-[#4fc3f7] focus:ring-1 focus:ring-[#4fc3f7] transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Channel Information */}
                  {isValidChannelId && channelState !== undefined && (
                    <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Info className="w-5 h-5 text-[#4fc3f7]" />
                        Channel {parsedChannelId} - {getChannelStateName(Number(channelState))}
                      </h3>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                          <div className="text-sm text-gray-400">Status</div>
                          <div className={`text-xl font-bold ${getChannelStateColor(Number(channelState))}`}>
                            {getChannelStateName(Number(channelState))}
                          </div>
                        </div>
                        <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                          <div className="text-sm text-gray-400">Participants</div>
                          <div className="text-xl font-bold text-white">{channelParticipants?.length || 0}</div>
                        </div>
                        <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                          <div className="text-sm text-gray-400">Your Deposit</div>
                          <div className="text-xl font-bold text-white">
                            {userDeposit ? formatUnits(userDeposit, getTokenInfo().decimals) : '0'} {getTokenInfo().symbol}
                          </div>
                        </div>
                        <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                          <div className="text-sm text-gray-400">Withdrawn</div>
                          <div className={`text-xl font-bold ${hasWithdrawn ? 'text-red-400' : 'text-green-400'}`}>
                            {hasWithdrawn ? 'Yes' : 'No'}
                          </div>
                        </div>
                      </div>

                      {/* Status Messages */}
                      {!canUserWithdraw() && (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-yellow-300 text-sm font-medium">Cannot Withdraw</p>
                              <div className="text-yellow-400 text-sm mt-1">
                                {Number(channelState) !== 4 && <span>Channel must be in "Closed" state. </span>}
                                {!(channelParticipants as string[])?.includes(address!) && <span>You must be a participant in this channel. </span>}
                                {hasWithdrawn && <span>You have already withdrawn from this channel.</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Withdraw Form */}
                  {canUserWithdraw() && (
                    <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                      <div className="p-6 border-b border-[#4fc3f7]/30">
                        <h3 className="text-xl font-semibold text-white mb-2">
                          Withdrawal Details for Channel #{parsedChannelId}
                        </h3>
                        <p className="text-gray-400">Review your withdrawable amount and complete the withdrawal</p>
                      </div>
                      
                      <div className="p-6 space-y-6">
                        {/* Withdrawable Amount Display */}
                        <div className="p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 rounded-lg">
                          <h3 className="text-lg font-semibold text-white mb-2">Available to Withdraw</h3>
                          {withdrawableAmount ? (
                            <div className="text-2xl font-bold text-[#4fc3f7]">
                              {formatUnits(withdrawableAmount, getTokenInfo().decimals)} {getTokenInfo().symbol}
                            </div>
                          ) : (
                            <div className="text-gray-400">Loading withdrawable amount...</div>
                          )}
                          <p className="text-sm text-gray-400 mt-1">
                            Full amount will be withdrawn automatically
                          </p>
                        </div>

                        {/* Error Display */}
                        {proofError && (
                          <div className="p-4 bg-red-500/10 border border-red-500/50">
                            <div className="flex items-start">
                              <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0" />
                              <div>
                                <h4 className="font-medium text-red-400">
                                  Withdrawal Error
                                </h4>
                                <p className="text-sm text-red-300/90 mt-1">
                                  {proofError}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Withdraw Button */}
                        <div className="flex justify-end">
                          <button
                            onClick={handleWithdraw}
                            disabled={!isFormValid || isWithdrawing || isWaitingWithdraw || isSubmitting}
                            className="px-6 py-2 bg-[#4fc3f7] text-white hover:bg-[#029bee] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] transition-colors duration-200 flex items-center gap-2"
                          >
                            {(isWithdrawing || isWaitingWithdraw || isSubmitting) && (
                              <LoadingSpinner size="sm" />
                            )}
                            {isWithdrawing || isSubmitting
                              ? 'Submitting...'
                              : isWaitingWithdraw
                              ? 'Confirming...'
                              : 'Withdraw Tokens'
                            }
                          </button>
                        </div>

                        {withdrawSuccess && (
                          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/50">
                            <div className="flex items-start">
                              <CheckCircle2 className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                              <div>
                                <h4 className="font-medium text-green-400">
                                  Withdrawal Successful!
                                </h4>
                                <p className="text-sm text-green-300/90 mt-1">
                                  Your tokens have been successfully withdrawn from Channel #{parsedChannelId}.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </ClientOnly>
  );
}