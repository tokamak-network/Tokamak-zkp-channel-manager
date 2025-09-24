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
  const [isMounted, setIsMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Prevent hydration mismatches by ensuring we're on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [selectedChannel, setSelectedChannel] = useState<{
    channelId: bigint;
    targetContract: string;
    decimals?: number;
    symbol?: string;
    isETH?: boolean;
  } | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [approvalError, setApprovalError] = useState<string>('');
  const [approvalStep, setApprovalStep] = useState<'idle' | 'reset' | 'approve'>('idle');
  const [showDepositSuccessPopup, setShowDepositSuccessPopup] = useState(false);
  const [successDepositInfo, setSuccessDepositInfo] = useState<{
    channelId: string;
    tokenSymbol: string;
    amount: string;
    txHash: string;
  } | null>(null);

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isMounted && isConnected,
  });

  // Get channel participants for first few channels to check participation
  const { data: participantsChannel0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(0)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: participantsChannel1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(1)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  // Get channel stats to check states and target contracts
  const { data: channelStats0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(0)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: channelStats1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(1)],
    enabled: isMounted && isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  // Get token info for each channel's target contract
  const { data: tokenDecimals0 } = useContractRead({
    address: channelStats0?.[1] as `0x${string}`,
    abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'decimals',
    enabled: isMounted && isConnected && channelStats0?.[1] && isAddress(channelStats0[1]) && channelStats0[1] !== '0x0000000000000000000000000000000000000000',
  });

  const { data: tokenSymbol0 } = useContractRead({
    address: channelStats0?.[1] as `0x${string}`,
    abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'symbol',
    enabled: isMounted && isConnected && channelStats0?.[1] && isAddress(channelStats0[1]) && channelStats0[1] !== '0x0000000000000000000000000000000000000000',
  });

  const { data: tokenDecimals1 } = useContractRead({
    address: channelStats1?.[1] as `0x${string}`,
    abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'decimals',
    enabled: isMounted && isConnected && channelStats1?.[1] && isAddress(channelStats1[1]) && channelStats1[1] !== '0x0000000000000000000000000000000000000000',
  });

  const { data: tokenSymbol1 } = useContractRead({
    address: channelStats1?.[1] as `0x${string}`,
    abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'symbol',
    enabled: isMounted && isConnected && channelStats1?.[1] && isAddress(channelStats1[1]) && channelStats1[1] !== '0x0000000000000000000000000000000000000000',
  });

  // Get user's deposits for each channel
  const { data: userDepositChannel0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getParticipantDeposit',
    args: address ? [BigInt(0), address] : undefined,
    enabled: isMounted && isConnected && !!address && participantsChannel0 && participantsChannel0.includes(address),
  });

  const { data: userDepositChannel1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getParticipantDeposit',
    args: address ? [BigInt(1), address] : undefined,
    enabled: isMounted && isConnected && !!address && participantsChannel1 && participantsChannel1.includes(address),
  });

  // Find channels user can deposit to (participating and in Initialized state - state 1)
  const availableChannels = [];

  if (isMounted && participantsChannel0 && address && participantsChannel0.includes(address) && channelStats0?.[2] === 1) {
    const isETH = !channelStats0[1] || channelStats0[1] === '0x0000000000000000000000000000000000000000';
    availableChannels.push({
      channelId: BigInt(0),
      targetContract: channelStats0[1],
      state: channelStats0[2],
      totalDeposits: channelStats0[4],
      userDeposit: userDepositChannel0 || BigInt(0),
      decimals: isETH ? 18 : tokenDecimals0,
      symbol: isETH ? 'ETH' : (typeof tokenSymbol0 === 'string' ? tokenSymbol0 : 'TOKEN'),
      isETH
    });
  }

  if (isMounted && participantsChannel1 && address && participantsChannel1.includes(address) && channelStats1?.[2] === 1) {
    const isETH = !channelStats1[1] || channelStats1[1] === '0x0000000000000000000000000000000000000000';
    availableChannels.push({
      channelId: BigInt(1),
      targetContract: channelStats1[1],
      state: channelStats1[2],
      totalDeposits: channelStats1[4],
      userDeposit: userDepositChannel1 || BigInt(0),
      decimals: isETH ? 18 : tokenDecimals1,
      symbol: isETH ? 'ETH' : (typeof tokenSymbol1 === 'string' ? tokenSymbol1 : 'TOKEN'),
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
        // ERC20 token deposit - check allowance first
        // Force refresh allowance before deposit
        const { data: freshAllowance } = await refetchAllowance();

        // Only proceed with deposit if we have sufficient allowance
        if (!hasSufficientAllowance || !effectiveAllowance || effectiveAllowance < parsedAmount || !freshAllowance || freshAllowance < parsedAmount) {
          setApprovalError('Insufficient token allowance. Please approve tokens first and wait for confirmation.');
          return;
        }
        
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
    enabled: Boolean(isMounted && selectedChannel?.isETH && depositAmount && address),
  });

  const { write: depositETH, isLoading: isDepositingETH } = useContractWrite(depositETHConfig);

  // Get the actual token decimals for the selected channel
  const getTokenDecimals = (channel: any): number => {
  if (!channel || channel.isETH) return 18;
  
  // Use the specific token decimals loaded for each channel
  if (channel.channelId === BigInt(0)) {
  return tokenDecimals0 || 18;
  }
  if (channel.channelId === BigInt(1)) {
  return tokenDecimals1 || 18;
  }
  return channel.decimals || 18;
  };

  // Token deposit preparation moved after needsApproval calculation

  // Watch for deposit transaction completion - moved after deposit preparation

  // Determine if we need to reset allowance first (USDT pattern)
  const isUSDT = selectedChannel && (selectedChannel.targetContract === '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A' || 
    selectedChannel.symbol?.toLowerCase().includes('usdt') || 
    selectedChannel.symbol?.toLowerCase().includes('tether'));

  // Approval configurations moved after effectiveAllowance calculation

  // Get allowance with refetch capability - enhanced for USDT compatibility
  const { data: allowance, refetch: refetchAllowance, error: allowanceError, isError: isAllowanceError } = useContractRead({
    address: selectedChannel && !selectedChannel.isETH ? selectedChannel.targetContract as `0x${string}` : undefined,
    abi: [{ name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [{ type: 'address' }, { type: 'address' }] }],
    functionName: 'allowance',
    args: selectedChannel && address ? [address, ROLLUP_BRIDGE_ADDRESS] : undefined,
    enabled: Boolean(isMounted && selectedChannel && !selectedChannel.isETH && address),
  });

  // USDT-specific allowance check with alternative ABI
  const { data: usdtAllowance } = useContractRead({
    address: selectedChannel && !selectedChannel.isETH && isUSDT ? selectedChannel.targetContract as `0x${string}` : undefined,
    abi: [
      {
        constant: true,
        inputs: [
          { name: '_owner', type: 'address' },
          { name: '_spender', type: 'address' }
        ],
        name: 'allowance',
        outputs: [{ name: 'remaining', type: 'uint256' }],
        payable: false,
        stateMutability: 'view',
        type: 'function'
      }
    ],
    functionName: 'allowance',
    args: selectedChannel && address ? [address, ROLLUP_BRIDGE_ADDRESS] : undefined,
    enabled: Boolean(isMounted && selectedChannel && !selectedChannel.isETH && address && isUSDT),
  });

  // Use USDT-specific allowance if available, fallback to regular allowance
  const effectiveAllowance = (isUSDT && usdtAllowance !== undefined ? usdtAllowance : allowance) as bigint | undefined;

  // Determine if we need to reset allowance first (USDT pattern)
  const needsAllowanceReset = selectedChannel && !selectedChannel.isETH && effectiveAllowance !== undefined && effectiveAllowance > 0 && approvalStep === 'idle';

  // Prepare approval reset transaction (approve 0) - for USDT compatibility
  const { config: resetApproveConfig } = usePrepareContractWrite({
    address: selectedChannel && !selectedChannel.isETH ? selectedChannel.targetContract as `0x${string}` : undefined,
    abi: [{ name: 'approve', outputs: [], stateMutability: 'nonpayable', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }] }],
    functionName: 'approve',
    args: [
      ROLLUP_BRIDGE_ADDRESS,
      BigInt(0)
    ],
    enabled: Boolean(isMounted && isUSDT && approvalStep === 'reset'),
  });

  const { write: resetApproveToken, isLoading: isResettingApproval, data: resetApproveData } = useContractWrite(resetApproveConfig);

  // Watch for reset approval transaction completion
  const { isLoading: isWaitingResetApproval, isSuccess: resetApprovalSuccess } = useWaitForTransaction({
    hash: resetApproveData?.hash,
    enabled: !!resetApproveData?.hash,
  });

  // Prepare approval transaction - using ABI without return value for USDT compatibility
  const { config: approveConfig } = usePrepareContractWrite({
    address: selectedChannel && !selectedChannel.isETH ? selectedChannel.targetContract as `0x${string}` : undefined,
    abi: [{ name: 'approve', outputs: [], stateMutability: 'nonpayable', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }] }],
    functionName: 'approve',
    args: selectedChannel && depositAmount ? [
      ROLLUP_BRIDGE_ADDRESS,
      parseUnits(depositAmount, getTokenDecimals(selectedChannel))
    ] : undefined,
    enabled: Boolean(isMounted && selectedChannel && !selectedChannel.isETH && depositAmount && address && getTokenDecimals(selectedChannel) && 
      (approvalStep === 'approve' || (!isUSDT && approvalStep === 'idle') || (isUSDT && approvalStep === 'idle' && effectiveAllowance === BigInt(0)))),
  });

  const { write: approveToken, isLoading: isApproving, data: approveData, error: approvalWriteError, isError: isApprovalWriteError } = useContractWrite(approveConfig);

  // Watch for approval transaction completion
  const { isLoading: isWaitingApproval, isSuccess: approvalSuccess, error: approvalTxError, isError: isApprovalTxError } = useWaitForTransaction({
    hash: approveData?.hash,
    enabled: !!approveData?.hash,
  });
  
  // Handle reset approval completion - move to approve step
  useEffect(() => {
    if (resetApprovalSuccess) {
      setApprovalStep('approve');
      setTimeout(() => {
        refetchAllowance();
      }, 2000);
    }
  }, [resetApprovalSuccess, refetchAllowance]);

  // Refetch allowance when approval transaction succeeds
  useEffect(() => {
    if (approvalSuccess && refetchAllowance) {
      setApprovalStep('idle');
      // Small delay to ensure blockchain state is updated
      setTimeout(() => {
        refetchAllowance().then((result) => {
          // Only clear errors if we actually have some allowance
          if (result.data && result.data > 0) {
            setApprovalError(''); // Clear any previous errors
          }
        });
      }, 3000); // Increased delay from 2 to 3 seconds
      
      // Additional refetch after longer delay to ensure allowance is properly updated
      setTimeout(() => {
        refetchAllowance();
      }, 7000); // Increased delay from 5 to 7 seconds
    }
  }, [approvalSuccess, refetchAllowance]);

  // Handle approval errors and non-standard ERC20 tokens
  useEffect(() => {
    if (isApprovalWriteError && approvalWriteError) {
      const errorMessage = approvalWriteError.message;
      
      // Handle common non-standard ERC20 token issues
      const isNonStandardTokenError = 
        errorMessage.includes('returned no data') || 
        errorMessage.includes('0x') ||
        errorMessage.includes('ContractFunctionExecutionError') ||
        errorMessage.includes('execution reverted') ||
        errorMessage.toLowerCase().includes('usdt') ||
        errorMessage.toLowerCase().includes('tether');
      
      if (isNonStandardTokenError) {
        // For non-standard tokens, the transaction might still succeed despite the error
        setApprovalError('');
        refetchAllowance();
      } else {
        setApprovalError(`Approval failed: ${errorMessage}`);
      }
    }
    
    if (isApprovalTxError && approvalTxError) {
      setApprovalError(`Transaction failed: ${approvalTxError.message}`);
    }
  }, [isApprovalWriteError, approvalWriteError, isApprovalTxError, approvalTxError, refetchAllowance]);

  // Validate deposit amount is reasonable (not more than 1 million tokens)
  const isDepositAmountValid = (amount: string, decimals: number = 18): boolean => {
    if (!amount || isNaN(Number(amount))) return false;
    try {
      const parsedAmount = parseUnits(amount, decimals);
      const maxAmount = parseUnits('1000000', decimals); // 1 million tokens max
      return parsedAmount > 0 && parsedAmount <= maxAmount;
    } catch {
      return false;
    }
  };

  // Check if USDT has existing allowance that must be spent first  
  const usdtMustSpendExisting = selectedChannel && !selectedChannel.isETH && depositAmount && isUSDT && effectiveAllowance !== undefined
    ? (() => {
        const requiredAmount = parseUnits(depositAmount, getTokenDecimals(selectedChannel));
        const hasExistingAllowance = effectiveAllowance > BigInt(0);
        const wantsDifferentAmount = effectiveAllowance !== requiredAmount;
        return hasExistingAllowance && wantsDifferentAmount;
      })()
    : false;

  // Check if approval is needed - more strict validation
  const needsApproval = selectedChannel && !selectedChannel.isETH && depositAmount && effectiveAllowance !== undefined
    ? (() => {
        const requiredAmount = parseUnits(depositAmount, getTokenDecimals(selectedChannel));
        
        // For USDT: if user has existing allowance but wants different amount, they must spend existing first
        if (usdtMustSpendExisting) {
          return false; // Don't show approve button, force deposit existing amount first
        }
        
        return effectiveAllowance < requiredAmount;
      })()
    : true;

  // Check if we have sufficient allowance for the exact deposit amount
  const hasSufficientAllowance = selectedChannel && !selectedChannel.isETH && depositAmount
    ? (() => {
        // If allowance fetch failed or is undefined, assume no allowance
        if (effectiveAllowance === undefined || isAllowanceError) {
          console.warn('⚠️ Effective allowance is undefined or error occurred, assuming 0 allowance');
          return false;
        }
        
        const requiredAmount = parseUnits(depositAmount, getTokenDecimals(selectedChannel));
        return effectiveAllowance >= requiredAmount;
      })()
    : false;

  // Prepare Token deposit (after needsApproval and hasSufficientAllowance are calculated)
  const { config: depositTokenConfig } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'depositToken',
    args: selectedChannel && depositAmount ? [
      selectedChannel.channelId,
      selectedChannel.targetContract as `0x${string}`,
      parseUnits(depositAmount, getTokenDecimals(selectedChannel))
    ] : undefined,
    enabled: Boolean(isMounted && selectedChannel && !selectedChannel.isETH && depositAmount && address && getTokenDecimals(selectedChannel) && !needsApproval && hasSufficientAllowance),
  });

  const { write: depositToken, isLoading: isDepositingToken, error: depositError, data: depositData } = useContractWrite(depositTokenConfig);

  // Watch for deposit transaction completion
  const { isLoading: isWaitingDeposit, isSuccess: depositSuccess, error: depositTxError } = useWaitForTransaction({
    hash: depositData?.hash,
    enabled: !!depositData?.hash,
  });

  // Handle deposit success - show popup and reset form
  useEffect(() => {
    if (depositSuccess && selectedChannel && depositAmount) {
      
      // Set success info for popup
      setSuccessDepositInfo({
        channelId: selectedChannel.channelId.toString(),
        tokenSymbol: selectedChannel.symbol || (selectedChannel.isETH ? 'ETH' : 'Token'),
        amount: depositAmount,
        txHash: depositData?.hash || ''
      });
      
      // Show success popup
      setShowDepositSuccessPopup(true);
      
      // Reset form after a short delay
      setTimeout(() => {
        setSelectedChannel(null);
        setDepositAmount('');
        setApprovalError('');
        setApprovalStep('idle');
      }, 1000);
    }
  }, [depositSuccess, selectedChannel, depositAmount, depositData?.hash]);

  const handleChannelSelect = (channel: any) => {
    setSelectedChannel(channel);
    setDepositAmount('');
  };

  // Auto-set deposit amount when USDT edge case is detected
  useEffect(() => {
    if (usdtMustSpendExisting && selectedChannel && effectiveAllowance && !depositAmount) {
      const forcedAmount = formatUnits(effectiveAllowance, getTokenDecimals(selectedChannel));
      setDepositAmount(forcedAmount);
    }
  }, [usdtMustSpendExisting, selectedChannel, effectiveAllowance, depositAmount]);

  if (!isMounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"></div>;
  }

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
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>

      {/* Main Content Area */}
      <div className={`${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} transition-all duration-300`}>
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
                {!isMounted ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <span className="text-2xl">⏳</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Loading...</h3>
                    <p className="text-gray-600 dark:text-gray-400">Fetching channel information...</p>
                  </div>
                ) : availableChannels.length === 0 ? (
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
                            {formatUnits(channel.userDeposit || BigInt(0), getTokenDecimals(channel))} {channel.symbol}
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
                                value={selectedChannel?.channelId === channel.channelId ? 
                                  (usdtMustSpendExisting && selectedChannel.channelId === channel.channelId && effectiveAllowance ? 
                                    formatUnits(effectiveAllowance, getTokenDecimals(selectedChannel)) : 
                                    depositAmount
                                  ) : 
                                  ''
                                }
                                onChange={(e) => {
                                  if (selectedChannel?.channelId !== channel.channelId) {
                                    handleChannelSelect(channel);
                                  }
                                  const value = e.target.value;
                                  
                                  // If USDT must spend existing allowance, don't allow changing the amount
                                  if (usdtMustSpendExisting && selectedChannel?.channelId === channel.channelId) {
                                    return; // Keep the enforced amount
                                  }
                                  
                                  // Prevent entering extremely large numbers
                                  if (value && !isNaN(Number(value)) && Number(value) > 1000000) {
                                    return; // Don't update if over 1M
                                  }
                                  setDepositAmount(value);
                                }}
                                disabled={usdtMustSpendExisting && selectedChannel?.channelId === channel.channelId}
                                placeholder={usdtMustSpendExisting && selectedChannel?.channelId === channel.channelId ? 
                                  `Must deposit ${effectiveAllowance ? formatUnits(effectiveAllowance, getTokenDecimals(selectedChannel)) : '0'} ${channel.symbol}` :
                                  `0.0 (max 1,000,000)`
                                }
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors duration-200 ${
                                  usdtMustSpendExisting && selectedChannel?.channelId === channel.channelId ?
                                    'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 cursor-not-allowed focus:ring-amber-500 focus:border-amber-500' :
                                    'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500'
                                }`}
                              />
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                  {channel.symbol}
                                </span>
                              </div>
                            </div>
                          </div>
                          {/* Approval/Deposit buttons */}
                          {(() => {
                            return selectedChannel?.channelId === channel.channelId && !channel.isETH && needsApproval;
                          })() ? (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  setApprovalError(''); // Clear previous errors
                                  
                                  // Check if this is USDT and we need to reset allowance first
                                  const isUSDTToken = channel.targetContract === '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A' || 
                                  (typeof channel.symbol === 'string' && channel.symbol.toLowerCase().includes('usdt')) || 
                                  (typeof channel.symbol === 'string' && channel.symbol.toLowerCase().includes('tether'));
                                  
                                  if (isUSDTToken && allowance && allowance > 0 && approvalStep === 'idle') {
                                  setApprovalStep('reset');
                                  setTimeout(() => {
                                  resetApproveToken?.();
                                  }, 100);
                                  } else if (approvalStep === 'approve' || (!isUSDTToken && approvalStep === 'idle') || (isUSDTToken && (!allowance || allowance === BigInt(0)) && approvalStep === 'idle')) {
                                  approveToken?.();
                                  }
                                }}
disabled={
                                  !depositAmount || isApproving || isWaitingApproval || isResettingApproval || isWaitingResetApproval || (!approveToken && !resetApproveToken) || channel.state !== 1
                                }
                                className="px-6 py-2 bg-orange-600 dark:bg-orange-700 text-white rounded-md hover:bg-orange-700 dark:hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors duration-200"
                              >
                                {isResettingApproval ? 'Resetting...' : 
                                 isWaitingResetApproval ? 'Confirming Reset...' :
                                 isApproving ? 'Approving...' : 
                                 isWaitingApproval ? 'Confirming...' : 
                                 (approvalStep === 'reset' ? 'Reset Allowance' : 'Approve')}
                              </button>
                              {approvalError && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                  {approvalError}
                                </p>
                              )}
                              {channel.state !== 1 && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                  ⚠️ Channel must be in "Initialized" state for approvals.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  const amountToDeposit = selectedChannel?.channelId === channel.channelId ? 
                                    (usdtMustSpendExisting && effectiveAllowance ? 
                                      formatUnits(effectiveAllowance, getTokenDecimals(selectedChannel)) : 
                                      depositAmount
                                    ) : 
                                    '';
                                  handleDeposit(channel, amountToDeposit);
                                }}
                                disabled={
                                  (!depositAmount && !usdtMustSpendExisting) || 
                                  (selectedChannel?.channelId !== channel.channelId) || 
                                  isDepositingETH || 
                                  isDepositingToken ||
                                  isWaitingDeposit ||
                                  (!channel.isETH && needsApproval) ||
                                  (!channel.isETH && !hasSufficientAllowance) ||
                                  (!usdtMustSpendExisting && !isDepositAmountValid(depositAmount, getTokenDecimals(channel))) ||
                                  channel.state !== 1
                                }
                                className={`px-6 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 transition-colors duration-200 ${
                                  usdtMustSpendExisting && selectedChannel?.channelId === channel.channelId ?
                                    'bg-amber-600 dark:bg-amber-700 hover:bg-amber-700 dark:hover:bg-amber-600 focus:ring-amber-500' :
                                    'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-blue-500'
                                }`}
                              >
                                {(isDepositingETH || isDepositingToken) ? 'Depositing...' : isWaitingDeposit ? 'Confirming...' : 
                                 (usdtMustSpendExisting && selectedChannel?.channelId === channel.channelId ? 'Spend Existing Allowance' : 'Deposit')}
                              </button>
                              {/* Validation messages */}
                              {selectedChannel?.channelId === channel.channelId && depositAmount && (
                                <div className="text-xs space-y-1">
                                  {channel.state !== 1 && (
                                    <p className="text-red-600 dark:text-red-400">
                                      ⚠️ Channel must be in "Initialized" state for deposits.
                                    </p>
                                  )}
                                  {!isDepositAmountValid(depositAmount, getTokenDecimals(channel)) && (
                                    <p className="text-red-600 dark:text-red-400">
                                      ⚠️ Invalid amount. Maximum 1,000,000 tokens allowed.
                                    </p>
                                  )}
                                  {!channel.isETH && !needsApproval && !hasSufficientAllowance && (
                                    <p className="text-orange-600 dark:text-orange-400">
                                      ⚠️ Insufficient allowance. Current: {allowance ? formatUnits(allowance, getTokenDecimals(channel)) : '0'} {channel.symbol}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {channel.isETH ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Depositing native ETH to the bridge contract
                          </p>
                        ) : (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {selectedChannel?.channelId === channel.channelId && usdtMustSpendExisting ? (
                              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md">
                                <p className="text-amber-800 dark:text-amber-300 font-medium mb-1">
                                  🚨 USDT Allowance Must Be Spent First
                                </p>
                                <p className="text-amber-700 dark:text-amber-400 mb-2">
                                  You have {effectiveAllowance ? formatUnits(effectiveAllowance, getTokenDecimals(channel)) : '0'} {typeof channel.symbol === 'string' ? channel.symbol : 'USDT'} approved. 
                                  USDT requires spending this amount before approving a new amount.
                                </p>
                                <p className="text-amber-600 dark:text-amber-500 text-xs">
                                  💡 Solution: First deposit the approved amount ({effectiveAllowance ? formatUnits(effectiveAllowance, getTokenDecimals(channel)) : '0'} {typeof channel.symbol === 'string' ? channel.symbol : 'USDT'}), 
                                  then you can approve and deposit the new amount.
                                </p>
                              </div>
                            ) : selectedChannel?.channelId === channel.channelId && needsApproval ? (
                              <div>
                                <p className="text-orange-600 dark:text-orange-400">
                                  ⚠️ First approve the bridge contract to spend your {typeof channel.symbol === 'string' ? channel.symbol : 'token'} tokens
                                </p>
                                {((typeof channel.symbol === 'string' && channel.symbol === 'USDT') || (typeof channel.symbol === 'string' && channel.symbol.toLowerCase().includes('usdt')) || (typeof channel.symbol === 'string' && channel.symbol.toLowerCase().includes('tether'))) && (
                                  <p className="text-blue-600 dark:text-blue-400 mt-1">
                                    ℹ️ USDT may show "no data" error but approval can still succeed. Wait for confirmation.
                                  </p>
                                )}
                              </div>
                            ) : selectedChannel?.channelId === channel.channelId && !needsApproval && effectiveAllowance !== undefined ? (
                              <p className="text-green-600 dark:text-green-400">
                                ✅ Bridge contract approved to spend your {typeof channel.symbol === 'string' ? channel.symbol : 'token'} tokens
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

      {/* Success Popup */}
      {showDepositSuccessPopup && successDepositInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 transition-colors duration-300">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Deposit Successful!</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Channel {successDepositInfo.channelId} • {successDepositInfo.amount} {successDepositInfo.tokenSymbol}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Deposit Confirmed</h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-start gap-3">
                  <span className="text-green-500 font-bold">✓</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Transaction Confirmed</p>
                    <p>Your {successDepositInfo.tokenSymbol} tokens have been deposited into the channel.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 font-bold">→</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Next Steps</p>
                    <p>Wait for other participants to deposit, then the channel leader will initialize the channel state.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300">
                  <span className="font-medium">💰 Deposit Details:</span> {successDepositInfo.amount} {successDepositInfo.tokenSymbol} deposited to Channel {successDepositInfo.channelId}
                </p>
                {successDepositInfo.txHash && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-mono break-all">
                    TX: {successDepositInfo.txHash}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowDepositSuccessPopup(false);
                  setSuccessDepositInfo(null);
                  window.location.reload(); // Refresh the page
                }}
                className="w-full px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
