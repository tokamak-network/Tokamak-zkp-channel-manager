'use client';

import React, { useState, useEffect } from 'react';
import { useContractRead, useContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { Footer } from '@/components/Footer';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { Settings, Link, ShieldOff, Users, CheckCircle2, XCircle, Calculator } from 'lucide-react';

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
  const { isConnected, hasAccess, isMounted, leaderChannel: hookLeaderChannel } = useLeaderAccess();
  const { address } = useAccount();
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [animateCards, setAnimateCards] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [proofGenerationStatus, setProofGenerationStatus] = useState('');
  const [generatedProof, setGeneratedProof] = useState<any>(null);

  // Get total number of channels
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isMounted && isConnected,
  });

  // Note: Channel stats are handled by useLeaderAccess hook


  // Initialize channel state transaction
  const { write: initializeChannelState, data: initializeData } = useContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
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
    if (isMounted && hookLeaderChannel) {
      const timer = setTimeout(() => {
        setAnimateCards(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMounted, hookLeaderChannel]);


  // Get participants for leader channel
  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: hookLeaderChannel ? [BigInt(hookLeaderChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!hookLeaderChannel,
  });

  // Get first non-ETH token from allowed tokens for debug info
  const getFirstToken = () => {
    const allowedTokens = hookLeaderChannel?.stats?.[1] as readonly `0x${string}`[];
    if (!Array.isArray(allowedTokens)) return null;
    
    return allowedTokens.find(token => 
      token !== '0x0000000000000000000000000000000000000001' && 
      token !== '0x0000000000000000000000000000000000000000' &&
      isAddress(token)
    ) || null;
  };

  const firstToken = getFirstToken();

  // Get token info using debugTokenInfo for consistency with other pages
  const { data: tokenInfo } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'debugTokenInfo',
    args: firstToken && address ? [firstToken, address] : undefined,
    enabled: isMounted && isConnected && !!firstToken && !!address,
  });

  // Extract token info with proper fallbacks
  const tokenDecimals = tokenInfo?.[6] || 18;
  const tokenSymbol = tokenInfo?.[5] || 'TOKEN';

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
    if (!hookLeaderChannel || !channelParticipants) {
      throw new Error('Missing channel data');
    }

    setProofGenerationStatus('Collecting channel data...');
    
    // Collect storage keys (L2 MPT keys) and values (deposits)
    const storageKeysL2MPT: string[] = [];
    const storageValues: string[] = [];
    
    const allowedTokens = hookLeaderChannel.stats[1] as readonly `0x${string}`[];
    
    // Build participant-token combinations with fallback strategy
    for (let j = 0; j < allowedTokens.length && storageKeysL2MPT.length < 16; j++) {
      const token = allowedTokens[j];
      
      setProofGenerationStatus(`Fetching L2 MPT keys for token ${j + 1} of ${allowedTokens.length}...`);
      
      let keysResult: any = null;
      
      // Try bulk API first
      try {
        const keysResponse = await fetch(`/api/get-l2-mpt-keys-list?channelId=${hookLeaderChannel.id}&token=${token}`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (keysResponse.ok) {
          keysResult = await keysResponse.json();
          console.log('✓ Bulk L2 MPT keys fetch successful');
        } else {
          throw new Error(`HTTP ${keysResponse.status}`);
        }
      } catch (error) {
        console.warn(`Bulk L2 MPT keys failed for token ${token}, falling back to individual calls:`, error);
      }
      
      // Process each participant for this token
      for (let i = 0; i < channelParticipants.length && storageKeysL2MPT.length < 16; i++) {
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
              const keyResponse = await fetch(`/api/get-l2-mpt-key?participant=${participant}&token=${token}&channelId=${hookLeaderChannel.id}`, {
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
            const depositResponse = await fetch(`/api/get-participant-deposit?participant=${participant}&token=${token}&channelId=${hookLeaderChannel.id}`, {
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
    
    // Pad arrays to exactly 16 elements (circuit requirement)
    while (storageKeysL2MPT.length < 16) {
      storageKeysL2MPT.push('0');
      storageValues.push('0');
    }
    
    setProofGenerationStatus('Preparing circuit input...');
    
    const circuitInput = {
      storage_keys_L2MPT: storageKeysL2MPT,
      storage_values: storageValues
    };
    
    console.log('Circuit input:', circuitInput);
    setProofGenerationStatus('Generating Groth16 proof (this may take a few minutes)...');
    
    // Call proof generation API that uses generateProof.js
    const response = await fetch('/api/generate-groth16-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(circuitInput)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Proof generation failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    setProofGenerationStatus('Proof generated successfully!');
    
    console.log('Generated proof:', result);
    
    return result.proof;
  };

  const handleInitializeState = async () => {
    if (!hookLeaderChannel) return;
    
    setButtonClicked(true);
    setIsGeneratingProof(true);
    
    try {
      // First generate the Groth16 proof
      const proof = await generateGroth16Proof();
      setGeneratedProof(proof);
      
      setProofGenerationStatus('Submitting to blockchain...');
      
      // Then submit to contract with proof
      initializeChannelState({
        args: [BigInt(hookLeaderChannel.id), proof]
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
          ) : !hasAccess ? (
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
          ) : !hookLeaderChannel ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Channel to Initialize</h3>
              <p className="text-gray-300 mb-4">
                You don't have a channel in "Initialized" state that can be opened
              </p>
              <p className="text-sm text-gray-400">
                Create a new channel or wait for participants to deposit tokens in your existing channel
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Channel Info */}
              <div className={`bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 sm:p-6 shadow-lg shadow-[#4fc3f7]/20 transform transition-all duration-700 ${
                animateCards ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#4fc3f7]" />
                  Channel {hookLeaderChannel.id} - Ready to Initialize
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                    <div className="text-xs sm:text-sm text-gray-400">Channel ID</div>
                    <div className="text-lg sm:text-xl font-bold text-white">{hookLeaderChannel.id}</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                    <div className="text-xs sm:text-sm text-gray-400">Current State</div>
                    <div className="text-lg sm:text-xl font-bold text-[#4fc3f7]">{getChannelStateName(hookLeaderChannel.stats[2])}</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                    <div className="text-xs sm:text-sm text-gray-400">Participants</div>
                    <div className="text-lg sm:text-xl font-bold text-green-400">{channelParticipants?.length || '0'}</div>
                  </div>
                </div>
              </div>

              {/* Participant Info Display */}
              {channelParticipants && (
                <div className={`bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 sm:p-6 shadow-lg shadow-[#4fc3f7]/20 transform transition-all duration-700 delay-150 ${
                  animateCards ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#4fc3f7]" />
                    <span className="hidden sm:inline">Channel {hookLeaderChannel.id} - </span>Participants
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
                    
                    <button
                      onClick={handleInitializeState}
                      disabled={isInitializingTransaction || isGeneratingProof || hookLeaderChannel.stats[2] !== 1}
                      className={`px-6 sm:px-8 py-3 sm:py-4 font-semibold text-white text-base sm:text-lg transition-all duration-300 transform ${
                        buttonClicked ? 'scale-95' : 'hover:scale-105'
                      } ${
                        isInitializingTransaction || isGeneratingProof || hookLeaderChannel.stats[2] !== 1
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
                      ) : hookLeaderChannel.stats[2] !== 1 ? (
                        <div className="flex items-center gap-3 justify-center">
                          {hookLeaderChannel.stats[2] >= 2 ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
                          {hookLeaderChannel.stats[2] >= 2 
                            ? `Channel Already Initialized (State: ${getChannelStateName(hookLeaderChannel.stats[2])})`
                            : `Channel Not Ready (State: ${getChannelStateName(hookLeaderChannel.stats[2])})`
                          }
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 justify-center">
                          <Settings className="w-5 h-5" />
                          Generate Proof & Initialize Channel
                        </div>
                      )}
                    </button>

                    <p className="text-xs text-gray-400 mt-2 sm:mt-3">
                      This will generate a Groth16 proof using the 16-leaf merkle tree circuit and submit it to initialize the channel
                    </p>
                  </div>
                </div>
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
                Channel {hookLeaderChannel?.id} is ready for active operations!
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