'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { ClientOnly } from '@/components/ClientOnly';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Sidebar } from '@/components/Sidebar';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { ChannelState } from '@/lib/types';
import { canWithdraw } from '@/lib/utils';

interface WithdrawableChannel {
  channelId: bigint;
  targetContract: string;
  state: ChannelState;
  isETH: boolean;
  symbol: string;
  decimals: number;
  userDeposit: bigint;
  hasWithdrawn: boolean;
}

export default function WithdrawTokensPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  
  // Form state
  const [selectedChannel, setSelectedChannel] = useState<WithdrawableChannel | null>(null);
  const [claimedBalance, setClaimedBalance] = useState('');
  const [leafIndex, setLeafIndex] = useState('');
  const [merkleProofInput, setMerkleProofInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isConnected,
  });

  // Get channel data for channels 0 and 1 (expand as needed)
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

  // Get participants for channels
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

  // Get user deposits for channels they participated in
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

  // Check if user has already withdrawn from channels
  const { data: hasWithdrawnChannel0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'hasWithdrawn',
    args: address ? [BigInt(0), address] : undefined,
    enabled: isConnected && !!address && participantsChannel0 && participantsChannel0.includes(address),
  });

  const { data: hasWithdrawnChannel1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'hasWithdrawn',
    args: address ? [BigInt(1), address] : undefined,
    enabled: isConnected && !!address && participantsChannel1 && participantsChannel1.includes(address),
  });

  // Get token symbols and decimals for ERC20 tokens
  const { data: tokenSymbol0 } = useContractRead({
    address: channelStats0?.[1] !== '0x0000000000000000000000000000000000000000' ? channelStats0?.[1] as `0x${string}` : undefined,
    abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'symbol',
    enabled: !!channelStats0?.[1] && channelStats0[1] !== '0x0000000000000000000000000000000000000000',
  });

  const { data: tokenDecimals0 } = useContractRead({
    address: channelStats0?.[1] !== '0x0000000000000000000000000000000000000000' ? channelStats0?.[1] as `0x${string}` : undefined,
    abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'decimals',
    enabled: !!channelStats0?.[1] && channelStats0[1] !== '0x0000000000000000000000000000000000000000',
  });

  const { data: tokenSymbol1 } = useContractRead({
    address: channelStats1?.[1] !== '0x0000000000000000000000000000000000000000' ? channelStats1?.[1] as `0x${string}` : undefined,
    abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'symbol',
    enabled: !!channelStats1?.[1] && channelStats1[1] !== '0x0000000000000000000000000000000000000000',
  });

  const { data: tokenDecimals1 } = useContractRead({
    address: channelStats1?.[1] !== '0x0000000000000000000000000000000000000000' ? channelStats1?.[1] as `0x${string}` : undefined,
    abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'decimals',
    enabled: !!channelStats1?.[1] && channelStats1[1] !== '0x0000000000000000000000000000000000000000',
  });

  // Build withdrawable channels list
  const withdrawableChannels: WithdrawableChannel[] = [];

  if (channelStats0 && participantsChannel0 && address && participantsChannel0.includes(address) && channelStats0[2] === 5) { // Closed state
    const isETH = !channelStats0[1] || channelStats0[1] === '0x0000000000000000000000000000000000000000';
    withdrawableChannels.push({
      channelId: BigInt(0),
      targetContract: channelStats0[1],
      state: channelStats0[2] as ChannelState,
      isETH,
      symbol: isETH ? 'ETH' : (tokenSymbol0 || 'TOKEN'),
      decimals: isETH ? 18 : (tokenDecimals0 || 18),
      userDeposit: userDepositChannel0 || BigInt(0),
      hasWithdrawn: hasWithdrawnChannel0 || false,
    });
  }

  if (channelStats1 && participantsChannel1 && address && participantsChannel1.includes(address) && channelStats1[2] === 5) { // Closed state
    const isETH = !channelStats1[1] || channelStats1[1] === '0x0000000000000000000000000000000000000000';
    withdrawableChannels.push({
      channelId: BigInt(1),
      targetContract: channelStats1[1],
      state: channelStats1[2] as ChannelState,
      isETH,
      symbol: isETH ? 'ETH' : (tokenSymbol1 || 'TOKEN'),
      decimals: isETH ? 18 : (tokenDecimals1 || 18),
      userDeposit: userDepositChannel1 || BigInt(0),
      hasWithdrawn: hasWithdrawnChannel1 || false,
    });
  }

  // Parse merkle proof from input
  const merkleProof = merkleProofInput
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.startsWith('0x'))
    .map(line => line as `0x${string}`);

  // Prepare withdraw transaction
  const { config: withdrawConfig } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'withdrawAfterClose',
    args: selectedChannel && claimedBalance && leafIndex && merkleProof.length > 0 ? [
      selectedChannel.channelId,
      parseUnits(claimedBalance, selectedChannel.decimals),
      BigInt(leafIndex),
      merkleProof
    ] : undefined,
    enabled: Boolean(
      selectedChannel &&
      claimedBalance &&
      leafIndex &&
      merkleProof.length > 0 &&
      address &&
      !selectedChannel.hasWithdrawn
    ),
  });

  const { write: withdrawTokens, isLoading: isWithdrawing, data: withdrawData } = useContractWrite(withdrawConfig);

  // Wait for withdraw transaction
  const { isLoading: isWaitingWithdraw, isSuccess: withdrawSuccess } = useWaitForTransaction({
    hash: withdrawData?.hash,
    enabled: !!withdrawData?.hash,
  });

  const handleChannelSelect = (channel: WithdrawableChannel) => {
    setSelectedChannel(channel);
    setClaimedBalance('');
    setLeafIndex('');
    setMerkleProofInput('');
  };

  const handleWithdraw = async () => {
    if (!withdrawTokens || !selectedChannel) return;
    
    setIsSubmitting(true);
    try {
      await withdrawTokens();
    } catch (error) {
      console.error('Withdraw error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = selectedChannel && 
                     claimedBalance && 
                     leafIndex && 
                     merkleProof.length > 0 && 
                     !selectedChannel.hasWithdrawn;

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
              <p className="text-gray-600 dark:text-gray-300 mb-6">You need to connect your wallet to withdraw tokens</p>
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
                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">💳</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Withdraw Tokens</h1>
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

        <ClientOnly>
          <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Info Banner */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="text-blue-400 text-xl">ℹ️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Withdrawal Requirements
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Channel must be in "Closed" state</li>
                      <li>You must have participated in the channel</li>
                      <li>You need the Merkle proof data provided by the channel leader</li>
                      <li>You can only withdraw once per channel</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Withdrawable Channels */}
            {withdrawableChannels.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Available Withdrawals
                </h2>
                
                <div className="grid gap-4 mb-6">
                  {withdrawableChannels.map((channel) => (
                    <div
                      key={channel.channelId.toString()}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedChannel?.channelId === channel.channelId
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      } ${
                        channel.hasWithdrawn
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                      onClick={() => !channel.hasWithdrawn && handleChannelSelect(channel)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className={`w-3 h-3 rounded-full ${
                              channel.hasWithdrawn 
                                ? 'bg-gray-400' 
                                : selectedChannel?.channelId === channel.channelId 
                                ? 'bg-blue-500' 
                                : 'bg-green-500'
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                Channel #{channel.channelId.toString()}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full">
                                Closed
                              </span>
                              {channel.hasWithdrawn && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                                  Already Withdrawn
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Target: {channel.isETH ? 'ETH (Native)' : channel.targetContract}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {formatUnits(channel.userDeposit, channel.decimals)} {channel.symbol}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Your Deposit
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Withdraw Form */}
                {selectedChannel && !selectedChannel.hasWithdrawn && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                      Withdrawal Details for Channel #{selectedChannel.channelId.toString()}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Claimed Balance
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={claimedBalance}
                          onChange={(e) => setClaimedBalance(e.target.value)}
                          placeholder="0.0"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Amount you're claiming to withdraw ({selectedChannel.symbol})
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Leaf Index
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={leafIndex}
                          onChange={(e) => setLeafIndex(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Your position in the Merkle tree
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Merkle Proof
                      </label>
                      <textarea
                        value={merkleProofInput}
                        onChange={(e) => setMerkleProofInput(e.target.value)}
                        placeholder="0x123abc...
0x456def...
0x789ghi..."
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Enter each proof hash on a new line. This data should be provided by the channel leader.
                      </p>
                      {merkleProof.length > 0 && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          ✅ {merkleProof.length} proof elements detected
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end mt-6">
                      <button
                        onClick={handleWithdraw}
                        disabled={!isFormValid || isWithdrawing || isWaitingWithdraw || isSubmitting}
                        className="px-6 py-2 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200 flex items-center gap-2"
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
                      <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                        <div className="flex items-start">
                          <span className="text-green-400 text-xl mr-3">✅</span>
                          <div>
                            <h4 className="font-medium text-green-800 dark:text-green-200">
                              Withdrawal Successful!
                            </h4>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                              Your tokens have been successfully withdrawn from Channel #{selectedChannel.channelId.toString()}.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <div className="text-gray-400 text-6xl mb-4">💳</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No Withdrawals Available
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  You don't have any tokens to withdraw from closed channels at the moment.
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>Withdrawals are only available when:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>You participated in a channel that has been closed</li>
                    <li>You haven't already withdrawn your tokens</li>
                    <li>The channel leader has provided withdrawal proofs</li>
                  </ul>
                </div>
              </div>
            )}
            </div>
          </div>
        </ClientOnly>
      </div>
    </div>
  );
}