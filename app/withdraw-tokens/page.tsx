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
import { generateWithdrawalProof, getMockParticipantData, WithdrawalProofData } from '@/lib/merkleProofGenerator';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedProof, setGeneratedProof] = useState<WithdrawalProofData | null>(null);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

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

  // Get L2 public keys (addresses) for the user's L1 address
  const { data: l2AddressChannel0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getL2PublicKey',
    args: address ? [BigInt(0), address] : undefined,
    enabled: isConnected && !!address && participantsChannel0 && participantsChannel0.includes(address),
  });

  const { data: l2AddressChannel1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getL2PublicKey',
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

  // Prepare withdraw transaction
  const { config: withdrawConfig } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'withdrawAfterClose',
    args: generatedProof ? [
      BigInt(generatedProof.channelId),
      BigInt(generatedProof.claimedBalance),
      BigInt(generatedProof.leafIndex),
      generatedProof.merkleProof as `0x${string}`[]
    ] : undefined,
    enabled: Boolean(
      generatedProof &&
      address &&
      selectedChannel &&
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
    setGeneratedProof(null);
    setProofError(null);
  };

  const handleGenerateProof = async () => {
    if (!selectedChannel || !claimedBalance || !address) return;
    
    setIsGeneratingProof(true);
    setProofError(null);
    setGeneratedProof(null);
    
    try {
      // Get the L2 address for this L1 address and channel
      let l2Address: string | null = null;
      if (selectedChannel.channelId === BigInt(0)) {
        l2Address = l2AddressChannel0 as string;
      } else if (selectedChannel.channelId === BigInt(1)) {
        l2Address = l2AddressChannel1 as string;
      }
      
      // If no L2 address mapping exists, derive it from L1 address for development/testing
      if (!l2Address || l2Address === '0x0000000000000000000000000000000000000000') {
        // For development: create a deterministic L2 address based on L1 address and channel
        // This is a simple approach - in production you'd want a more sophisticated mapping
        const addressNum = BigInt(address);
        const channelOffset = BigInt(selectedChannel.channelId.toString()) + BigInt(1000000);
        const maxAddress = BigInt("0xffffffffffffffffffffffffffffffffffffffff"); // 2^160 - 1
        const derivedL2 = (addressNum + channelOffset) % (maxAddress + BigInt(1));
        l2Address = `0x${derivedL2.toString(16).padStart(40, '0')}`;
        
        console.log(`No L2 public key found, using derived L2 address: ${l2Address} for L1: ${address} in channel ${selectedChannel.channelId}`);
      }
      
      // Get participant data (in production, this would fetch from contract)
      // For now, we'll create mock data that includes the user's L2 address
      const participantsData = [
        {
          participantRoot: "0x8449acb4300b58b00e4852ab07d43f298eaa35688eaa3917ca205f20e6db73e8",
          l2Address: l2Address, // Use the user's actual L2 address
          balance: parseUnits(claimedBalance, selectedChannel.decimals).toString() // Use their claimed balance
        },
        // Add other mock participants to fill the tree
        {
          participantRoot: "0x3bec727653ae8d56ac6d9c103182ff799fe0a3b512e9840f397f0d21848373e8",
          l2Address: "0xb18E7CdB6Aa28Cc645227041329896446A1478bd",
          balance: "1000000000000000000"
        },
        {
          participantRoot: "0x11e1e541a59fb2cd7fa4371d63103972695ee4bb4d1e646e72427cf6cdc16498",
          l2Address: "0x9D70617FF571Ac34516C610a51023EE1F28373e8",
          balance: "1000000000000000000"
        }
      ];
      
      // Generate withdrawal proof using L2 address
      const proof = await generateWithdrawalProof(
        selectedChannel.channelId.toString(),
        l2Address,
        parseUnits(claimedBalance, selectedChannel.decimals).toString(),
        participantsData
      );
      
      setGeneratedProof(proof);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setProofError(errorMessage);
      
      // Check if it's a wrong amount error
      if (errorMessage.includes('claimed balance is incorrect') || errorMessage.includes('verification')) {
        setProofError('Wrong amount: The claimed balance does not match the expected withdrawal amount. Please check your input.');
      }
    } finally {
      setIsGeneratingProof(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawTokens || !selectedChannel || !generatedProof) return;
    
    setIsSubmitting(true);
    try {
      await withdrawTokens();
    } catch (error) {
      console.error('Withdraw error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Check if it's a revert with "wrong amount" 
      if (errorMessage.includes('wrong amount') || errorMessage.includes('Wrong amount')) {
        setProofError('Wrong amount: The contract rejected the withdrawal. Please verify the claimed balance is correct.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = selectedChannel && 
                     claimedBalance && 
                     generatedProof && 
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
                    Simplified Withdrawal Process
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Channel must be in "Closed" state</li>
                      <li>You must have participated in the channel</li>
                      <li>Simply enter your claimed balance - Merkle proofs are generated automatically</li>
                      <li>The system will verify your amount and generate the necessary proof</li>
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
                    
                    <div className="space-y-6">
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

                      {/* Generate Proof Button */}
                      <div className="flex justify-center">
                        <button
                          onClick={handleGenerateProof}
                          disabled={!claimedBalance || isGeneratingProof}
                          className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 flex items-center gap-2"
                        >
                          {isGeneratingProof && <LoadingSpinner size="sm" />}
                          {isGeneratingProof ? 'Generating Proof...' : 'Generate Withdrawal Proof'}
                        </button>
                      </div>

                      {/* Proof Error Display */}
                      {proofError && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                          <div className="flex items-start">
                            <span className="text-red-400 text-xl mr-3">⚠️</span>
                            <div>
                              <h4 className="font-medium text-red-800 dark:text-red-200">
                                Proof Generation Failed
                              </h4>
                              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                {proofError}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Generated Proof Display */}
                      {generatedProof && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                          <div className="flex items-start">
                            <span className="text-green-400 text-xl mr-3">✅</span>
                            <div className="flex-1">
                              <h4 className="font-medium text-green-800 dark:text-green-200">
                                Withdrawal Proof Generated Successfully!
                              </h4>
                              <div className="text-sm text-green-700 dark:text-green-300 mt-2 space-y-1">
                                <p><strong>Leaf Index:</strong> {generatedProof.leafIndex}</p>
                                <p><strong>Claimed Balance:</strong> {formatUnits(BigInt(generatedProof.claimedBalance), selectedChannel.decimals)} {selectedChannel.symbol}</p>
                                <p><strong>Merkle Proof Elements:</strong> {generatedProof.merkleProof.length}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Withdraw Button */}
                      <div className="flex justify-end">
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