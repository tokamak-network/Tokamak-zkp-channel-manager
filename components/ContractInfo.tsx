'use client';

import React from 'react';
import { useAccount, useContractRead, useContractReads } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from '@/lib/contracts';
import { ClientOnly } from '@/components/ClientOnly';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';

export function ContractInfo() {
  const { address, isConnected } = useAccount();

  // Check if the current user is the owner
  const { data: owner } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'owner',
    enabled: isConnected,
  });

  // Anyone can create channels now - no authorization required

  // Use dynamic hook to check all channels for leadership and participation
  const { hasChannels, isParticipant, isLoading: rolesLoading, totalChannels, participatingChannels, leadingChannels, channelStatsData } = useUserRolesDynamic();

  // Create dynamic contract calls for user deposits in participating channels
  const depositContracts = participatingChannels.map(channelId => ({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getParticipantDeposit',
    args: address ? [BigInt(channelId), address] : undefined,
  }));

  const { data: depositData } = useContractReads({
    contracts: depositContracts,
    enabled: isConnected && !!address && participatingChannels.length > 0,
  });

  // Create a mapping of channel IDs to their contract indices for token data
  const channelToTokenIndex: Record<number, number> = {};
  let tokenContractIndex = 0;
  
  const tokenContracts = participatingChannels.flatMap(channelId => {
    const channelStats = channelStatsData[channelId];
    const targetContract = channelStats?.[1] as `0x${string}`;
    
    // Skip ETH channels (zero address or no target contract)
    if (!targetContract || targetContract === '0x0000000000000000000000000000000000000000' || !isAddress(targetContract)) {
      return [];
    }

    // Map this channel to the current token contract index
    channelToTokenIndex[channelId] = tokenContractIndex;
    tokenContractIndex++;

    return [
      {
        address: targetContract,
        abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }] as const,
        functionName: 'decimals',
      },
      {
        address: targetContract,
        abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }] as const,
        functionName: 'symbol',
      }
    ];
  });

  const { data: tokenData } = useContractReads({
    contracts: tokenContracts,
    enabled: isConnected && tokenContracts.length > 0,
  });

  // Note: getParticipantWithdrawAmount function doesn't exist in contract
  // For now, we'll show withdrawn amounts as 0 or use hasWithdrawn status instead

  // Deposit tracking is now handled dynamically below

  // Get withdraw info with proper token details
  // Since getParticipantWithdrawAmount doesn't exist, we'll return empty for now
  const getUserWithdrawInfo = (): Array<{
    amount: bigint;
    decimals: number;
    symbol: string;
    channelId: number;
  }> => {
    const withdraws: Array<{
      amount: bigint;
      decimals: number;
      symbol: string;
      channelId: number;
    }> = [];
    
    // TODO: Implement proper withdraw amount tracking when contract function is available
    // For now, returning empty array since getParticipantWithdrawAmount doesn't exist
    
    return withdraws;
  };

  const userWithdraws = getUserWithdrawInfo();

  // Get channel-specific deposit/withdraw availability
  const getDepositableChannels = () => {
    return participatingChannels.filter(channelId => {
      const channelStats = channelStatsData[channelId];
      return channelStats && channelStats[2] === 1; // State 1 = Initialized, can deposit
    });
  };

  const getWithdrawableChannels = () => {
    return participatingChannels.filter(channelId => {
      const channelStats = channelStatsData[channelId];
      return channelStats && channelStats[2] === 5; // State 5 = Closed, can withdraw
    });
  };

  const depositableChannels = getDepositableChannels();
  const withdrawableChannels = getWithdrawableChannels();
  const canDeposit = depositableChannels.length > 0;
  const canWithdraw = withdrawableChannels.length > 0;

  // Get user deposit information for participating channels
  const getUserDepositInfo = () => {
    const deposits: Array<{ amount: bigint; decimals: number; symbol: string; channelId: number; }> = [];
    
    participatingChannels.forEach((channelId, index) => {
      const depositAmount = depositData?.[index]?.result as bigint;
      const channelStats = channelStatsData[channelId];
      const targetContract = channelStats?.[1] as `0x${string}`;
      const isETH = !targetContract || targetContract === '0x0000000000000000000000000000000000000000' || !isAddress(targetContract);
      
      let decimals = 18;
      let symbol = 'ETH';
      
      if (!isETH) {
        // Get token info using the channel to token index mapping
        const tokenIndex = channelToTokenIndex[channelId];
        if (tokenIndex !== undefined) {
          const decimalsResult = tokenData?.[tokenIndex * 2]?.result as number;
          const symbolResult = tokenData?.[tokenIndex * 2 + 1]?.result as string;
          
          decimals = decimalsResult || 18;
          symbol = symbolResult || 'TOKEN';
        }
      }
      
      deposits.push({
        amount: depositAmount || BigInt(0),
        decimals,
        symbol,
        channelId
      });
    });
    
    return deposits;
  };

  const userDeposits = getUserDepositInfo();

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  // Helper function to get channel state name
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

  // Note: Specific channel details are now handled by the dynamic hook
  // This component shows overall participation status rather than per-channel details



  if (!isConnected) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8 transition-colors duration-300">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-3 w-3 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Information</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-300 text-center">
          Connect your wallet to view contract information and authorization status
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8 shadow-sm text-left transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">📋</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Information</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your account status and permissions</p>
          </div>
        </div>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Channel Participation */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              participatingChannels.length > 0 ? 'bg-orange-500' : 'bg-gray-400'
            }`}>
              <span className="text-white text-sm">
                {participatingChannels.length > 0 ? '👥' : '○'}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Participant</p>
              <p className={`text-sm ${participatingChannels.length > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-400'}`}>
                {participatingChannels.length > 0 ? `In ${participatingChannels.length} channel${participatingChannels.length > 1 ? 's' : ''}` : 'Not Participating'}
              </p>
            </div>
          </div>
        </div>

        {/* Channel Leadership */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              leadingChannels.length > 0 ? 'bg-blue-500' : 'bg-gray-400'
            }`}>
              <span className="text-white text-sm">
                {leadingChannels.length > 0 ? '⚒' : '○'}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Channel Leader</p>
              <p className={`text-sm ${leadingChannels.length > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                {leadingChannels.length > 0 ? `Leading ${leadingChannels.length} channel${leadingChannels.length > 1 ? 's' : ''}` : 'No channel yet'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      {
        <div className="border-t border-gray-200 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contract Details */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Contract Details</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block mb-1">Manager Contract Address:</span>
                  <code className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 rounded block font-mono break-all">
                    {ROLLUP_BRIDGE_ADDRESS}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Channels:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{totalChannels?.toString() || '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Next Channel ID:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{totalChannels?.toString() || '0'}</span>
                </div>
                {(participatingChannels.length > 0 || leadingChannels.length > 0) && (
                  <div className="space-y-2">
                    <span className="text-gray-600 dark:text-gray-400 block">Your Channel Participation:</span>
                    <div className="space-y-1">
                      {participatingChannels.map(channelId => (
                        <div key={channelId} className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Channel {channelId}:</span>
                          <span className="font-medium text-orange-700 dark:text-orange-300">
                            Participant{leadingChannels.includes(channelId) ? ' & Leader' : ''}
                          </span>
                        </div>
                      ))}
                      {leadingChannels.filter(id => !participatingChannels.includes(id)).map(channelId => (
                        <div key={channelId} className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Channel {channelId}:</span>
                          <span className="font-medium text-blue-700 dark:text-blue-300">Leader Only</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User Permissions */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Your Status & Permissions</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  <span className="text-gray-600 dark:text-gray-400">Create Channels: </span>
                  <span className="font-medium text-green-700 dark:text-green-300">
                    Available (1 ETH bond required)
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${participatingChannels.length > 0 ? 'bg-orange-500' : 'bg-gray-400'}`}></span>
                    <span className="text-gray-600 dark:text-gray-400">Channel Participant:</span>
                  </div>
                  {participatingChannels.length > 0 ? (
                    <div className="ml-4 space-y-1 text-sm">
                      {participatingChannels.map(channelId => (
                        <div key={channelId} className="text-orange-700 dark:text-orange-300 font-medium">
                          - Channel {channelId}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ml-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                      No
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${canDeposit ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                    <span className="text-gray-600 dark:text-gray-400">Deposit Tokens:</span>
                  </div>
                  {participatingChannels.length > 0 ? (
                    <div className="ml-4 space-y-1 text-sm">
                      {participatingChannels.map(channelId => {
                        const canDepositInChannel = depositableChannels.includes(channelId);
                        return (
                          <div key={channelId} className={`font-medium ${
                            canDepositInChannel 
                              ? 'text-blue-700 dark:text-blue-300' 
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            - Channel {channelId}: {canDepositInChannel ? 'Available' : 'Not Available'}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="ml-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                      No
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${canWithdraw ? 'bg-purple-500' : 'bg-gray-400'}`}></span>
                    <span className="text-gray-600 dark:text-gray-400">Withdraw Tokens:</span>
                  </div>
                  {participatingChannels.length > 0 ? (
                    <div className="ml-4 space-y-1 text-sm">
                      {participatingChannels.map(channelId => {
                        const canWithdrawFromChannel = withdrawableChannels.includes(channelId);
                        return (
                          <div key={channelId} className={`font-medium ${
                            canWithdrawFromChannel 
                              ? 'text-purple-700 dark:text-purple-300' 
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            - Channel {channelId}: {canWithdrawFromChannel ? 'Available' : 'Not Available'}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="ml-4 text-sm text-gray-600 dark:text-gray-400 font-medium">
                      No
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal State Status - Show for all participants, including owners */}
          {(participatingChannels.length > 0 || isOwner) && (
            <div className="mt-6 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Personal State Status
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Initial Balance (Total Deposited) */}
                <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    Initial Balances (Deposited)
                  </h5>
                  <div className="space-y-2">
                    {userDeposits.length > 0 ? (
                      userDeposits.map((deposit, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Channel {deposit.channelId}:</span>
                          <span className="font-medium text-green-700 dark:text-green-300">
                            {formatUnits(deposit.amount, deposit.decimals)} {deposit.symbol}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">No deposits yet</span>
                        <span className="font-medium text-gray-500 dark:text-gray-400">0.00</span>
                      </div>
                    )}
                    {/* Total Deposited */}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                      <div className="flex justify-between items-center font-medium">
                        <span className="text-gray-900 dark:text-gray-100">Total Deposited:</span>
                        <div className="text-green-700 dark:text-green-300">
                          {(() => {
                            if (userDeposits.length === 0) {
                              return <span className="text-gray-500 dark:text-gray-400">0.00</span>;
                            }
                            
                            // Group deposits by token symbol
                            const totalsByToken = userDeposits.reduce((acc, deposit) => {
                              if (!acc[deposit.symbol]) {
                                acc[deposit.symbol] = { amount: BigInt(0), decimals: deposit.decimals };
                              }
                              acc[deposit.symbol].amount += deposit.amount;
                              return acc;
                            }, {} as Record<string, { amount: bigint; decimals: number }>);

                            return Object.entries(totalsByToken).map(([symbol, data], index) => (
                              <div key={symbol}>
                                {formatUnits(data.amount, data.decimals)} {symbol}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Final Amount (Withdrawn) */}
                <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                    Final Amounts (Withdrawn)
                  </h5>
                  <div className="space-y-2">
                    {userWithdraws.length > 0 ? (
                      <>
                        {userWithdraws.map((withdraw, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Channel {withdraw.channelId}:</span>
                            <span className="font-medium text-purple-700 dark:text-purple-300">
                              {formatUnits(withdraw.amount, withdraw.decimals)} {withdraw.symbol}
                            </span>
                          </div>
                        ))}
                        {/* Total Withdrawn */}
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                          <div className="flex justify-between items-center font-medium">
                            <span className="text-gray-900 dark:text-gray-100">Total Withdrawn:</span>
                            <div className="text-purple-700 dark:text-purple-300">
                              {(() => {
                                const totalsByToken = userWithdraws.reduce((acc, withdraw) => {
                                  if (!acc[withdraw.symbol]) {
                                    acc[withdraw.symbol] = { amount: BigInt(0), decimals: withdraw.decimals };
                                  }
                                  acc[withdraw.symbol].amount += withdraw.amount;
                                  return acc;
                                }, {} as Record<string, { amount: bigint; decimals: number }>);

                                return Object.keys(totalsByToken).length > 0 ? (
                                  Object.entries(totalsByToken).map(([symbol, data]) => (
                                    <div key={symbol}>
                                      {formatUnits(data.amount, data.decimals)} {symbol}
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-gray-500 dark:text-gray-400">0.00</span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          No withdrawn amounts yet
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Amounts appear here after withdrawal from closed channels
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Recommendations */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Next Steps</h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              {!hasChannels && !isParticipant && (
                <p>• You can create channels! Click "Create Channel" to start your first multi-party bridge channel (1 ETH bond required)</p>
              )}
              {isParticipant && (
                <p>• You're participating in a channel. Use "Manage Channel" to view and interact with your channel</p>
              )}
              {hasChannels && (
                <p>• Manage your existing channel or create a new one using the navigation menu</p>
              )}
              {!isParticipant && !hasChannels && (
                <p>• You can deposit tokens and participate in a channel once invited by a channel creator</p>
              )}
            </div>
          </div>
        </div>
      }
    </div>
  );
}