'use client';

import React, { useState, useEffect } from 'react';
import { useContractRead, useContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { Footer } from '@/components/Footer';
import {
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_ADDRESS,
  ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI,
  ROLLUP_BRIDGE_ABI,
  ROLLUP_BRIDGE_PROOF_MANAGER_ABI,
  getGroth16VerifierAddress
} from '@/lib/contracts';
import { getTokenSymbol, getTokenDecimals } from '@/lib/tokenUtils';
import { generateClientSideProof, isClientProofGenerationSupported, getMemoryRequirement, requiresExternalDownload, getDownloadSize } from '@/lib/clientProofGeneration';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';
import { Settings, Link, ShieldOff, Users, CheckCircle2, XCircle, Calculator, ChevronRight } from 'lucide-react';

// Custom animations
const animations = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(30px) scale(0.95);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  @keyframes bounceIn {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.02);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }

  .animate-slideUp {
    animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .animate-bounceIn {
    animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  .animate-cardPulse {
    animation: pulse 2s infinite;
  }
`;

export default function InitializeStatePage() {
  const { address, isConnected } = useAccount();
  const { hasChannels, leadingChannels, channelStatsData } = useUserRolesDynamic();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [animateCards, setAnimateCards] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [proofGenerationStatus, setProofGenerationStatus] = useState('');
  const [generatedProof, setGeneratedProof] = useState<any>(null);
  const [browserCompatible, setBrowserCompatible] = useState<boolean | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Get channels that can be initialized (leading channels with state = 1)
  const initializableChannels = leadingChannels
    .map(channelId => {
      const stats = channelStatsData[channelId];
      if (!stats || stats[2] !== 1) return null; // Only "Initialized" state channels
      return {
        id: channelId,
        stats,
        allowedTokens: stats[1] as readonly `0x${string}`[],
        state: stats[2],
        participantCount: stats[3]
      };
    })
    .filter(Boolean) as {
      id: number;
      stats: readonly [bigint, readonly `0x${string}`[], number, bigint, `0x${string}`];
      allowedTokens: readonly `0x${string}`[];
      state: number;
      participantCount: bigint;
    }[];

  // Auto-select first channel if only one available
  useEffect(() => {
    if (initializableChannels.length === 1 && !selectedChannelId) {
      setSelectedChannelId(initializableChannels[0].id);
    }
  }, [initializableChannels, selectedChannelId]);

  // Get selected channel data
  const selectedChannel = selectedChannelId ? initializableChannels.find(ch => ch.id === selectedChannelId) : null;


  // Initialize channel state transaction - now uses ProofManager
  const { write: initializeChannelState, data: initializeData } = useContractWrite({
    address: ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
    abi: ROLLUP_BRIDGE_PROOF_MANAGER_ABI,
    functionName: 'initializeChannelState',
  });

  const { isLoading: isInitializingTransaction, isSuccess: isInitializeSuccess } = useWaitForTransaction({
    hash: initializeData?.hash,
  });

  // Show success popup when transaction is successful
  useEffect(() => {
    if (isInitializeSuccess) {
      setIsGeneratingProof(false);
      setProofGenerationStatus('');
      setShowSuccessPopup(true);
    }
  }, [isInitializeSuccess]);

  // Animate cards on mount
  useEffect(() => {
    if (isMounted && (initializableChannels.length > 0 || selectedChannel)) {
      const timer = setTimeout(() => {
        setAnimateCards(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMounted, initializableChannels.length, selectedChannel]);

  // Check browser compatibility for client-side proof generation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBrowserCompatible(isClientProofGenerationSupported());
    }
  }, []);

  // Get participants for selected channel from Core contract
  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: selectedChannel ? [BigInt(selectedChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!selectedChannel,
  });

  // Get first non-ETH token from selected channel's allowed tokens for debug info
  const getFirstToken = () => {
    const allowedTokens = selectedChannel?.allowedTokens;
    if (!Array.isArray(allowedTokens)) return null;
    
    return allowedTokens.find(token => 
      token !== '0x0000000000000000000000000000000000000001' && 
      token !== '0x0000000000000000000000000000000000000000' &&
      isAddress(token)
    ) || null;
  };

  const firstToken = getFirstToken();

  // Get tree size for the selected channel to determine circuit size
  const { data: channelTreeSize } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelTreeSize',
    args: selectedChannel ? [BigInt(selectedChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!selectedChannel,
  });

  // TODO: debugTokenInfo function removed from new contract architecture
  // Using centralized token mapping functions
  const tokenDecimals = firstToken ? getTokenDecimals(firstToken) : 18;
  const tokenSymbol = firstToken ? getTokenSymbol(firstToken) : 'TOKEN';

  // Note: We'll fetch individual participant deposits during proof generation
  // since there's no single function to get all channel deposits

  // Get channel state name
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

  // Generate Groth16 proof for channel initialization
  const generateGroth16Proof = async () => {
    if (!selectedChannel || !channelParticipants) {
      throw new Error('Missing channel data');
    }

    setProofGenerationStatus('Collecting channel data...');
    
    // Determine required tree size first from contract or calculate based on channel data
    const participantCount = channelParticipants.length;
    const allowedTokens = selectedChannel.allowedTokens;
    const tokenCount = allowedTokens.length;
    
    // Calculate expected number of entries (participants × tokens)
    const expectedEntries = participantCount * tokenCount;
    
    // Determine tree size from contract or calculate based on expected entries
    let treeSize: number;
    if (channelTreeSize) {
      treeSize = Number(channelTreeSize);
    } else {
      // Find the smallest tree size that can accommodate all entries
      const minTreeSize = Math.max(16, Math.min(128, 2 ** Math.ceil(Math.log2(expectedEntries))));
      treeSize = [16, 32, 64, 128].find(size => size >= minTreeSize) || 128;
    }
    
    // Validate tree size is supported
    if (![16, 32, 64, 128].includes(treeSize)) {
      throw new Error(`Unsupported tree size: ${treeSize}. Channel tree size from contract: ${channelTreeSize}`);
    }
    
    setProofGenerationStatus(`Collecting data for ${treeSize}-leaf merkle tree (${participantCount} participants × ${tokenCount} tokens)...`);
    
    // Collect storage keys (L2 MPT keys) and values (deposits)
    const storageKeysL2MPT: string[] = [];
    const storageValues: string[] = [];
    
    // Build participant-token combinations - collect up to tree size
    for (let j = 0; j < allowedTokens.length && storageKeysL2MPT.length < treeSize; j++) {
      const token = allowedTokens[j];
      
      setProofGenerationStatus(`Fetching L2 MPT keys for token ${j + 1} of ${allowedTokens.length}...`);
      
      let keysResult: any = null;
      
      // Try bulk API first
      try {
        const keysResponse = await fetch(`/api/get-l2-mpt-keys-list?channelId=${selectedChannel.id}&token=${token}`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (keysResponse.ok) {
          keysResult = await keysResponse.json();
        } else {
          throw new Error(`HTTP ${keysResponse.status}`);
        }
      } catch (error) {
        console.warn(`Bulk L2 MPT keys failed for token ${token}, falling back to individual calls:`, error);
      }
      
      // Process each participant for this token
      for (let i = 0; i < channelParticipants.length && storageKeysL2MPT.length < treeSize; i++) {
        const participant = channelParticipants[i];
        
        setProofGenerationStatus(`Processing participant ${i + 1}, token ${j + 1}...`);
        
        let l2MptKey = '0';
        let deposit = '0';
        
        try {
          // Get L2 MPT key (from bulk result or individual call)
          if (keysResult?.keyMap) {
            l2MptKey = keysResult.keyMap[participant] || '0';
          } else {
            // Fallback to individual call with timeout
            try {
              const keyResponse = await fetch(`/api/get-l2-mpt-key?participant=${participant}&token=${token}&channelId=${selectedChannel.id}`, {
                signal: AbortSignal.timeout(5000)
              });
              if (keyResponse.ok) {
                const keyResult = await keyResponse.json();
                l2MptKey = keyResult.key || '0';
              }
            } catch (keyError) {
              console.error(`Individual L2 MPT key fetch failed for ${participant}-${token}:`, keyError);
              const errorMessage = keyError instanceof Error ? keyError.message : 'Unknown error';
              throw new Error(`Failed to fetch L2 MPT key for participant ${participant} and token ${token}: ${errorMessage}`);
            }
          }
          
          // Get deposit amount with timeout
          try {
            const depositResponse = await fetch(`/api/get-participant-deposit?participant=${participant}&token=${token}&channelId=${selectedChannel.id}`, {
              signal: AbortSignal.timeout(5000)
            });
            if (depositResponse.ok) {
              const depositResult = await depositResponse.json();
              deposit = depositResult.amount || '0';
            }
          } catch (depositError) {
            console.error(`Deposit fetch failed for ${participant}-${token}:`, depositError);
            const errorMessage = depositError instanceof Error ? depositError.message : 'Unknown error';
            throw new Error(`Failed to fetch deposit for participant ${participant} and token ${token}: ${errorMessage}`);
          }
          
          storageKeysL2MPT.push(l2MptKey);
          storageValues.push(deposit);
        } catch (error) {
          console.error(`Failed to get data for ${participant}-${token}:`, error);
          throw error; // Propagate the error instead of using mock data
        }
      }
    }
    
    // Tree size was determined earlier in the function
    
    // Pad arrays to exactly treeSize elements (circuit requirement)
    while (storageKeysL2MPT.length < treeSize) {
      storageKeysL2MPT.push('0');
      storageValues.push('0');
    }
    
    setProofGenerationStatus('Preparing circuit input...');
    
    console.log('🔍 PROOF GENERATION DEBUG:');
    console.log('  Channel ID:', selectedChannel.id);
    console.log('  Channel Tree Size:', channelTreeSize);
    console.log('  Requested Tree Size:', treeSize);
    console.log('  Storage Keys Length:', storageKeysL2MPT.length);
    console.log('  Storage Values Length:', storageValues.length);
    console.log('  First 5 Storage Keys:', storageKeysL2MPT.slice(0, 5));
    console.log('  First 5 Storage Values:', storageValues.slice(0, 5));
    
    // CRITICAL WARNING: Check for tree size mismatch
    if (treeSize > 16) {
      console.error('🚨 CRITICAL ISSUE: Tree size mismatch detected!');
      console.error('  Channel expects:', treeSize, 'leaves');
      console.error('  We can only generate: 16 leaves');
      console.error('  This will likely cause "Invalid Groth16 proof" error in contract');
      console.error('  Contract verifier was compiled for', treeSize, 'leaves, but we\'re providing 16-leaf proof');
    }
    
    const circuitInput = {
      storage_keys_L2MPT: storageKeysL2MPT,
      storage_values: storageValues,
      treeSize: treeSize
    };
    
    console.log('  Circuit Input:', {
      keysLength: circuitInput.storage_keys_L2MPT.length,
      valuesLength: circuitInput.storage_values.length,
      treeSize: circuitInput.treeSize
    });
    
    // Check if client-side proof generation is supported
    if (!isClientProofGenerationSupported()) {
      throw new Error('Client-side proof generation is not supported in this browser. Please try a modern browser with WebAssembly support.');
    }
    
    const memoryReq = getMemoryRequirement(treeSize);
    const needsDownload = requiresExternalDownload(treeSize);
    const downloadInfo = needsDownload ? ` + ${getDownloadSize(treeSize)} download` : '';
    setProofGenerationStatus(`Generating Groth16 proof for ${treeSize}-leaf tree (${memoryReq}${downloadInfo}, this may take a few minutes)...`);
    
    // Generate proof client-side using snarkjs
    const result = await generateClientSideProof(circuitInput, (status) => {
      setProofGenerationStatus(status);
    });
    
    console.log('🔍 PROOF RESULT DEBUG:');
    console.log('  Generated Proof:', result.proof);
    console.log('  Public Signals:', result.publicSignals);
    console.log('  Merkle Root:', result.proof.merkleRoot);
    
    setProofGenerationStatus('Proof generated successfully!');
    
    return result.proof;
  };

  const handleInitializeState = async () => {
    if (!selectedChannel) return;
    
    setButtonClicked(true);
    setIsGeneratingProof(true);
    
    try {
      // First generate the Groth16 proof
      console.log('🔍 STARTING PROOF GENERATION FOR CONTRACT SUBMISSION');
      const proof = await generateGroth16Proof();
      setGeneratedProof(proof);
      
      console.log('🔍 CONTRACT SUBMISSION DEBUG:');
      console.log('  Channel ID:', selectedChannel.id);
      console.log('  Channel Tree Size:', channelTreeSize);
      console.log('  Generated Proof:', proof);
      console.log('  Proof Structure:', {
        pA: proof.pA,
        pB: proof.pB,
        pC: proof.pC,
        merkleRoot: proof.merkleRoot
      });
      
      setProofGenerationStatus('Submitting to blockchain...');
      
      // Then submit to contract with proof
      console.log('🔍 CALLING CONTRACT: initializeChannelState');
      console.log('  Args:', [BigInt(selectedChannel.id), proof]);
      
      initializeChannelState({
        args: [BigInt(selectedChannel.id), proof]
      });
    } catch (error) {
      console.error('Error during initialization:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setProofGenerationStatus(`Error: ${errorMessage}`);
      setIsGeneratingProof(false);
      
      // Show error for a few seconds then clear
      setTimeout(() => {
        setProofGenerationStatus('');
      }, 5000);
    }
    
    // Reset button animation
    setTimeout(() => {
      setButtonClicked(false);
    }, 300);
  };

  const isETH = !firstToken; // If no non-ETH token found, assume ETH channel
  const displayDecimals = isETH ? 18 : tokenDecimals;
  const displaySymbol = isETH ? 'ETH' : (typeof tokenSymbol === 'string' ? tokenSymbol : 'TOKEN');

  if (!isMounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"></div>;
  }

  return (
    <div className="min-h-screen space-background">
      {/* Inject custom animations */}
      <style dangerouslySetInnerHTML={{ __html: animations }} />
      
      <ClientOnly>
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>

      {/* Mobile Navigation Menu */}
      <MobileNavigation 
        showMobileMenu={showMobileMenu} 
        setShowMobileMenu={setShowMobileMenu} 
      />

      <div className="ml-0 lg:ml-72 transition-all duration-300 min-h-screen">
        <main className="px-4 py-8 lg:px-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Initialize Channel State</h1>
            </div>
            <p className="text-gray-300 ml-13">
              Initialize your channel state to begin operations
            </p>
          </div>

          {!isConnected ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Link className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-300">
                Please connect your wallet to initialize channel state
              </p>
            </div>
          ) : !hasChannels ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <ShieldOff className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
              <p className="text-gray-300 mb-4">
                This page is only accessible to channel leaders
              </p>
              <p className="text-sm text-gray-400">
                You need to be a channel leader to initialize channel state
              </p>
            </div>
          ) : initializableChannels.length === 0 ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Channel to Initialize</h3>
              <p className="text-gray-300 mb-4">
                You don't have any channels in "Initialized" state that can be opened
              </p>
              <p className="text-sm text-gray-400">
                Create a new channel or wait for participants to deposit tokens in your existing channels
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Channel Selection */}
              {initializableChannels.length > 1 && (
                <div className={`bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 sm:p-6 shadow-lg shadow-[#4fc3f7]/20 transform transition-all duration-700 ${
                  animateCards ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#4fc3f7]" />
                    Select Channel to Initialize
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    You have {initializableChannels.length} channels ready for initialization. Select one to proceed:
                  </p>
                  <div className="grid gap-3">
                    {initializableChannels.map((channel) => (
                      <div
                        key={channel.id}
                        onClick={() => setSelectedChannelId(channel.id)}
                        className={`border p-4 cursor-pointer transition-all duration-300 ${
                          selectedChannelId === channel.id
                            ? 'border-[#4fc3f7] bg-[#4fc3f7]/10'
                            : 'border-[#4fc3f7]/30 bg-[#0a1930]/50 hover:border-[#4fc3f7]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 flex items-center justify-center">
                              <span className="text-[#4fc3f7] font-semibold">#{channel.id}</span>
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-white">Channel {channel.id}</h4>
                              <p className="text-sm text-gray-400">
                                {channel.allowedTokens.length} tokens, {Number(channel.participantCount)} participants
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedChannelId === channel.id && (
                              <CheckCircle2 className="w-6 h-6 text-[#4fc3f7]" />
                            )}
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Channel Info */}
              {selectedChannel && (
                <div className={`bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 sm:p-6 shadow-lg shadow-[#4fc3f7]/20 transform transition-all duration-700 ${
                  animateCards ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#4fc3f7]" />
                    Channel {selectedChannel.id} - Ready to Initialize
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="text-center p-3 sm:p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                      <div className="text-xs sm:text-sm text-gray-400">Channel ID</div>
                      <div className="text-lg sm:text-xl font-bold text-white">{selectedChannel.id}</div>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                      <div className="text-xs sm:text-sm text-gray-400">Current State</div>
                      <div className="text-lg sm:text-xl font-bold text-[#4fc3f7]">{getChannelStateName(selectedChannel.stats[2])}</div>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                      <div className="text-xs sm:text-sm text-gray-400">Participants</div>
                      <div className="text-lg sm:text-xl font-bold text-green-400">{channelParticipants?.length || '0'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Participant Info Display */}
              {selectedChannel && channelParticipants && (
                <div className={`bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 sm:p-6 shadow-lg shadow-[#4fc3f7]/20 transform transition-all duration-700 delay-150 ${
                  animateCards ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#4fc3f7]" />
                    <span className="hidden sm:inline">Channel {selectedChannel.id} - </span>Participants
                  </h3>

                  <div className="space-y-2 sm:space-y-3">
                    {channelParticipants.map((participant: string, index: number) => {
                      return (
                        <div 
                          key={participant} 
                          className={`p-3 sm:p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30 transform transition-all duration-500 hover:border-[#4fc3f7] hover:shadow-lg hover:shadow-[#4fc3f7]/20 ${
                            animateCards ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
                          }`}
                          style={{ transitionDelay: `${300 + (index * 100)}ms` }}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-semibold text-xs sm:text-sm">
                                {index + 1}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-400">Participant {index + 1}:</span>
                              </div>
                              <div className="font-mono text-xs sm:text-sm text-white bg-[#0a1930] px-2 sm:px-3 py-1 border border-[#4fc3f7]/30 mt-1 break-all">
                                {participant}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50">
                    <div className="text-center">
                      <div className="font-medium text-white text-sm sm:text-base">Channel Participants</div>
                      <div className="text-lg sm:text-xl font-bold text-[#4fc3f7] mt-1">
                        {channelParticipants.length} Ready
                      </div>
                      <div className="text-xs sm:text-sm text-gray-300 mt-1">
                        Proof will be generated from participant deposits and L2 MPT keys
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit State & Open Channel Button */}
              {selectedChannel && (
                <div className={`bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 sm:p-6 shadow-lg shadow-[#4fc3f7]/20 transform transition-all duration-700 delay-300 ${
                  animateCards ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'
                }`}>
                  <div className="text-center">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Ready to Initialize</h3>
                    <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6">
                      This action will generate a Groth16 proof of the channel's initial state and submit it to open the channel
                    </p>
                    
                    {/* Proof Generation Status */}
                    {(isGeneratingProof || proofGenerationStatus) && (
                      <div className="mb-4 p-3 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-center">
                        <div className="flex items-center gap-3 justify-center mb-2">
                          <Calculator className={`w-5 h-5 text-[#4fc3f7] ${isGeneratingProof ? 'animate-pulse' : ''}`} />
                          <span className="text-[#4fc3f7] font-medium">
                            {isGeneratingProof ? 'Generating Proof' : 'Proof Status'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">{proofGenerationStatus}</p>
                        {isGeneratingProof && (
                          <div className="w-full bg-[#0a1930] rounded-full h-2 mt-2">
                            <div className="bg-[#4fc3f7] h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Browser Compatibility Warning */}
                    {browserCompatible === false && (
                      <div className="mb-4 p-3 bg-red-500/20 border border-red-400/50 rounded-lg">
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <XCircle className="w-4 h-4" />
                          <span className="font-medium">Browser Not Compatible</span>
                        </div>
                        <p className="text-red-300 text-xs mt-1">
                          Your browser doesn't support WebAssembly or required APIs for client-side proof generation. 
                          Please use a modern browser like Chrome, Firefox, Safari, or Edge.
                        </p>
                      </div>
                    )}

                    {/* Memory Warning for Large Tree Sizes */}
                    {browserCompatible === true && channelTreeSize && Number(channelTreeSize) >= 64 && (
                      <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-400/50 rounded-lg">
                        <div className="flex items-center gap-2 text-yellow-400 text-sm">
                          <Settings className="w-4 h-4" />
                          <span className="font-medium">High Memory Usage</span>
                        </div>
                        <p className="text-yellow-300 text-xs mt-1">
                          {Number(channelTreeSize)}-leaf proof generation requires {getMemoryRequirement(Number(channelTreeSize))}. 
                          Make sure to close other tabs and applications before proceeding.
                        </p>
                      </div>
                    )}
                    
                    <button
                      onClick={handleInitializeState}
                      disabled={!selectedChannel || isInitializingTransaction || isGeneratingProof || selectedChannel.stats[2] !== 1 || browserCompatible === false}
                      className={`px-6 sm:px-8 py-3 sm:py-4 font-semibold text-white text-base sm:text-lg transition-all duration-300 transform ${
                        buttonClicked ? 'scale-95' : 'hover:scale-105'
                      } ${
                        !selectedChannel || isInitializingTransaction || isGeneratingProof || selectedChannel.stats[2] !== 1 || browserCompatible === false
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-[#4fc3f7] hover:bg-[#029bee] shadow-lg shadow-[#4fc3f7]/30 hover:shadow-xl hover:shadow-[#4fc3f7]/40'
                      } ${(isInitializingTransaction || isGeneratingProof) ? 'animate-pulse' : ''}`}
                    >
                      {isGeneratingProof ? (
                        <div className="flex items-center gap-3 justify-center">
                          <Calculator className="w-5 h-5 animate-pulse" />
                          Generating Proof...
                        </div>
                      ) : isInitializingTransaction ? (
                        <div className="flex items-center gap-3 justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Submitting to Blockchain...
                        </div>
                      ) : !selectedChannel ? (
                        <div className="flex items-center gap-3 justify-center">
                          <XCircle className="w-5 h-5" />
                          Select a Channel First
                        </div>
                      ) : selectedChannel.stats[2] !== 1 ? (
                        <div className="flex items-center gap-3 justify-center">
                          {selectedChannel.stats[2] >= 2 ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
                          {selectedChannel.stats[2] >= 2 
                            ? `Channel Already Initialized (State: ${getChannelStateName(selectedChannel.stats[2])})`
                            : `Channel Not Ready (State: ${getChannelStateName(selectedChannel.stats[2])})`
                          }
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 justify-center">
                          <Settings className="w-5 h-5" />
                          Generate Proof & Initialize Channel
                        </div>
                      )}
                    </button>

                    {/* Tree Size and Verifier Info */}
                    <div className="mt-4 p-3 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-center">
                      <div className="text-sm text-gray-300 mb-2">Proof Generation Details:</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Tree Size:</span>
                          <div className="text-[#4fc3f7] font-medium">
                            {channelTreeSize ? Number(channelTreeSize) : 'Auto-detect'} leaves
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Verifier:</span>
                          <div className="text-[#4fc3f7] font-medium font-mono text-xs">
                            {channelTreeSize && getGroth16VerifierAddress(Number(channelTreeSize)).slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Participants × Tokens = {channelParticipants?.length || 0} × {selectedChannel?.allowedTokens?.length || 0} = {(channelParticipants?.length || 0) * (selectedChannel?.allowedTokens?.length || 0)} entries
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-400 mt-2 sm:mt-3">
                      This will generate a Groth16 proof using the appropriate merkle tree circuit and submit it to initialize the channel
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <Footer className="mt-auto" />
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 max-w-md w-full mx-4 shadow-lg shadow-[#4fc3f7]/20 transform transition-all duration-500 animate-slideUp">
            <div className="text-center">
              <div className="h-16 w-16 bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4 animate-bounceIn">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Channel Successfully Opened!
              </h3>
              <p className="text-gray-300 mb-4">
                The channel state has been initialized and is now in an "Open" state. 
                From now on, all transactions should be managed directly from the channel itself.
              </p>
              <p className="text-sm text-[#4fc3f7] mb-6">
                Channel {selectedChannel?.id} is ready for active operations!
              </p>
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="w-full bg-[#4fc3f7] hover:bg-[#029bee] text-white font-semibold py-3 px-6 transition-colors shadow-lg shadow-[#4fc3f7]/30"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}