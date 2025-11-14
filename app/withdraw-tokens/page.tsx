'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useContractReads } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { formatUnits, parseUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { ClientOnly } from '@/components/ClientOnly';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Sidebar } from '@/components/Sidebar';
import { ChannelState } from '@/lib/types';
import { canWithdraw } from '@/lib/utils';
import { generateWithdrawalProof, WithdrawalProofData } from '@/lib/merkleProofGenerator';
import { ArrowUpCircle, Inbox, Clock, CheckCircle2, AlertCircle, Info } from 'lucide-react';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isConnected,
  });

  const channelCount = totalChannels ? Number(totalChannels) : 0;
  const maxChannelsToCheck = Math.min(channelCount, 20); // Reasonable limit

  // We need to get channel stats first to know which contracts are ERC20 tokens
  const { data: channelStatsData } = useContractReads({
    contracts: Array.from({ length: maxChannelsToCheck }, (_, i) => ({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelStats',
      args: [BigInt(i)],
    })),
    enabled: isConnected && channelCount > 0,
  });

  // Create contract calls and mapping
  const channelContracts: any[] = [];
  const contractCallMapping: Array<{ channelId: number; type: string }> = []; // Track what each contract call represents
  
  // For each channel, build contracts and track their mapping
  for (let i = 0; i < maxChannelsToCheck; i++) {
    const channelId = BigInt(i);
    const channelStats = channelStatsData?.[i]?.result as readonly [bigint, `0x${string}`, number, bigint, bigint, `0x${string}`] | undefined;
    const targetContract = channelStats?.[1];
    const isETH = !targetContract || targetContract === '0x0000000000000000000000000000000000000000';
    
    // Channel stats
    channelContracts.push({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelStats',
      args: [channelId],
    });
    contractCallMapping.push({ channelId: i, type: 'stats' });
    
    // Channel roots
    channelContracts.push({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelRoots',
      args: [channelId],
    });
    contractCallMapping.push({ channelId: i, type: 'roots' });
    
    // Channel participants
    channelContracts.push({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelParticipants',
      args: [channelId],
    });
    contractCallMapping.push({ channelId: i, type: 'participants' });
    
    // Token info (for ERC20 tokens only)
    if (!isETH && targetContract) {
      // Token decimals
      channelContracts.push({
        address: targetContract as `0x${string}`,
        abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view' as const, type: 'function' as const, inputs: [] }],
        functionName: 'decimals',
      });
      contractCallMapping.push({ channelId: i, type: 'decimals' });
      
      // Token symbol
      channelContracts.push({
        address: targetContract as `0x${string}`,
        abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view' as const, type: 'function' as const, inputs: [] }],
        functionName: 'symbol',
      });
      contractCallMapping.push({ channelId: i, type: 'symbol' });
    }
    
    // User-specific data (if address exists)
    if (address) {
      // User deposit
      channelContracts.push({
        address: ROLLUP_BRIDGE_ADDRESS,
        abi: ROLLUP_BRIDGE_ABI,
        functionName: 'getParticipantDeposit',
        args: [channelId, address],
      });
      contractCallMapping.push({ channelId: i, type: 'userDeposit' });
      
      // L2 address
      channelContracts.push({
        address: ROLLUP_BRIDGE_ADDRESS,
        abi: ROLLUP_BRIDGE_ABI,
        functionName: 'getL2PublicKey',
        args: [channelId, address],
      });
      contractCallMapping.push({ channelId: i, type: 'l2Address' });
      
      // Withdrawal status
      channelContracts.push({
        address: ROLLUP_BRIDGE_ADDRESS,
        abi: ROLLUP_BRIDGE_ABI,
        functionName: 'hasWithdrawn',
        args: [channelId, address],
      });
      contractCallMapping.push({ channelId: i, type: 'hasWithdrawn' });
    }
    
    // Participant roots
    channelContracts.push({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getChannelParticipantRoots',
      args: [channelId],
    });
    contractCallMapping.push({ channelId: i, type: 'participantRoots' });
  }

  const { data: channelData, isLoading: channelDataLoading } = useContractReads({
    contracts: channelContracts,
    enabled: isConnected && channelCount > 0,
  });

  // Parse channel data into structured format
  const [withdrawableChannels, setWithdrawableChannels] = useState<WithdrawableChannel[]>([]);
  const [channelTokenData, setChannelTokenData] = useState<Map<number, { symbol: string; decimals: number }>>(new Map());
  
  useEffect(() => {
    const parseChannelData = async () => {
      if (!channelData || !address) {
        setWithdrawableChannels([]);
        return;
      }

      const newWithdrawableChannels: WithdrawableChannel[] = [];
      const newTokenData = new Map<number, { symbol: string; decimals: number }>();

      // Build channel data map from contract results using mapping
      const channelDataMap = new Map<number, {
        stats?: readonly [bigint, `0x${string}`, number, bigint, bigint, `0x${string}`];
        roots?: readonly [string, string];
        participants?: readonly string[];
        decimals?: number;
        symbol?: string;
        userDeposit?: bigint;
        l2Address?: string;
        hasWithdrawn?: boolean;
        participantRoots?: readonly string[];
      }>();

      // Parse contract results using the mapping
      contractCallMapping.forEach((mapping, index) => {
        const { channelId, type } = mapping;
        const result = channelData[index]?.result;
        
        if (!channelDataMap.has(channelId)) {
          channelDataMap.set(channelId, {});
        }
        
        const channelInfo = channelDataMap.get(channelId)!;
        
        switch (type) {
          case 'stats':
            channelInfo.stats = result as readonly [bigint, `0x${string}`, number, bigint, bigint, `0x${string}`];
            break;
          case 'roots':
            channelInfo.roots = result as readonly [string, string];
            break;
          case 'participants':
            channelInfo.participants = result as readonly string[];
            break;
          case 'decimals':
            channelInfo.decimals = result as number;
            break;
          case 'symbol':
            channelInfo.symbol = result as string;
            break;
          case 'userDeposit':
            channelInfo.userDeposit = result as bigint;
            break;
          case 'l2Address':
            channelInfo.l2Address = result as string;
            break;
          case 'hasWithdrawn':
            channelInfo.hasWithdrawn = result as boolean;
            break;
          case 'participantRoots':
            channelInfo.participantRoots = result as readonly string[];
            break;
        }
      });

      // Process each channel
      for (let i = 0; i < maxChannelsToCheck; i++) {
        const channelInfo = channelDataMap.get(i);
        if (!channelInfo) continue;
        
        const { stats: channelStats, participants, decimals: tokenDecimals, symbol: tokenSymbol, userDeposit, hasWithdrawn } = channelInfo;
        
        // Check if this channel is withdrawable (closed state = 5, user is participant, hasn't withdrawn)
        if (
          channelStats &&
          channelStats[2] === 5 && // Closed state
          participants &&
          participants.includes(address) &&
          !hasWithdrawn
        ) {
          const isETH = !channelStats[1] || channelStats[1] === '0x0000000000000000000000000000000000000000';
          
          // Get token info
          let symbol: string;
          let decimals: number;
          
          if (isETH) {
            symbol = 'ETH';
            decimals = 18;
          } else {
            // Use the fetched token data
            symbol = typeof tokenSymbol === 'string' ? tokenSymbol : 'TOKEN';
            decimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18;
          }
          
          newWithdrawableChannels.push({
            channelId: BigInt(i),
            targetContract: channelStats[1],
            state: channelStats[2] as ChannelState,
            isETH,
            symbol,
            decimals,
            userDeposit: userDeposit || BigInt(0),
            hasWithdrawn: hasWithdrawn || false,
          });
        }
      }
      
      setWithdrawableChannels(newWithdrawableChannels);
    };

    parseChannelData();
  }, [channelData, address, maxChannelsToCheck, channelTokenData]);

  // Helper function to get channel data by ID
  const getChannelDataById = (channelId: bigint) => {
    if (!channelData || !address) return null;
    
    const itemsPerChannel = 7;
    const channelIndex = Number(channelId);
    const baseIndex = channelIndex * itemsPerChannel;
    
    return {
      stats: channelData[baseIndex]?.result as readonly [bigint, `0x${string}`, number, bigint, bigint, `0x${string}`] | undefined,
      roots: channelData[baseIndex + 1]?.result as readonly [string, string] | undefined,
      participants: channelData[baseIndex + 2]?.result as readonly string[] | undefined,
      userDeposit: channelData[baseIndex + 3]?.result as bigint | undefined,
      l2Address: channelData[baseIndex + 4]?.result as string | undefined,
      hasWithdrawn: channelData[baseIndex + 5]?.result as boolean | undefined,
      participantRoots: channelData[baseIndex + 6]?.result as readonly string[] | undefined,
    };
  };

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
    ] : [BigInt(0), BigInt(0), BigInt(0), [] as `0x${string}`[]], // Provide dummy args when no proof
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
      // Debug: Check what the actual channel state is
      console.log('=== DEBUG: Channel State ===');
      console.log('Channel ID:', selectedChannel.channelId.toString());
      
      // Get channel data dynamically
      const channelInfo = getChannelDataById(selectedChannel.channelId);
      if (!channelInfo) {
        throw new Error('Failed to fetch channel data. Please try again.');
      }
      
      const { roots: channelRoots, participants, l2Address, participantRoots } = channelInfo;
      
      if (channelRoots) {
        console.log('Channel roots:', channelRoots);
        console.log('Initial Root:', channelRoots[0]);
        console.log('Final State Root:', channelRoots[1]);
      }
      
      console.log('DEBUG: Channel roots for channel', selectedChannel.channelId.toString(), ':', channelRoots);
      console.log('DEBUG: Initial root:', channelRoots?.[0]);
      console.log('DEBUG: Final root:', channelRoots?.[1]);
      
      if (!channelRoots) {
        throw new Error('Failed to fetch channel roots from contract. Please try again.');
      }
      
      const zeroHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const finalStateRoot = channelRoots[1];
      
      if (!finalStateRoot || finalStateRoot === zeroHash || finalStateRoot === '0x' || finalStateRoot.length < 66) {
        console.log('DEBUG: Final state root is invalid:', finalStateRoot);
        throw new Error('Channel has not gone through submitAggregatedProof yet. Final state root is not set. Please complete the proof submission workflow first.');
      }
      
      console.log('Channel has valid final state root, proceeding with withdrawal proof generation...');
      
      // Get the L2 address for this L1 address - validate it's a proper hex address
      let userL2Address = l2Address;
      
      console.log('Raw L2 address from channelInfo:', l2Address);
      
      // Validate that the L2 address is actually a valid Ethereum address, not a token symbol
      const isValidL2Address = userL2Address && 
                               typeof userL2Address === 'string' && 
                               userL2Address.startsWith('0x') && 
                               userL2Address.length === 42 &&
                               userL2Address !== '0x0000000000000000000000000000000000000000';
      
      if (!isValidL2Address) {
        console.log(`Invalid L2 address (${userL2Address}), fetching from contract...`);
        
        // Fetch L2 address directly from contract
        try {
          const contractL2Address = await readContract({
            address: ROLLUP_BRIDGE_ADDRESS,
            abi: ROLLUP_BRIDGE_ABI,
            functionName: 'getL2PublicKey',
            args: [selectedChannel.channelId, address as `0x${string}`],
          });
          
          if (contractL2Address && contractL2Address !== '0x0000000000000000000000000000000000000000') {
            userL2Address = contractL2Address as string;
            console.log('Fetched L2 address from contract:', userL2Address);
          } else {
            throw new Error('Contract returned zero address');
          }
        } catch (error) {
          console.warn('Failed to fetch L2 address from contract, using derived address');
          // Fallback: derive L2 address from L1 address
          const addressNum = BigInt(address);
          const channelOffset = BigInt(selectedChannel.channelId.toString()) + BigInt(1000000);
          const maxAddress = BigInt("0xffffffffffffffffffffffffffffffffffffffff"); // 2^160 - 1
          const derivedL2 = (addressNum + channelOffset) % (maxAddress + BigInt(1));
          userL2Address = `0x${derivedL2.toString(16).padStart(40, '0')}`;
          console.log(`Using derived L2 address: ${userL2Address} for L1: ${address} in channel ${selectedChannel.channelId}`);
        }
      } else {
        console.log('Using valid L2 address from channelInfo:', userL2Address);
      }
      
      // Final validation - ensure we have a valid L2 address
      if (!userL2Address || typeof userL2Address !== 'string') {
        throw new Error('Failed to obtain valid L2 address for withdrawal proof generation');
      }
      
      console.log('Final userL2Address for proof generation:', userL2Address);
      
      // Get real participant data from dynamic channel data
      if (!participants || participants.length === 0) {
        throw new Error('No participants found for this channel');
      }
      
      // Build participant data with actual L2 addresses and deposit balances
      const participantsData: Array<{ l2Address: string; balance: string }> = [];
      
      for (const participant of participants) {
        // Validate that participant is actually an Ethereum address, not a token symbol
        const isValidAddress = typeof participant === 'string' && 
                              participant.startsWith('0x') && 
                              participant.length === 42;
        
        if (!isValidAddress) {
          console.warn(`Skipping invalid participant address: ${participant}`);
          continue; // Skip non-address entries
        }
        
        // Get L2 address for each participant
        let participantL2Address = userL2Address; // Default to user's if this is the user
        if (participant.toLowerCase() !== address.toLowerCase()) {
          // For other participants, we need to fetch their L2 public keys from the contract
          try {
            const otherUserL2Address = await readContract({
              address: ROLLUP_BRIDGE_ADDRESS,
              abi: ROLLUP_BRIDGE_ABI,
              functionName: 'getL2PublicKey',
              args: [selectedChannel.channelId, participant as `0x${string}`],
            });
            
            if (otherUserL2Address && otherUserL2Address !== '0x0000000000000000000000000000000000000000') {
              participantL2Address = otherUserL2Address as string;
            } else {
              // Fallback: derive L2 address for other participants
              const participantAddressNum = BigInt(participant);
              const channelOffset = BigInt(selectedChannel.channelId.toString()) + BigInt(2000000);
              const maxAddress = BigInt("0xffffffffffffffffffffffffffffffffffffffff");
              const derivedL2 = (participantAddressNum + channelOffset) % (maxAddress + BigInt(1));
              participantL2Address = `0x${derivedL2.toString(16).padStart(40, '0')}`;
            }
          } catch (error) {
            console.warn(`Failed to get L2 address for participant ${participant}, using fallback`);
            // Fallback: derive L2 address
            const participantAddressNum = BigInt(participant);
            const channelOffset = BigInt(selectedChannel.channelId.toString()) + BigInt(2000000);
            const maxAddress = BigInt("0xffffffffffffffffffffffffffffffffffffffff");
            const derivedL2 = (participantAddressNum + channelOffset) % (maxAddress + BigInt(1));
            participantL2Address = `0x${derivedL2.toString(16).padStart(40, '0')}`;
          }
        }
        
        // Get deposit balance for each participant
        let participantBalance = '0';
        if (participant.toLowerCase() === address.toLowerCase()) {
          participantBalance = (channelInfo.userDeposit || BigInt(0)).toString();
        } else {
          // For other participants, use a default balance
          // Use a reasonable default (1 token with proper decimals)
          const defaultDecimals = selectedChannel.decimals > 18 ? 18 : selectedChannel.decimals;
          participantBalance = parseUnits('1.0', defaultDecimals).toString();
        }
        
        participantsData.push({
          l2Address: participantL2Address,
          balance: participantBalance
        });
      }
      
      if (participantsData.length === 0) {
        throw new Error('No valid participants found after filtering. Check if participant data contains proper Ethereum addresses.');
      }
      
      // Fetch participant roots directly from the contract using getChannelParticipantRoots
      console.log('Fetching participant roots from contract for channel:', selectedChannel.channelId.toString());
      
      const participantRootsResult = await readContract({
        address: ROLLUP_BRIDGE_ADDRESS,
        abi: ROLLUP_BRIDGE_ABI,
        functionName: 'getChannelParticipantRoots',
        args: [selectedChannel.channelId],
      });
      
      const participantRootsForChannel = Array.isArray(participantRootsResult) ? participantRootsResult.map(root => root as string) : [];
      
      if (participantRootsForChannel.length === 0) {
        throw new Error('Participant roots not available for this channel. Make sure aggregated proof has been submitted.');
      }
      
      console.log('Fetched participant roots from contract:', participantRootsForChannel);

      // Generate withdrawal proof using L2 address and final state root
      const proof = await generateWithdrawalProof(
        selectedChannel.channelId.toString(),
        userL2Address,
        parseUnits(claimedBalance, selectedChannel.decimals).toString(),
        participantsData,
        channelRoots[1], // final state root from the contract
        participantRootsForChannel // participant roots from the contract
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
          <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
        </ClientOnly>
        <div className={`${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} transition-all duration-300`}>
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
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>

      {/* Main Content Area */}
      <div className="ml-0 lg:ml-72 transition-all duration-300 min-h-screen space-background">

        <ClientOnly>
          <div className="px-4 py-8 lg:px-8">
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Page Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                    <ArrowUpCircle className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white">Withdraw Tokens</h1>
                </div>
                <p className="text-gray-300 ml-13">
                  Withdraw your tokens from closed channels. Merkle proofs are generated automatically.
                </p>
              </div>

              {/* Info Banner */}
              <div className="bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 p-4 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Info className="w-5 h-5 text-[#4fc3f7]" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-[#4fc3f7]">
                    Simplified Withdrawal Process
                  </h3>
                  <div className="mt-2 text-sm text-gray-300">
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
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 shadow-lg shadow-[#4fc3f7]/20">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Available Withdrawals
                </h2>
                
                <div className="grid gap-4 mb-6">
                  {withdrawableChannels.map((channel) => (
                    <div
                      key={channel.channelId.toString()}
                      className={`border p-4 cursor-pointer transition-colors ${
                        selectedChannel?.channelId === channel.channelId
                          ? 'border-[#4fc3f7] bg-[#4fc3f7]/10'
                          : 'border-[#4fc3f7]/30 hover:border-[#4fc3f7]'
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
                            <div className={`w-3 h-3 ${
                              channel.hasWithdrawn 
                                ? 'bg-gray-500' 
                                : selectedChannel?.channelId === channel.channelId 
                                ? 'bg-[#4fc3f7]' 
                                : 'bg-green-500'
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                Channel #{channel.channelId.toString()}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/50">
                                Closed
                              </span>
                              {channel.hasWithdrawn && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/50">
                                  Already Withdrawn
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-400">
                              Target: {channel.isETH ? 'ETH (Native)' : channel.targetContract}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-white">
                            {formatUnits(channel.userDeposit, channel.decimals)} {channel.symbol}
                          </div>
                          <div className="text-sm text-gray-400">
                            Your Deposit
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Withdraw Form */}
                {selectedChannel && !selectedChannel.hasWithdrawn && (
                  <div className="border-t border-[#4fc3f7]/30 pt-6">
                    <h3 className="text-lg font-medium text-white mb-4">
                      Withdrawal Details for Channel #{selectedChannel.channelId.toString()}
                    </h3>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Claimed Balance
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={claimedBalance}
                          onChange={(e) => setClaimedBalance(e.target.value)}
                          placeholder="0.0"
                          className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] focus:border-[#4fc3f7]"
                        />
                        <p className="text-sm text-gray-400 mt-1">
                          Amount you're claiming to withdraw ({selectedChannel.symbol})
                        </p>
                      </div>

                      {/* Generate Proof Button */}
                      <div className="flex justify-center">
                        <button
                          onClick={handleGenerateProof}
                          disabled={!claimedBalance || isGeneratingProof}
                          className="px-6 py-2 bg-[#4fc3f7] text-white hover:bg-[#029bee] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] transition-colors duration-200 flex items-center gap-2"
                        >
                          {isGeneratingProof && <LoadingSpinner size="sm" />}
                          {isGeneratingProof ? 'Generating Proof...' : 'Generate Withdrawal Proof'}
                        </button>
                      </div>

                      {/* Proof Error Display */}
                      {proofError && (
                        <div className="p-4 bg-red-500/10 border border-red-500/50">
                          <div className="flex items-start">
                            <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0" />
                            <div>
                              <h4 className="font-medium text-red-400">
                                Proof Generation Failed
                              </h4>
                              <p className="text-sm text-red-300/90 mt-1">
                                {proofError}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Generated Proof Display */}
                      {generatedProof && (
                        <div className="p-4 bg-green-500/10 border border-green-500/50">
                          <div className="flex items-start">
                            <CheckCircle2 className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-medium text-green-400">
                                Withdrawal Proof Generated Successfully!
                              </h4>
                              <div className="text-sm text-green-300/90 mt-2 space-y-1">
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
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
                <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-8 h-8 text-[#4fc3f7]" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  No Withdrawals Available
                </h2>
                <p className="text-gray-300 mb-6">
                  You don't have any tokens to withdraw from closed channels at the moment.
                </p>
                <div className="text-sm text-gray-300">
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