'use client';

import React from 'react';
import { useAccount, useContractRead } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from '@/lib/contracts';
import { ClientOnly } from '@/components/ClientOnly';

export function ContractInfo() {
  const { address, isConnected } = useAccount();

  // Check if the current user is the owner
  const { data: owner } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'owner',
    enabled: isConnected,
  });

  // Check if the current user is authorized to create channels
  const { data: isAuthorized } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'isAuthorizedCreator',
    args: address ? [address] : undefined,
    enabled: isConnected && !!address,
  });

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isConnected,
  });

  // Check participation in multiple channels (check first few channels)
  const { data: participantsChannel0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(0)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: participantsChannel1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(1)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  const { data: participantsChannel2 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(2)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 2,
  });

  // Check if user is participating in any channels
  const isParticipant = address && (
    (participantsChannel0 && participantsChannel0.includes(address)) ||
    (participantsChannel1 && participantsChannel1.includes(address)) ||
    (participantsChannel2 && participantsChannel2.includes(address))
  );
  
  // Check if user is a channel leader by getting channel stats
  const { data: channelStats0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(0)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: channelStats1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(1)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  const { data: channelStats2 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(2)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 2,
  });

  // Check if user is a leader of any channels
  const hasChannels = address && (
    (channelStats0 && channelStats0[5] && channelStats0[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats1 && channelStats1[5] && channelStats1[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats2 && channelStats2[5] && channelStats2[5].toLowerCase() === address.toLowerCase())
  );

  // Get token info for channel 0
  const { data: tokenDecimals0 } = useContractRead({
    address: channelStats0?.[1] as `0x${string}`,
    abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'decimals',
    enabled: isConnected && channelStats0?.[1] && isAddress(channelStats0[1]) && channelStats0[1] !== '0x0000000000000000000000000000000000000000',
  });

  const { data: tokenSymbol0 } = useContractRead({
    address: channelStats0?.[1] as `0x${string}`,
    abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'symbol',
    enabled: isConnected && channelStats0?.[1] && isAddress(channelStats0[1]) && channelStats0[1] !== '0x0000000000000000000000000000000000000000',
  });

  // Get token info for channel 1
  const { data: tokenDecimals1 } = useContractRead({
    address: channelStats1?.[1] as `0x${string}`,
    abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'decimals',
    enabled: isConnected && channelStats1?.[1] && isAddress(channelStats1[1]) && channelStats1[1] !== '0x0000000000000000000000000000000000000000',
  });

  const { data: tokenSymbol1 } = useContractRead({
    address: channelStats1?.[1] as `0x${string}`,
    abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'symbol',
    enabled: isConnected && channelStats1?.[1] && isAddress(channelStats1[1]) && channelStats1[1] !== '0x0000000000000000000000000000000000000000',
  });

  // Get user's deposited balance for channels they're participating in
  const { data: userDepositChannel0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getParticipantDeposit',
    args: address ? [BigInt(0), address] : undefined,
    enabled: isConnected && !!address && participantsChannel0 && participantsChannel0.includes(address),
  });

  const { data: userDepositChannel1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getParticipantDeposit',
    args: address ? [BigInt(1), address] : undefined,
    enabled: isConnected && !!address && participantsChannel1 && participantsChannel1.includes(address),
  });

  // Get deposit info with proper token details
  const getUserDepositInfo = () => {
    const deposits = [];
    
    if (userDepositChannel0 && participantsChannel0 && address && participantsChannel0.includes(address)) {
      const isETH = !channelStats0?.[1] || channelStats0[1] === '0x0000000000000000000000000000000000000000';
      deposits.push({
        amount: userDepositChannel0,
        decimals: isETH ? 18 : (tokenDecimals0 || 18),
        symbol: isETH ? 'ETH' : (tokenSymbol0 || 'TOKEN'),
        channelId: 0
      });
    }
    
    if (userDepositChannel1 && participantsChannel1 && address && participantsChannel1.includes(address)) {
      const isETH = !channelStats1?.[1] || channelStats1[1] === '0x0000000000000000000000000000000000000000';
      deposits.push({
        amount: userDepositChannel1,
        decimals: isETH ? 18 : (tokenDecimals1 || 18),
        symbol: isETH ? 'ETH' : (tokenSymbol1 || 'TOKEN'),
        channelId: 1
      });
    }
    
    return deposits;
  };

  const userDeposits = getUserDepositInfo();

  // Get channel states for permission checking - only for channels where user is actually participating
  const participatingChannelStates = [];
  
  // Check channel 0 if user is participant
  if (participantsChannel0 && address && participantsChannel0.includes(address) && channelStats0?.[2] !== undefined) {
    participatingChannelStates.push(channelStats0[2]);
  }
  
  // Check channel 1 if user is participant  
  if (participantsChannel1 && address && participantsChannel1.includes(address) && channelStats1?.[2] !== undefined) {
    participatingChannelStates.push(channelStats1[2]);
  }
  
  // Check channel 2 if user is participant  
  if (participantsChannel2 && address && participantsChannel2.includes(address) && channelStats2?.[2] !== undefined) {
    participatingChannelStates.push(channelStats2[2]);
  }
  
  // Check if user can deposit (channels in Initialized state - state 1)
  const canDeposit = participatingChannelStates.some(state => state === 1);
  
  // Check if user can withdraw (channels in Closed state - state 5)
  const canWithdraw = participatingChannelStates.some(state => state === 5);

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

  // Get channel state names for display - only for channels user is participating in
  const channelStateNames = participatingChannelStates
    .filter(state => state !== 0) // Filter out "None" states
    .map(state => getChannelStateName(state as number));

  // Get specific channels user participates in
  const getParticipatingChannels = () => {
    const channels = [];
    if (participantsChannel0 && address && participantsChannel0.includes(address)) {
      channels.push(0);
    }
    if (participantsChannel1 && address && participantsChannel1.includes(address)) {
      channels.push(1);
    }
    if (participantsChannel2 && address && participantsChannel2.includes(address)) {
      channels.push(2);
    }
    return channels;
  };

  // Get channels where user can deposit (Initialized state - state 1)
  const getDepositableChannels = () => {
    const channels = [];
    if (participantsChannel0 && address && participantsChannel0.includes(address) && channelStats0?.[2] === 1) {
      channels.push(0);
    }
    if (participantsChannel1 && address && participantsChannel1.includes(address) && channelStats1?.[2] === 1) {
      channels.push(1);
    }
    if (participantsChannel2 && address && participantsChannel2.includes(address) && channelStats2?.[2] === 1) {
      channels.push(2);
    }
    return channels;
  };

  // Get channels where user can withdraw (Closed state - state 5)
  const getWithdrawableChannels = () => {
    const channels = [];
    if (participantsChannel0 && address && participantsChannel0.includes(address) && channelStats0?.[2] === 5) {
      channels.push(0);
    }
    if (participantsChannel1 && address && participantsChannel1.includes(address) && channelStats1?.[2] === 5) {
      channels.push(1);
    }
    if (participantsChannel2 && address && participantsChannel2.includes(address) && channelStats2?.[2] === 5) {
      channels.push(2);
    }
    return channels;
  };

  const participatingChannels = getParticipatingChannels();
  const depositableChannels = getDepositableChannels();
  const withdrawableChannels = getWithdrawableChannels();



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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Authorization Status */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              isAuthorized ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <span className="text-white text-sm">
                {isAuthorized ? '✓' : '✗'}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Creator Status</p>
              <p className={`text-sm ${isAuthorized ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {isAuthorized ? 'Authorized' : 'Not Authorized'}
              </p>
            </div>
          </div>
        </div>

        {/* Channel Participation */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              isParticipant ? 'bg-orange-500' : 'bg-gray-400'
            }`}>
              <span className="text-white text-sm">
                {isParticipant ? '👥' : '○'}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Participant</p>
              <p className={`text-sm ${isParticipant ? 'text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-400'}`}>
                {isParticipant ? 'In Channel' : 'Not Participating'}
              </p>
            </div>
          </div>
        </div>

        {/* Channel Leadership */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              hasChannels ? 'bg-blue-500' : 'bg-gray-400'
            }`}>
              <span className="text-white text-sm">
                {hasChannels ? '⚒' : '○'}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Channel Leader</p>
              <p className={`text-sm ${hasChannels ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                {hasChannels ? 'Leading channel' : 'No channel yet'}
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
                  <span className="text-gray-600 dark:text-gray-400 block mb-1">Bridge Contract Address:</span>
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
                {isParticipant && channelStateNames.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-gray-600 dark:text-gray-400 block">Your Channel States:</span>
                    <div className="space-y-1">
                      {/* Display each channel the user participates in */}
                      {participantsChannel0 && address && participantsChannel0.includes(address) && channelStats0?.[2] !== undefined && typeof channelStats0[2] === 'number' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Channel 0:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{getChannelStateName(channelStats0[2])}</span>
                        </div>
                      )}
                      {participantsChannel1 && address && participantsChannel1.includes(address) && channelStats1?.[2] !== undefined && typeof channelStats1[2] === 'number' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Channel 1:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{getChannelStateName(channelStats1[2])}</span>
                        </div>
                      )}
                      {participantsChannel2 && address && participantsChannel2.includes(address) && channelStats2?.[2] !== undefined && typeof channelStats2[2] === 'number' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Channel 2:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{getChannelStateName(channelStats2[2])}</span>
                        </div>
                      )}
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
                  <span className={`h-2 w-2 rounded-full ${isAuthorized ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-gray-600 dark:text-gray-400">Create Channels: </span>
                  <span className={`font-medium ${isAuthorized ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {isAuthorized ? 'Allowed' : 'Denied'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isParticipant ? 'bg-orange-500' : 'bg-gray-400'}`}></span>
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
                {isParticipant && userDeposits.length > 0 && (
                  <div className="space-y-2">
                    {userDeposits.map((deposit, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Channel {deposit.channelId} Balance: 
                        </span>
                        <span className="font-medium text-indigo-700 dark:text-indigo-300">
                          {formatUnits(deposit.amount, deposit.decimals)} {deposit.symbol}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Recommendations */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Next Steps</h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              {!isAuthorized && !isOwner && !isParticipant && (
                <p>• Contact the project owner at <a href="mailto:hello@tokamak.network" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">hello@tokamak.network</a> to request channel creation authorization</p>
              )}
              {isAuthorized && !hasChannels && !isParticipant && (
                <p>• You can now create channels! Click "Create Channel" to start your first multi-party bridge channel</p>
              )}
              {isParticipant && (
                <p>• You're participating in a channel. Use "Manage Channel" to view and interact with your channel</p>
              )}
              {hasChannels && (
                <p>• Manage your existing channel or create a new one using the navigation menu</p>
              )}
              {isOwner && (
                <p>• As the contract owner, you can authorize other users to create channels using the form above</p>
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