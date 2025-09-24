'use client';

import { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
import { parseUnits, formatUnits, isAddress } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';

export default function DepositTokensPage() {
  const { address, isConnected } = useAccount();
  const [selectedChannel, setSelectedChannel] = useState<{
    channelId: bigint;
    targetContract: string;
    decimals?: number;
    symbol?: string;
    isETH?: boolean;
  } | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isConnected,
  });

  // Get channel participants for first few channels to check participation
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

  // Get channel stats to check states and target contracts
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

  // Get token info for each channel's target contract
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

  // Find channels user can deposit to (participating and in Initialized state - state 1)
  const availableChannels = [];

  // Get user's deposits for each channel
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

  if (participantsChannel0 && address && participantsChannel0.includes(address) && channelStats0?.[2] === 1) {
    const isETH = !channelStats0[1] || channelStats0[1] === '0x0000000000000000000000000000000000000000';
    availableChannels.push({
      channelId: BigInt(0),
      targetContract: channelStats0[1],
      state: channelStats0[2],
      totalDeposits: channelStats0[4],
      userDeposit: userDepositChannel0 || BigInt(0),
      decimals: isETH ? 18 : (tokenDecimals0 || 18),
      symbol: isETH ? 'ETH' : (tokenSymbol0 || 'TOKEN'),
      isETH
    });
  }

  if (participantsChannel1 && address && participantsChannel1.includes(address) && channelStats1?.[2] === 1) {
    const isETH = !channelStats1[1] || channelStats1[1] === '0x0000000000000000000000000000000000000000';
    availableChannels.push({
      channelId: BigInt(1),
      targetContract: channelStats1[1],
      state: channelStats1[2],
      totalDeposits: channelStats1[4],
      userDeposit: userDepositChannel1 || BigInt(0),
      decimals: isETH ? 18 : (tokenDecimals1 || 18),
      symbol: isETH ? 'ETH' : (tokenSymbol1 || 'TOKEN'),
      isETH
    });
  }

  // Deposit preparation
  const handleDeposit = async (channel: any, amount: string) => {
    if (!amount || !channel || !address) return;
    
    try {
      const parsedAmount = parseUnits(amount, channel.decimals);
      
      if (channel.isETH) {
        // ETH deposit
        if (depositETH) await depositETH();
      } else {
        // ERC20 token deposit  
        if (depositToken) await depositToken();
      }
    } catch (error) {
      console.error('Deposit error:', error);
    }
  };

  // Prepare ETH deposit
  const { config: depositETHConfig } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'depositETH',
    args: selectedChannel ? [selectedChannel.channelId] : undefined,
    value: selectedChannel && depositAmount ? parseUnits(depositAmount, selectedChannel.decimals || 18) : undefined,
    enabled: Boolean(selectedChannel?.isETH && depositAmount && address),
  });

  const { write: depositETH, isLoading: isDepositingETH } = useContractWrite(depositETHConfig);

  // Prepare Token deposit
  const { config: depositTokenConfig } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'depositToken',
    args: selectedChannel && depositAmount ? [
      selectedChannel.channelId,
      selectedChannel.targetContract as `0x${string}`,
      parseUnits(depositAmount, selectedChannel.decimals || 18)
    ] : undefined,
    enabled: Boolean(selectedChannel && !selectedChannel.isETH && depositAmount && address),
  });

  const { write: depositToken, isLoading: isDepositingToken } = useContractWrite(depositTokenConfig);

  // Prepare approval transaction
  const { config: approveConfig } = usePrepareContractWrite({
    address: selectedChannel && !selectedChannel.isETH ? selectedChannel.targetContract as `0x${string}` : undefined,
    abi: [{ name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }] }],
    functionName: 'approve',
    args: selectedChannel && depositAmount ? [
      ROLLUP_BRIDGE_ADDRESS,
      parseUnits(depositAmount, selectedChannel.decimals || 18)
    ] : undefined,
    enabled: Boolean(selectedChannel && !selectedChannel.isETH && depositAmount && address),
  });

  const { write: approveToken, isLoading: isApproving, data: approveData } = useContractWrite(approveConfig);

  // Watch for approval transaction completion
  const { isLoading: isWaitingApproval, isSuccess: approvalSuccess } = useWaitForTransaction({
    hash: approveData?.hash,
    enabled: !!approveData?.hash,
  });

  // Get allowance with refetch capability
  const { data: allowance, refetch: refetchAllowance } = useContractRead({
    address: selectedChannel && !selectedChannel.isETH ? selectedChannel.targetContract as `0x${string}` : undefined,
    abi: [{ name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [{ type: 'address' }, { type: 'address' }] }],
    functionName: 'allowance',
    args: selectedChannel && address ? [address, ROLLUP_BRIDGE_ADDRESS] : undefined,
    enabled: Boolean(selectedChannel && !selectedChannel.isETH && address),
  });

  // Refetch allowance when approval transaction succeeds
  useEffect(() => {
    if (approvalSuccess && refetchAllowance) {
      // Small delay to ensure blockchain state is updated
      setTimeout(() => {
        refetchAllowance();
      }, 2000);
    }
  }, [approvalSuccess, refetchAllowance]);

  // Check if approval is needed
  const needsApproval = selectedChannel && !selectedChannel.isETH && depositAmount && allowance !== undefined
    ? allowance < parseUnits(depositAmount, selectedChannel.decimals || 18)
    : false;

  const handleChannelSelect = (channel: any) => {
    setSelectedChannel(channel);
    setDepositAmount('');
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ClientOnly>
          <Sidebar isConnected={isConnected} />
        </ClientOnly>
        <div className="lg:ml-64 transition-all duration-300">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Connect Your Wallet</h1>
              <p className="text-gray-600 dark:text-gray-300 mb-6">You need to connect your wallet to deposit tokens</p>
              <ClientOnly>
                <ConnectButton />
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <ClientOnly>
        <Sidebar isConnected={isConnected} />
      </ClientOnly>

      {/* Main Content Area */}
      <div className="lg:ml-64 transition-all duration-300">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
          <div className="px-4 py-4 lg:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 ml-12 lg:ml-0">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">💰</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Deposit Tokens</h1>
              </div>
              <div className="flex items-center gap-3">
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

        {/* Main Content */}
        <main className="px-4 py-8 lg:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 transition-colors duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Available Channels for Deposit</h2>
                <p className="text-gray-600 dark:text-gray-300">
                  You can only deposit tokens into channels where you're a participant and the channel is in an initialized state.
                </p>
              </div>

              <ClientOnly>
                {availableChannels.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📭</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">No Channels Available</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                    You're not participating in any initialized channels, or your channels are not ready for deposits yet.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 max-w-md mx-auto transition-colors duration-300">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">To deposit tokens, you need:</h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 text-left">
                      <li>• To be a participant in a channel</li>
                      <li>• The channel must be in "Initialized" state</li>
                      <li>• Channel leader must initialize the channel first</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {availableChannels.map((channel) => (
                    <div key={channel.channelId.toString()} className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-lg p-6 hover:shadow-md transition-all duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">#{channel.channelId.toString()}</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Channel {channel.channelId.toString()}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Ready for deposits</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Your Deposits</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {formatUnits(channel.userDeposit || BigInt(0), channel.decimals)} {channel.symbol}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Target Contract:</span>
                          <p className="font-mono text-xs break-all text-gray-900 dark:text-gray-100">
                            {channel.isETH ? 'ETH (Native)' : channel.targetContract}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">State:</span>
                          <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs font-medium">
                            Initialized
                          </span>
                        </div>
                      </div>

                      {/* Deposit Section */}
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Amount to Deposit
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={selectedChannel?.channelId === channel.channelId ? depositAmount : ''}
                                onChange={(e) => {
                                  if (selectedChannel?.channelId !== channel.channelId) {
                                    handleChannelSelect(channel);
                                  }
                                  setDepositAmount(e.target.value);
                                }}
                                placeholder={`0.0`}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                              />
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                  {channel.symbol}
                                </span>
                              </div>
                            </div>
                          </div>
                          {/* Approval/Deposit buttons */}
                          {selectedChannel?.channelId === channel.channelId && !channel.isETH && needsApproval ? (
                            <button
                              onClick={() => approveToken?.()}
                              disabled={!depositAmount || isApproving || isWaitingApproval || !approveToken}
                              className="px-6 py-2 bg-orange-600 dark:bg-orange-700 text-white rounded-md hover:bg-orange-700 dark:hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors duration-200"
                            >
                              {isApproving ? 'Approving...' : isWaitingApproval ? 'Confirming...' : 'Approve'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeposit(channel, selectedChannel?.channelId === channel.channelId ? depositAmount : '')}
                              disabled={
                                !depositAmount || 
                                (selectedChannel?.channelId !== channel.channelId) || 
                                isDepositingETH || 
                                isDepositingToken ||
                                (!channel.isETH && needsApproval)
                              }
                              className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                            >
                              {(isDepositingETH || isDepositingToken) ? 'Depositing...' : 'Deposit'}
                            </button>
                          )}
                        </div>
                        {channel.isETH ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Depositing native ETH to the bridge contract
                          </p>
                        ) : (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {selectedChannel?.channelId === channel.channelId && needsApproval ? (
                              <p className="text-orange-600 dark:text-orange-400">
                                ⚠️ First approve the bridge contract to spend your {channel.symbol} tokens
                              </p>
                            ) : selectedChannel?.channelId === channel.channelId && !needsApproval && allowance !== undefined ? (
                              <p className="text-green-600 dark:text-green-400">
                                ✅ Bridge contract approved to spend your {channel.symbol} tokens
                              </p>
                            ) : (
                              <p>
                                ERC20 token deposit requires approval first
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </ClientOnly>
            </div>
          </div>
        </main>
      </div>

    </div>
  );
}