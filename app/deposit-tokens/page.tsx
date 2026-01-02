'use client';

import { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
import { parseUnits, formatUnits, isAddress } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { Footer } from '@/components/Footer';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI, ROLLUP_BRIDGE_DEPOSIT_MANAGER_ADDRESS, ROLLUP_BRIDGE_DEPOSIT_MANAGER_ABI, ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { getTokenSymbol, getTokenDecimals } from '@/lib/tokenUtils';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';
import { ArrowDownCircle, Clock, Inbox, CheckCircle2, AlertCircle, Key, AlertTriangle, X } from 'lucide-react';
import { L2MPTKeyBanner } from '@/components/L2MPTKeyBanner';

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
    targetContract: `0x${string}`;
    state: number;
  } | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [mptKey, setMptKey] = useState('');
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showPublicKeyWarning, setShowPublicKeyWarning] = useState(false);

  // Use dynamic hook to get channels where user is whitelisted (eligible to deposit)
  const { whitelistedChannels, channelStatsData } = useUserRolesDynamic();

  // Get public key status for selected channel
  const { data: isPublicKeySet } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'isChannelPublicKeySet',
    args: selectedChannel ? [selectedChannel.channelId] : undefined,
    enabled: !!selectedChannel,
  });

  const { data: publicKey } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelPublicKey',
    args: selectedChannel ? [selectedChannel.channelId] : undefined,
    enabled: !!selectedChannel,
  });

  // Check if frost signatures are enabled for selected channel
  const { data: isFrostSignatureEnabled } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'isFrostSignatureEnabled',
    args: selectedChannel ? [selectedChannel.channelId] : undefined,
    enabled: !!selectedChannel,
  });

  // Get available channels for deposits (state = 1 means initialized)
  const availableChannels = whitelistedChannels
    .map(channelId => {
      const stats = channelStatsData[channelId];
      if (!stats || stats[2] !== 1) return null; // Only initialized channels (state = 1)
      
      return {
        channelId: BigInt(channelId),
        targetContract: stats[1] as `0x${string}`, // Single token address from targetContract
        state: stats[2],
        participantCount: stats[3]
      };
    })
    .filter(Boolean) as {
      channelId: bigint;
      targetContract: `0x${string}`;
      state: number;
      participantCount: bigint;
    }[];

  // Helper function to get basic token info (symbols and known decimals)
  const getBasicTokenInfo = (tokenAddress: string) => {
    // Use our centralized token mapping functions
    const symbol = getTokenSymbol(tokenAddress);
    const decimals = getTokenDecimals(tokenAddress);
    const isETH = tokenAddress === '0x0000000000000000000000000000000000000001' || 
                  tokenAddress === '0x0000000000000000000000000000000000000000';
    
    // If it's not a recognized token and not ETH, default to TON for now
    const finalSymbol = symbol === 'TOKEN' && !isETH ? 'TON' : symbol;
    
    return { symbol: finalSymbol, decimals, isETH, address: tokenAddress };
  };

  // Create channel data with target contract info
  const channelOptions = availableChannels.map(channel => ({
    channelId: channel.channelId,
    targetContract: channel.targetContract,
    state: channel.state,
    token: getBasicTokenInfo(channel.targetContract) // Single token from target contract
  }));

  // Get the token info for the selected channel
  const selectedChannelToken = selectedChannel ? channelOptions.find(ch => ch.channelId === selectedChannel.channelId)?.token : null;

  // Dynamic token metadata fetching for selected channel's token
  const { data: selectedTokenDecimals } = useContractRead({
    address: selectedChannelToken && !selectedChannelToken.isETH ? selectedChannelToken.address as `0x${string}` : undefined,
    abi: [{ name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'decimals',
    enabled: Boolean(selectedChannelToken && !selectedChannelToken.isETH && selectedChannelToken.decimals === 18), // Only fetch if using default decimals
  });

  const { data: selectedTokenSymbol } = useContractRead({
    address: selectedChannelToken && !selectedChannelToken.isETH ? selectedChannelToken.address as `0x${string}` : undefined,
    abi: [{ name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] }],
    functionName: 'symbol',
    enabled: Boolean(selectedChannelToken && !selectedChannelToken.isETH && selectedChannelToken.symbol === 'TOKEN'), // Only fetch if using default symbol
  });

  // Get actual decimals and symbol for selected channel's token
  const actualTokenDecimals = selectedTokenDecimals || selectedChannelToken?.decimals || 18;
  const actualTokenSymbol = selectedTokenSymbol || selectedChannelToken?.symbol || 'TOKEN';

  // Dynamic user deposit fetch for available channels using new getParticipantDeposit function
  const userDeposits: Record<string, bigint | undefined> = {};
  
  const { data: userDeposit0 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getParticipantDeposit',
    args: address && availableChannels[0] ? [availableChannels[0].channelId, address] : undefined,
    enabled: isMounted && isConnected && !!address && availableChannels.length > 0,
  });
  
  const { data: userDeposit1 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getParticipantDeposit',
    args: address && availableChannels[1] ? [availableChannels[1].channelId, address] : undefined,
    enabled: isMounted && isConnected && !!address && availableChannels.length > 1,
  });
  
  const { data: userDeposit2 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getParticipantDeposit',
    args: address && availableChannels[2] ? [availableChannels[2].channelId, address] : undefined,
    enabled: isMounted && isConnected && !!address && availableChannels.length > 2,
  });
  
  // Map deposits to channels
  if (availableChannels[0]) userDeposits[availableChannels[0].channelId.toString()] = userDeposit0;
  if (availableChannels[1]) userDeposits[availableChannels[1].channelId.toString()] = userDeposit1;
  if (availableChannels[2]) userDeposits[availableChannels[2].channelId.toString()] = userDeposit2;


  // Note: ETH deposits are not supported in the new contract architecture
  // The contract only supports ERC20 token deposits via depositToken(channelId, amount, mptKey)
  const isDepositingETH = false;

  // Get the actual token decimals for the selected channel's token
  const getActualTokenDecimals = (token: any): number => {
    if (!token || token.isETH) return 18;
    // If this is the selected channel's token, use the actual fetched decimals
    if (selectedChannelToken && token.address === selectedChannelToken.address) {
      return actualTokenDecimals;
    }
    return token.decimals || 18;
  };

  // Token deposit preparation moved after needsApproval calculation

  // Watch for deposit transaction completion - moved after deposit preparation

  // Determine if we need to reset allowance first (USDT pattern)
  const isUSDT = selectedChannelToken && (selectedChannelToken.address === '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A' || 
    actualTokenSymbol?.toLowerCase().includes('usdt') || 
    actualTokenSymbol?.toLowerCase().includes('tether'));

  // Approval configurations moved after effectiveAllowance calculation

  // Get allowance with refetch capability - enhanced for USDT compatibility
  const { data: allowance, refetch: refetchAllowance, error: allowanceError, isError: isAllowanceError } = useContractRead({
    address: selectedChannelToken && !selectedChannelToken.isETH ? selectedChannelToken.address as `0x${string}` : undefined,
    abi: [{ name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [{ type: 'address' }, { type: 'address' }] }],
    functionName: 'allowance',
    args: selectedChannelToken && address ? [address, ROLLUP_BRIDGE_DEPOSIT_MANAGER_ADDRESS] : undefined,
    enabled: Boolean(isMounted && selectedChannelToken && !selectedChannelToken.isETH && address),
  });

  // USDT-specific allowance check with alternative ABI
  const { data: usdtAllowance } = useContractRead({
    address: selectedChannelToken && !selectedChannelToken.isETH && isUSDT ? selectedChannelToken.address as `0x${string}` : undefined,
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
    args: selectedChannelToken && address ? [address, ROLLUP_BRIDGE_DEPOSIT_MANAGER_ADDRESS] : undefined,
    enabled: Boolean(isMounted && selectedChannelToken && !selectedChannelToken.isETH && address && isUSDT),
  });

  // Use USDT-specific allowance if available, fallback to regular allowance
  const effectiveAllowance = (isUSDT && usdtAllowance !== undefined ? usdtAllowance : allowance) as bigint | undefined;

  // Determine if we need to reset allowance first (USDT pattern)
  const needsAllowanceReset = selectedChannelToken && !selectedChannelToken.isETH && effectiveAllowance !== undefined && effectiveAllowance > 0 && approvalStep === 'idle';

  // Prepare approval reset transaction (approve 0) - for USDT compatibility
  const { config: resetApproveConfig } = usePrepareContractWrite({
    address: selectedChannelToken && !selectedChannelToken.isETH ? selectedChannelToken.address as `0x${string}` : undefined,
    abi: [{ name: 'approve', outputs: [], stateMutability: 'nonpayable', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }] }],
    functionName: 'approve',
    args: [
      ROLLUP_BRIDGE_DEPOSIT_MANAGER_ADDRESS,
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
    address: selectedChannelToken && !selectedChannelToken.isETH ? selectedChannelToken.address as `0x${string}` : undefined,
    abi: [{ name: 'approve', outputs: [], stateMutability: 'nonpayable', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }] }],
    functionName: 'approve',
    args: selectedChannelToken && depositAmount ? [
      ROLLUP_BRIDGE_DEPOSIT_MANAGER_ADDRESS,
      parseUnits(depositAmount, actualTokenDecimals)
    ] : undefined,
    enabled: Boolean(isMounted && selectedChannelToken && !selectedChannelToken.isETH && depositAmount && address && actualTokenDecimals && 
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
      return parsedAmount >= 0 && parsedAmount <= maxAmount;
    } catch {
      return false;
    }
  };

  // Check if USDT has existing allowance that must be spent first  
  const usdtMustSpendExisting = selectedChannelToken && !selectedChannelToken.isETH && depositAmount && isUSDT && effectiveAllowance !== undefined
    ? (() => {
        const requiredAmount = parseUnits(depositAmount, getActualTokenDecimals(selectedChannelToken));
        const hasExistingAllowance = effectiveAllowance > BigInt(0);
        const wantsDifferentAmount = effectiveAllowance !== requiredAmount;
        return hasExistingAllowance && wantsDifferentAmount;
      })()
    : false;

  // Check if approval is needed - more strict validation
  const needsApproval = selectedChannelToken && !selectedChannelToken.isETH && depositAmount && effectiveAllowance !== undefined
    ? (() => {
        const requiredAmount = parseUnits(depositAmount, getActualTokenDecimals(selectedChannelToken));
        
        // For USDT: if user has existing allowance but wants different amount, they must spend existing first
        if (usdtMustSpendExisting) {
          return false; // Don't show approve button, force deposit existing amount first
        }
        
        return effectiveAllowance < requiredAmount;
      })()
    : true;

  // Check if we have sufficient allowance for the exact deposit amount
  const hasSufficientAllowance = selectedChannelToken && !selectedChannelToken.isETH && depositAmount
    ? (() => {
        // If allowance fetch failed or is undefined, assume no allowance
        if (effectiveAllowance === undefined || isAllowanceError) {
          console.warn('⚠️ Effective allowance is undefined or error occurred, assuming 0 allowance');
          return false;
        }
        
        const requiredAmount = parseUnits(depositAmount, getActualTokenDecimals(selectedChannelToken));
        return effectiveAllowance >= requiredAmount;
      })()
    : false;

  // Prepare Token deposit (new interface: channelId, amount, mptKey - token is fetched from channel's targetContract)
  const { config: depositTokenConfig } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_DEPOSIT_MANAGER_ADDRESS,
    abi: ROLLUP_BRIDGE_DEPOSIT_MANAGER_ABI,
    functionName: 'depositToken',
    args: selectedChannel && depositAmount && mptKey ? [
      selectedChannel.channelId,
      parseUnits(depositAmount, actualTokenDecimals),
      mptKey as `0x${string}`
    ] : undefined,
    enabled: Boolean(isMounted && selectedChannel && selectedChannelToken && !selectedChannelToken.isETH && depositAmount && mptKey && address && !needsApproval && hasSufficientAllowance),
  });

  const { write: depositToken, isLoading: isDepositingToken, error: depositError, data: depositData } = useContractWrite(depositTokenConfig);

  // Watch for deposit transaction completion
  const { isLoading: isWaitingDeposit, isSuccess: depositSuccess, error: depositTxError } = useWaitForTransaction({
    hash: depositData?.hash,
    enabled: !!depositData?.hash,
  });

  // Handle deposit success - show popup and reset form
  useEffect(() => {
    if (depositSuccess && selectedChannel && selectedChannelToken && depositAmount) {
      
      // Set success info for popup
      setSuccessDepositInfo({
        channelId: selectedChannel.channelId.toString(),
        tokenSymbol: actualTokenSymbol,
        amount: depositAmount,
        txHash: depositData?.hash || ''
      });
      
      // Show success popup
      setShowDepositSuccessPopup(true);
      
      // Reset form after a short delay
      setTimeout(() => {
        setSelectedChannel(null);
        setDepositAmount('');
        setMptKey('');
        setApprovalError('');
        setApprovalStep('idle');
      }, 1000);
    }
  }, [depositSuccess, selectedChannel, selectedChannelToken, depositAmount, depositData?.hash]);

  // Auto-set deposit amount when USDT edge case is detected
  useEffect(() => {
    if (usdtMustSpendExisting && selectedChannelToken && effectiveAllowance && !depositAmount) {
      const forcedAmount = formatUnits(effectiveAllowance, actualTokenDecimals);
      setDepositAmount(forcedAmount);
    }
  }, [usdtMustSpendExisting, selectedChannelToken, effectiveAllowance, depositAmount, actualTokenDecimals]);

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

      {/* Mobile Navigation Menu */}
      <MobileNavigation 
        showMobileMenu={showMobileMenu} 
        setShowMobileMenu={setShowMobileMenu} 
      />

      {/* Main Content Area */}
      <div className="ml-0 lg:ml-72 transition-all duration-300 min-h-screen space-background flex flex-col">
        {/* Main Content */}
        <main className="px-4 py-8 lg:px-8 flex-1">
          <div className="max-w-5xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                  <ArrowDownCircle className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">Deposit Tokens</h1>
              </div>
              <p className="text-gray-300 ml-13">
                Select a channel to deposit tokens. Each channel supports a single target contract. You must provide an L2 MPT key for your deposit.
              </p>
            </div>

            {/* L2 MPT Key Generator Banner */}
            <L2MPTKeyBanner className="mb-6" />

            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 mb-6 shadow-lg shadow-[#4fc3f7]/20">

              <ClientOnly>
                {!isMounted ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-[#4fc3f7] animate-pulse" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Loading...</h3>
                    <p className="text-gray-300">Fetching channel information...</p>
                  </div>
                ) : channelOptions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                    <Inbox className="w-8 h-8 text-[#4fc3f7]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-4">No Channels Available</h3>
                  <p className="text-gray-300 mb-6 max-w-md mx-auto">
                    You're not participating in any initialized channels, or your channels are not ready for deposits yet.
                  </p>
                  <div className="bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 p-4 max-w-md mx-auto">
                    <h4 className="font-semibold text-[#4fc3f7] mb-2">To deposit tokens, you need:</h4>
                    <ul className="text-sm text-gray-300 space-y-1 text-left">
                      <li>• To be a participant in a channel</li>
                      <li>• The channel must be in "Initialized" state</li>
                      <li>• Channel leader must initialize the channel first</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Step 1: Channel Selection */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white mb-4">Select Channel</h3>
                    <div className="grid gap-4">
                      {channelOptions.map((channelOption) => {
                        const userDeposit = userDeposits[channelOption.channelId.toString()] || BigInt(0);
                        return (
                          <div 
                            key={channelOption.channelId.toString()}
                            onClick={() => setSelectedChannel({
                              channelId: channelOption.channelId,
                              targetContract: channelOption.targetContract,
                              state: channelOption.state
                            })}
                            className={`border p-4 cursor-pointer transition-all duration-300 ${
                              selectedChannel?.channelId === channelOption.channelId
                                ? 'border-[#4fc3f7] bg-[#4fc3f7]/10'
                                : 'border-[#4fc3f7]/30 bg-[#0a1930]/50 hover:border-[#4fc3f7]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 flex items-center justify-center">
                                  <span className="text-[#4fc3f7] font-semibold">#{channelOption.channelId.toString()}</span>
                                </div>
                                <div>
                                  <h4 className="text-lg font-semibold text-white">Channel {channelOption.channelId.toString()}</h4>
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 flex items-center justify-center text-xs">
                                      {channelOption.token?.symbol?.substring(0, 3) || 'TOK'}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-white">{channelOption.token?.symbol || 'Unknown'}</p>
                                      <p className="text-xs text-gray-400 font-mono">
                                        {channelOption.token?.isETH ? 'Native ETH' : 
                                         (channelOption.targetContract && channelOption.targetContract !== '0x0000000000000000000000000000000000000000') ? 
                                         `${channelOption.targetContract.substring(0, 8)}...${channelOption.targetContract.substring(36)}` : 
                                         channelOption.token?.symbol === 'TON' ? 'TON Token' : 'Token'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {selectedChannel?.channelId === channelOption.channelId && (
                                <CheckCircle2 className="w-6 h-6 text-[#4fc3f7]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Deposit Details */}
                  {selectedChannel && (
                    <div className="border-t border-[#4fc3f7]/30 pt-6 space-y-6">
                      <h3 className="text-xl font-semibold text-white mb-4">Deposit Details</h3>
                      
                      {/* MPT Key Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          L2 MPT Key (Required) <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={mptKey}
                          onChange={(e) => setMptKey(e.target.value)}
                          placeholder="0x..."
                          className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:ring-[#4fc3f7] focus:border-[#4fc3f7] focus:outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Enter your L2 Merkle Patricia Tree key for this deposit
                        </p>
                      </div>

                      {/* Amount Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Amount to Deposit
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={depositAmount}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value && !isNaN(Number(value)) && Number(value) > 1000000) {
                                return;
                              }
                              setDepositAmount(value);
                            }}
                            placeholder="0.0"
                            className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:ring-[#4fc3f7] focus:border-[#4fc3f7] focus:outline-none"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-400 text-sm font-medium">
                              {actualTokenSymbol}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        {/* Approval button for ERC20 tokens */}
                        {selectedChannelToken && !selectedChannelToken.isETH && needsApproval && (
                          <button
                            onClick={() => {
                              setApprovalError('');
                              if (isUSDT && allowance && allowance > 0 && approvalStep === 'idle') {
                                setApprovalStep('reset');
                                setTimeout(() => resetApproveToken?.(), 100);
                              } else if (approvalStep === 'approve' || (!isUSDT && approvalStep === 'idle') || (isUSDT && (!allowance || allowance === BigInt(0)) && approvalStep === 'idle')) {
                                approveToken?.();
                              }
                            }}
                            disabled={!depositAmount || !mptKey || isApproving || isWaitingApproval || isResettingApproval || isWaitingResetApproval || (!approveToken && !resetApproveToken)}
                            className="px-6 py-3 bg-[#4fc3f7] text-white hover:bg-[#029bee] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isResettingApproval ? 'Resetting...' : 
                             isWaitingResetApproval ? 'Confirming Reset...' :
                             isApproving ? 'Approving...' : 
                             isWaitingApproval ? 'Confirming...' : 
                             (approvalStep === 'reset' ? 'Reset Allowance' : 'Approve')}
                          </button>
                        )}

                        {/* Deposit button */}
                        <button
                          onClick={() => {
                            // Check if public key is set before allowing deposit (only if frost signatures are enabled)
                            if (isFrostSignatureEnabled && !isPublicKeySet) {
                              setShowPublicKeyWarning(true);
                              return;
                            }
                            
                            // Only ERC20 token deposits are supported in the new contract
                            if (!selectedChannelToken?.isETH) {
                              depositToken?.();
                            }
                          }}
                          disabled={
                            !depositAmount || 
                            !mptKey ||
                            isDepositingETH || 
                            isDepositingToken ||
                            isWaitingDeposit ||
                            (selectedChannelToken && !selectedChannelToken.isETH && needsApproval) ||
                            (selectedChannelToken && !selectedChannelToken.isETH && !hasSufficientAllowance) ||
                            !isDepositAmountValid(depositAmount, actualTokenDecimals)
                          }
                          className="flex-1 px-6 py-3 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {(isDepositingETH || isDepositingToken) ? 'Depositing...' : 
                           isWaitingDeposit ? 'Confirming...' : 
                           (isFrostSignatureEnabled && !isPublicKeySet) ? 'Public Key Required' :
                           'Deposit'}
                        </button>
                      </div>

                      {/* Error Messages */}
                      {approvalError && (
                        <p className="text-red-400 text-sm flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {approvalError}
                        </p>
                      )}

                      {/* Public Key Status Section */}
                      <div className="bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Key className="h-5 w-5 text-[#4fc3f7]" />
                          <h4 className="font-semibold text-[#4fc3f7]">Channel Public Key Status</h4>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-300">Status:</span>
                            {isPublicKeySet ? (
                              <span className="px-2 py-1 bg-green-500/20 border border-green-500/50 text-green-400 text-xs rounded">
                                Set
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-red-500/20 border border-red-500/50 text-red-400 text-xs rounded">
                                Not Set
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 w-12">pkx:</span>
                              <span className="font-mono text-gray-300 text-xs break-all">
                                {isPublicKeySet && publicKey ? String(publicKey[0]) : '0x'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 w-12">pky:</span>
                              <span className="font-mono text-gray-300 text-xs break-all">
                                {isPublicKeySet && publicKey ? String(publicKey[1]) : '0x'}
                              </span>
                            </div>
                          </div>
                          
                          {isFrostSignatureEnabled && !isPublicKeySet && (
                            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-yellow-300">
                                  <p className="font-medium mb-1">DKG Required</p>
                                  <p>The channel leader must complete the DKG ceremony to set the public key before deposits can be made.</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {isFrostSignatureEnabled === false && (
                            <div className="mt-3 p-3 bg-green-500/10 border border-green-500/50 rounded">
                              <div className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-green-300">
                                  <p className="font-medium mb-1">Frost Signatures Disabled</p>
                                  <p>This channel operates without threshold signatures. No DKG ceremony required for deposits.</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Messages */}
                      <div className="bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 p-4">
                        <h4 className="font-semibold text-[#4fc3f7] mb-2">Deposit Summary</h4>
                        <div className="space-y-1 text-sm text-gray-300">
                          <p>Channel: #{selectedChannel.channelId.toString()}</p>
                          <p>Target Contract: {selectedChannel.targetContract ? 
                            `${selectedChannel.targetContract.substring(0, 8)}...${selectedChannel.targetContract.substring(36)}` : 
                            'Not set'}</p>
                          <p>Token: {actualTokenSymbol}</p>
                          <p>Amount: {depositAmount || '0'} {actualTokenSymbol}</p>
                          <p>MPT Key: {mptKey || 'Not set'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </ClientOnly>
            </div>
          </div>
        </main>
        
        <Footer className="mt-auto" />
      </div>

      {/* Public Key Warning Modal */}
      {showPublicKeyWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-xl shadow-[#4fc3f7]/30 max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#4fc3f7]/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-red-500/20 border border-red-500/50 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Transaction Will Revert
                </h3>
              </div>
              <button
                onClick={() => setShowPublicKeyWarning(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <p className="text-gray-300 mb-4">
                This channel has frost signatures enabled, but the group public key has not been set yet. Any deposit transaction will revert and fail.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
                <h4 className="font-medium text-yellow-300 mb-2">
                  Required Action:
                </h4>
                <p className="text-sm text-yellow-200">
                  The channel leader must complete the DKG (Distributed Key Generation) ceremony first to set the group public key before any deposits can be made.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-[#4fc3f7]/30">
              <button 
                onClick={() => setShowPublicKeyWarning(false)}
                className="w-full px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#029bee] transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showDepositSuccessPopup && successDepositInfo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-xl shadow-[#4fc3f7]/30 max-w-md w-full mx-4">
            {/* Header */}
            <div className="p-6 border-b border-[#4fc3f7]/30">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-green-500/20 border border-green-500/50 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Deposit Successful!</h2>
                  <p className="text-sm text-gray-300">
                    Channel {successDepositInfo.channelId} • {successDepositInfo.amount} {successDepositInfo.tokenSymbol}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Deposit Confirmed</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white">Transaction Confirmed</p>
                    <p>Your {successDepositInfo.tokenSymbol} tokens have been deposited into the channel.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ArrowDownCircle className="w-5 h-5 text-[#4fc3f7] flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white">Next Steps</p>
                    <p>Wait for other participants to deposit, then the channel leader will initialize the channel state.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-500/10 border border-green-500/50">
                <p className="text-sm text-green-400">
                  <span className="font-medium">Deposit Details:</span> {successDepositInfo.amount} {successDepositInfo.tokenSymbol} deposited to Channel {successDepositInfo.channelId}
                </p>
                {successDepositInfo.txHash && (
                  <p className="text-xs text-green-400/80 mt-1 font-mono break-all">
                    TX: {successDepositInfo.txHash}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#4fc3f7]/30">
              <button
                onClick={() => {
                  setShowDepositSuccessPopup(false);
                  setSuccessDepositInfo(null);
                  window.location.reload(); // Refresh the page
                }}
                className="w-full px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#029bee] transition-colors font-medium"
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