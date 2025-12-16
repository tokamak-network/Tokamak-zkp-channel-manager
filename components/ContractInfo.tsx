'use client';

import React from 'react';
import Link from 'next/link';
import { useAccount, useContractRead, useContractReads } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import { ClientOnly } from '@/components/ClientOnly';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';
import { Info, Users, Wrench } from 'lucide-react';

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
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getParticipantDeposit',
    args: address ? [BigInt(channelId), address] : undefined,
  }));

  const { data: depositData } = useContractReads({
    contracts: depositContracts,
    enabled: isConnected && !!address && participatingChannels.length > 0,
  });

  // Helper function to get token info with correct decimals
  const getTokenInfo = (tokenAddress: string) => {
    if (tokenAddress === '0x0000000000000000000000000000000000000001') {
      return { symbol: 'ETH', decimals: 18, isETH: true, address: tokenAddress };
    }
    
    // Known tokens with correct decimals
    if (tokenAddress.toLowerCase() === '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd'.toLowerCase()) {
      return { symbol: 'WTON', decimals: 27, isETH: false, address: tokenAddress }; // WTON has 27 decimals
    }
    if (tokenAddress.toLowerCase() === '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A'.toLowerCase()) {
      return { symbol: 'USDT', decimals: 6, isETH: false, address: tokenAddress }; // USDT has 6 decimals
    }
    if (tokenAddress.toLowerCase() === '0xa30fe40285B8f5c0457DbC3B7C8A280373c40044'.toLowerCase()) {
      return { symbol: 'TON', decimals: 18, isETH: false, address: tokenAddress }; // TON has 18 decimals
    }
    
    return { symbol: 'TOKEN', decimals: 18, isETH: false, address: tokenAddress };
  };

  // Create mappings for all tokens in all channels 
  // In the new architecture, each channel has a single targetContract (token)
  const channelToTokensIndex: Record<number, Array<{ tokenIndex: number; tokenAddress: string }>> = {};
  let tokenContractIndex = 0;
  
  const tokenContracts = participatingChannels.flatMap(channelId => {
    const channelStats = channelStatsData[channelId];
    const targetContract = channelStats?.[1] as string | undefined; // Single target contract, not array
    
    if (!targetContract || targetContract === '0x0000000000000000000000000000000000000000') {
      return [];
    }

    // Map single token for this channel
    channelToTokensIndex[channelId] = [];
    const tokenInfo = getTokenInfo(targetContract);
    
    // Skip if ETH (no contract calls needed) 
    if (tokenInfo.isETH) {
      channelToTokensIndex[channelId].push({ tokenIndex: -1, tokenAddress: targetContract }); // -1 for ETH
      return [];
    }

    // Only fetch contract data for non-default tokens (unknown tokens)
    if (tokenInfo.symbol === 'TOKEN') {
      // Map this token to current contract index  
      channelToTokensIndex[channelId].push({ tokenIndex: tokenContractIndex, tokenAddress: targetContract });
      tokenContractIndex++;

      return [
        {
          address: targetContract as `0x${string}`,
          abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }] as const,
          functionName: 'decimals',
        },
        {
          address: targetContract as `0x${string}`,
          abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }] as const,
          functionName: 'symbol',
        }
      ];
    } else {
      // Known token, no contract calls needed
      channelToTokensIndex[channelId].push({ tokenIndex: -2, tokenAddress: targetContract }); // -2 for known tokens  
      return [];
    }
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

  // In the new architecture, we use getParticipantDeposit which returns the deposit for the channel's token
  // No need for separate token deposit calls - depositData already contains this

  // Get user deposit information for all participating channels
  // In the new architecture, each channel has a single targetContract (token)
  const getUserDepositInfo = () => {
    const deposits: Array<{ amount: bigint; decimals: number; symbol: string; channelId: number; tokenAddress: string; }> = [];
    
    participatingChannels.forEach((channelId, index) => {
      const channelStats = channelStatsData[channelId];
      const targetContract = channelStats?.[1] as string | undefined;
      
      if (!targetContract || targetContract === '0x0000000000000000000000000000000000000000') {
        return;
      }
      
      // Get deposit amount from depositData (same index as participatingChannels)
      const depositAmount = depositData?.[index]?.result as bigint;
      const tokenInfo = getTokenInfo(targetContract);
      
      let decimals = tokenInfo.decimals;
      let symbol = tokenInfo.symbol;
      
      // Get actual decimals/symbol for unknown tokens
      if (tokenInfo.symbol === 'TOKEN') {
        const tokenMapping = channelToTokensIndex[channelId]?.find(t => t.tokenAddress === targetContract);
        if (tokenMapping && tokenMapping.tokenIndex >= 0) {
          const decimalsResult = tokenData?.[tokenMapping.tokenIndex * 2]?.result as number;
          const symbolResult = tokenData?.[tokenMapping.tokenIndex * 2 + 1]?.result as string;
          
          decimals = decimalsResult || 18;
          symbol = symbolResult || 'TOKEN';
        }
      }
      
      // Only include if there's a deposit amount > 0
      if (depositAmount && depositAmount > BigInt(0)) {
        deposits.push({
          amount: depositAmount,
          decimals,
          symbol,
          channelId,
          tokenAddress: targetContract
        });
      }
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
      <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-8 shadow-lg shadow-[#4fc3f7]/20">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-3 w-3 bg-[#4fc3f7]  animate-pulse"></div>
          <h3 className="text-lg font-semibold text-white">Your Information</h3>
        </div>
        <p className="text-gray-300 text-center">
          Connect your wallet to view contract information and authorization status
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-8 shadow-lg shadow-[#4fc3f7]/20 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-r from-[#4fc3f7] to-[#29b6f6] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Your Information</h3>
            <p className="text-sm text-gray-300">Your account status and permissions</p>
          </div>
        </div>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Channel Participation */}
        <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/50 p-4 shadow-lg shadow-[#4fc3f7]/20">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8  flex items-center justify-center shadow-lg ${
              participatingChannels.length > 0 ? 'bg-[#4fc3f7] shadow-[#4fc3f7]/30' : 'bg-gray-600'
            }`}>
              {participatingChannels.length > 0 ? (
                <Users className="w-4 h-4 text-white" />
              ) : (
                <span className="text-white text-sm">○</span>
              )}
            </div>
            <div>
              <p className="font-medium text-white">Participant</p>
              <p className={`text-sm ${participatingChannels.length > 0 ? 'text-[#4fc3f7]' : 'text-gray-400'}`}>
                {participatingChannels.length > 0 ? `In ${participatingChannels.length} channel${participatingChannels.length > 1 ? 's' : ''}` : 'Not Participating'}
              </p>
            </div>
          </div>
        </div>

        {/* Channel Leadership */}
        <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/50 p-4 shadow-lg shadow-[#4fc3f7]/20">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8  flex items-center justify-center shadow-lg ${
              leadingChannels.length > 0 ? 'bg-[#4fc3f7] shadow-[#4fc3f7]/30' : 'bg-gray-600'
            }`}>
              {leadingChannels.length > 0 ? (
                <Wrench className="w-4 h-4 text-white" />
              ) : (
                <span className="text-white text-sm">○</span>
              )}
            </div>
            <div>
              <p className="font-medium text-white">Channel Leader</p>
              <p className={`text-sm ${leadingChannels.length > 0 ? 'text-[#4fc3f7]' : 'text-gray-400'}`}>
                {leadingChannels.length > 0 ? `Leading ${leadingChannels.length} channel${leadingChannels.length > 1 ? 's' : ''}` : 'No channel yet'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      <div className="border-t-2 border-[#4fc3f7]/30 pt-6 mt-6">
          {/* Contract Details - Horizontal Cards */}
          <div className="mb-6 space-y-4">
            <h4 className="font-medium text-white mb-4 text-lg">Contract Overview</h4>
            
            {/* Manager Address Card - Full Width */}
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-[#4fc3f7] p-2 rounded">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-400">Manager Contract Address</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-[#0a1930] text-[#4fc3f7] px-3 py-2 rounded font-mono break-all border border-[#4fc3f7]/20">
                  {ROLLUP_BRIDGE_ADDRESS}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(ROLLUP_BRIDGE_ADDRESS);
                    const btn = document.activeElement as HTMLButtonElement;
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                    setTimeout(() => {
                      btn.innerHTML = originalHTML;
                    }, 2000);
                  }}
                  className="bg-[#4fc3f7] hover:bg-[#029bee] text-white p-2 rounded transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/30 flex-shrink-0"
                  title="Copy address"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Total Channels and Next ID - Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Total Channels Card */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-4 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-[#4fc3f7] p-2 rounded">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-400">Total Channels</p>
                    <p className="text-2xl font-bold text-white">{totalChannels?.toString() || '0'}</p>
                  </div>
                </div>
              </div>

              {/* Next Channel ID Card */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-4 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-[#4fc3f7] p-2 rounded">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-400">Next Channel ID</p>
                    <p className="text-2xl font-bold text-white">{totalChannels?.toString() || '0'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Your Channels & Permissions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Channel Participation */}
            {(participatingChannels.length > 0 || leadingChannels.length > 0) && (
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-5 shadow-lg shadow-[#4fc3f7]/20">
                <h4 className="font-medium text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#4fc3f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Your Channel Roles
                </h4>
                <div className="space-y-2">
                  {participatingChannels.map(channelId => (
                    <div key={channelId} className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-3 hover:border-[#4fc3f7] transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-[#4fc3f7] px-2 py-1 rounded text-white font-bold text-sm">
                            #{channelId}
                          </div>
                          <span className="text-white font-medium">Channel {channelId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {leadingChannels.includes(channelId) && (
                            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              Leader
                            </span>
                          )}
                          <span className="bg-[#4fc3f7]/20 border border-[#4fc3f7]/30 text-[#4fc3f7] px-2 py-1 rounded text-xs font-medium">
                            Participant
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {leadingChannels.filter(id => !participatingChannels.includes(id)).map(channelId => (
                    <div key={channelId} className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-3 hover:border-[#4fc3f7] transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-[#4fc3f7] px-2 py-1 rounded text-white font-bold text-sm">
                            #{channelId}
                          </div>
                          <span className="text-white font-medium">Channel {channelId}</span>
                        </div>
                        <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          Leader Only
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions & Actions */}
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-5 shadow-lg shadow-[#4fc3f7]/20">
              <h4 className="font-medium text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#4fc3f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Available Actions
              </h4>
              <div className="space-y-3">
                {/* Create Channels - Only if not already leading a channel */}
                {leadingChannels.length === 0 ? (
                  <Link href="/create-channel" className="block">
                    <div className="bg-green-500/10 border border-green-500/30 p-3 cursor-pointer hover:bg-green-500/20 transition-all hover:shadow-lg hover:shadow-green-500/10">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500 p-1.5 rounded">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">Create New Channel</p>
                          <p className="text-xs text-gray-400">0.001 ETH bond required</p>
                        </div>
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-gray-800/30 border-gray-700/30 border p-3 opacity-60 cursor-not-allowed">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-600 p-1.5 rounded">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Create New Channel</p>
                        <p className="text-xs text-gray-400">Already leading {leadingChannels.length} channel{leadingChannels.length > 1 ? 's' : ''}</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Freeze State */}
                {canDeposit ? (
                  <Link href="/deposit-tokens" className="block">
                    <div className="bg-[#4fc3f7]/10 border-[#4fc3f7]/30 border p-3 cursor-pointer hover:bg-[#4fc3f7]/20 transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/10">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#4fc3f7] p-1.5 rounded">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">Freeze State</p>
                          {participatingChannels.length > 0 && (
                        <div className="space-y-1">
                          {participatingChannels.map(channelId => {
                            const canDepositInChannel = depositableChannels.includes(channelId);
                            return (
                              <div key={channelId} className="flex items-center gap-2 text-xs">
                                <div className={`h-1.5 w-1.5 rounded-full ${canDepositInChannel ? 'bg-[#4fc3f7]' : 'bg-gray-500'}`}></div>
                                <span className={canDepositInChannel ? 'text-[#4fc3f7]' : 'text-gray-500'}>
                                  Channel {channelId}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                        </div>
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-gray-800/30 border-gray-700/30 border p-3 opacity-60 cursor-not-allowed">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-600 p-1.5 rounded">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Freeze State</p>
                        {participatingChannels.length > 0 && (
                        <div className="space-y-1">
                          {participatingChannels.map(channelId => {
                            const canDepositInChannel = depositableChannels.includes(channelId);
                            return (
                              <div key={channelId} className="flex items-center gap-2 text-xs">
                                <div className={`h-1.5 w-1.5 rounded-full ${canDepositInChannel ? 'bg-[#4fc3f7]' : 'bg-gray-500'}`}></div>
                                <span className={canDepositInChannel ? 'text-[#4fc3f7]' : 'text-gray-500'}>
                                  Channel {channelId}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      </div>
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Withdraw Tokens */}
                {canWithdraw ? (
                  <Link href="/withdraw-tokens" className="block">
                    <div className="bg-[#4fc3f7]/10 border-[#4fc3f7]/30 border p-3 cursor-pointer hover:bg-[#4fc3f7]/20 transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/10">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#4fc3f7] p-1.5 rounded">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20v-16m0 16l-4-4m4 4l4-4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">Withdraw Tokens</p>
                          {participatingChannels.length > 0 && (
                        <div className="space-y-1">
                          {participatingChannels.map(channelId => {
                            const canWithdrawFromChannel = withdrawableChannels.includes(channelId);
                            return (
                              <div key={channelId} className="flex items-center gap-2 text-xs">
                                <div className={`h-1.5 w-1.5 rounded-full ${canWithdrawFromChannel ? 'bg-[#4fc3f7]' : 'bg-gray-500'}`}></div>
                                <span className={canWithdrawFromChannel ? 'text-[#4fc3f7]' : 'text-gray-500'}>
                                  Channel {channelId}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                        </div>
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-gray-800/30 border-gray-700/30 border p-3 opacity-60 cursor-not-allowed">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-600 p-1.5 rounded">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20v-16m0 16l-4-4m4 4l4-4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Withdraw Tokens</p>
                        {participatingChannels.length > 0 && (
                      <div className="space-y-1">
                        {participatingChannels.map(channelId => {
                          const canWithdrawFromChannel = withdrawableChannels.includes(channelId);
                          return (
                            <div key={channelId} className="flex items-center gap-2 text-xs">
                              <div className={`h-1.5 w-1.5 rounded-full ${canWithdrawFromChannel ? 'bg-[#4fc3f7]' : 'bg-gray-500'}`}></div>
                              <span className={canWithdrawFromChannel ? 'text-[#4fc3f7]' : 'text-gray-500'}>
                                Channel {channelId}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                      </div>
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Personal State Status - Show for all participants, including owners */}
        {(participatingChannels.length > 0 || isOwner) && (
          <div className="mt-6 p-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
            <h4 className="font-medium text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#4fc3f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Personal State Status
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Initial Balance (Total Deposited) */}
              <div className="bg-[#0a1930]/50 p-4  border border-[#4fc3f7]/30 shadow-lg shadow-[#4fc3f7]/20">
                <h5 className="font-medium text-white mb-3 flex items-center gap-2">
                  <div className="h-2 w-2 bg-[#4fc3f7] "></div>
                  Initial Balances (Deposited)
                </h5>
                <div className="space-y-2">
                    {userDeposits.length > 0 ? (
                      userDeposits.map((deposit, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-300">
                            Channel {deposit.channelId} ({deposit.symbol}):
                          </span>
                          <span className="font-medium text-[#4fc3f7]">
                            {formatUnits(deposit.amount, deposit.decimals)} {deposit.symbol}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">No deposits yet</span>
                        <span className="font-medium text-gray-400">0.00</span>
                      </div>
                    )}
                    {/* Total Deposited */}
                    <div className="border-t-2 border-[#4fc3f7]/30 pt-2 mt-2">
                      <div className="flex justify-between items-center font-medium">
                        <span className="text-white">Total Deposited:</span>
                        <div className="text-[#4fc3f7]">
                          {(() => {
                            if (userDeposits.length === 0) {
                              return <span className="text-gray-400">0.00</span>;
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
                <div className="bg-[#0a1930]/50 p-4  border border-[#4fc3f7]/50 shadow-lg shadow-[#4fc3f7]/20">
                  <h5 className="font-medium text-white mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 bg-[#4fc3f7] "></div>
                    Final Amounts (Withdrawn)
                  </h5>
                  <div className="space-y-2">
                    {userWithdraws.length > 0 ? (
                      <>
                        {userWithdraws.map((withdraw, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-gray-300">Channel {withdraw.channelId}:</span>
                            <span className="font-medium text-[#4fc3f7]">
                              {formatUnits(withdraw.amount, withdraw.decimals)} {withdraw.symbol}
                            </span>
                          </div>
                        ))}
                        {/* Total Withdrawn */}
                        <div className="border-t-2 border-[#4fc3f7]/30 pt-2 mt-2">
                          <div className="flex justify-between items-center font-medium">
                            <span className="text-white">Total Withdrawn:</span>
                            <div className="text-[#4fc3f7]">
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
                                  <span className="text-gray-400">0.00</span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-400 text-sm">
                          No withdrawn amounts yet
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
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
          <div className="mt-4 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30 ">
            <h4 className="font-medium text-white mb-2">Next Steps</h4>
            <div className="text-sm text-gray-300 space-y-1">
              {!hasChannels && !isParticipant && (
                <p>• You can create channels! Click "Create Channel" to start your first multi-party bridge channel (0.001 ETH bond required)</p>
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
  );
}