'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { Footer } from '@/components/Footer';
import {
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI,
  ROLLUP_BRIDGE_PROOF_MANAGER_ABI,
  getGroth16VerifierAddress
} from '@/lib/contracts';
import { getTokenSymbol, getTokenDecimals } from '@/lib/tokenUtils';
import { generateClientSideProof, isClientProofGenerationSupported, getMemoryRequirement, requiresExternalDownload, getDownloadSize } from '@/lib/clientProofGeneration';
import { Unlock, Link, FileText, CheckCircle2, XCircle, Calculator, Download, Upload } from 'lucide-react';

// Interfaces
interface FinalBalances {
  [participantAddress: string]: {
    [tokenAddress: string]: string;
  };
}

interface ChannelFinalizationProof {
  pA: [bigint, bigint, bigint, bigint];
  pB: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  pC: [bigint, bigint, bigint, bigint];
}

export default function UnfreezeStatePage() {
  const { isConnected, address } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Form state
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [finalBalances, setFinalBalances] = useState<FinalBalances>({});
  const [balancesFile, setBalancesFile] = useState<File | null>(null);
  const [balancesError, setBalancesError] = useState('');
  
  // Proof generation state
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [proofGenerationStatus, setProofGenerationStatus] = useState('');
  const [generatedProof, setGeneratedProof] = useState<ChannelFinalizationProof | null>(null);
  const [browserCompatible, setBrowserCompatible] = useState<boolean | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      setBrowserCompatible(isClientProofGenerationSupported());
    }
  }, []);

  // Channel information from core contract
  const { data: channelInfo } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelInfo',
    args: selectedChannelId ? [BigInt(selectedChannelId)] : undefined,
    enabled: Boolean(selectedChannelId)
  });

  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: selectedChannelId ? [BigInt(selectedChannelId)] : undefined,
    enabled: Boolean(selectedChannelId)
  });

  const { data: allowedTokens } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelAllowedTokens',
    args: selectedChannelId ? [BigInt(selectedChannelId)] : undefined,
    enabled: Boolean(selectedChannelId)
  });

  const { data: channelTreeSize } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelTreeSize',
    args: selectedChannelId ? [BigInt(selectedChannelId)] : undefined,
    enabled: Boolean(selectedChannelId)
  });

  const { data: finalStateRoot } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelFinalStateRoot',
    args: selectedChannelId ? [BigInt(selectedChannelId)] : undefined,
    enabled: Boolean(selectedChannelId)
  });

  // Convert final balances to array format for contract
  const finalBalancesArray = useMemo(() => {
    if (!channelParticipants || !allowedTokens || !finalBalances) return [];
    
    return channelParticipants.map((participant: string) => {
      return allowedTokens.map((token: string) => {
        const balance = finalBalances[participant]?.[token] || '0';
        return BigInt(balance);
      });
    });
  }, [channelParticipants, allowedTokens, finalBalances]);

  // Contract write preparation
  const { config, error: prepareError } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
    abi: ROLLUP_BRIDGE_PROOF_MANAGER_ABI,
    functionName: 'verifyFinalBalancesGroth16',
    args: selectedChannelId && generatedProof && finalBalancesArray.length > 0 ? [
      BigInt(selectedChannelId),
      finalBalancesArray,
      generatedProof
    ] : undefined,
    enabled: Boolean(selectedChannelId && generatedProof && finalBalancesArray.length > 0)
  });

  const { data, write } = useContractWrite(config);
  
  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  // Show success popup when transaction is successful
  useEffect(() => {
    if (isSuccess) {
      setShowSuccessPopup(true);
      setIsGeneratingProof(false);
      setProofGenerationStatus('');
    }
  }, [isSuccess]);

  // Helper functions
  const getChannelStateDisplay = (stateNumber: number) => {
    const states = {
      0: 'None',
      1: 'Initialized', 
      2: 'Open',
      3: 'Active',
      4: 'Closing',
      5: 'Closed'
    };
    return states[stateNumber as keyof typeof states] || 'Unknown';
  };

  const getChannelStateColor = (stateNumber: number) => {
    const colors = {
      0: 'text-gray-500',
      1: 'text-blue-400',
      2: 'text-green-400',
      3: 'text-green-400',
      4: 'text-yellow-400',
      5: 'text-red-400'
    };
    return colors[stateNumber as keyof typeof colors] || 'text-gray-500';
  };

  // File upload handler
  const handleBalancesFileUpload = async (file: File) => {
    try {
      setBalancesError('');
      
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Validate JSON structure
      if (typeof jsonData !== 'object' || jsonData === null) {
        throw new Error('Invalid JSON format');
      }
      
      // Convert to our internal format
      const balances: FinalBalances = {};
      for (const [participant, tokenBalances] of Object.entries(jsonData)) {
        if (typeof tokenBalances !== 'object' || tokenBalances === null) {
          throw new Error(`Invalid token balances for participant ${participant}`);
        }
        balances[participant] = tokenBalances as { [tokenAddress: string]: string };
      }
      
      setFinalBalances(balances);
      setBalancesFile(file);
      
    } catch (error) {
      console.error('Error parsing balances file:', error);
      setBalancesError(error instanceof Error ? error.message : 'Invalid file format');
    }
  };

  // Generate Groth16 proof for final balances
  const generateGroth16Proof = async () => {
    if (!selectedChannelId || !channelParticipants || !allowedTokens || !channelTreeSize || !finalStateRoot) {
      throw new Error('Missing channel data');
    }

    setProofGenerationStatus('Collecting channel data...');
    
    const participantCount = channelParticipants.length;
    const tokenCount = allowedTokens.length;
    const treeSize = Number(channelTreeSize);
    
    // Validate tree size is supported
    if (![16, 32, 64, 128].includes(treeSize)) {
      throw new Error(`Unsupported tree size: ${treeSize}`);
    }
    
    setProofGenerationStatus(`Collecting L2 MPT keys for ${treeSize}-leaf merkle tree...`);
    
    // Collect L2 MPT keys for each participant-token combination
    const storageKeysL2MPT: string[] = [];
    const storageValues: string[] = [];
    
    for (let i = 0; i < channelParticipants.length && storageKeysL2MPT.length < treeSize; i++) {
      const participant = channelParticipants[i];
      
      for (let j = 0; j < allowedTokens.length && storageKeysL2MPT.length < treeSize; j++) {
        const token = allowedTokens[j];
        
        setProofGenerationStatus(`Fetching L2 MPT key for participant ${i + 1}, token ${j + 1}...`);
        
        let l2MptKey = '0';
        try {
          const keyResponse = await fetch(`/api/get-l2-mpt-key?participant=${participant}&token=${token}&channelId=${selectedChannelId}`, {
            signal: AbortSignal.timeout(5000)
          });
          if (keyResponse.ok) {
            const keyResult = await keyResponse.json();
            l2MptKey = keyResult.key || '0';
          }
        } catch (error) {
          console.error(`Failed to fetch L2 MPT key for ${participant}-${token}:`, error);
        }
        
        // Get final balance from uploaded data
        const finalBalance = finalBalances[participant]?.[token] || '0';
        
        storageKeysL2MPT.push(l2MptKey);
        storageValues.push(finalBalance);
      }
    }
    
    // Pad arrays to exactly treeSize elements
    while (storageKeysL2MPT.length < treeSize) {
      storageKeysL2MPT.push('0');
      storageValues.push('0');
    }
    
    setProofGenerationStatus('Preparing circuit input...');
    
    const circuitInput = {
      storage_keys_L2MPT: storageKeysL2MPT,
      storage_values: storageValues,
      merkleRoot: finalStateRoot,
      treeSize: treeSize
    };
    
    console.log('Circuit Input for Final Balances:', circuitInput);
    
    const memoryReq = getMemoryRequirement(treeSize);
    const needsDownload = requiresExternalDownload(treeSize);
    const downloadInfo = needsDownload ? ` + ${getDownloadSize(treeSize)} download` : '';
    setProofGenerationStatus(`Generating Groth16 proof for ${treeSize}-leaf tree (${memoryReq}${downloadInfo})...`);
    
    // Generate proof client-side
    const result = await generateClientSideProof(circuitInput, (status) => {
      setProofGenerationStatus(status);
    });
    
    setProofGenerationStatus('Proof generated successfully!');
    
    return {
      pA: result.proof.pA as [bigint, bigint, bigint, bigint],
      pB: result.proof.pB as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
      pC: result.proof.pC as [bigint, bigint, bigint, bigint]
    };
  };

  // Handle proof generation and submission
  const handleUnfreezeState = async () => {
    if (!selectedChannelId) return;
    
    setIsGeneratingProof(true);
    
    try {
      const proof = await generateGroth16Proof();
      setGeneratedProof(proof);
      
      setProofGenerationStatus('Submitting to blockchain...');
      
      // Submit to contract
      write?.();
    } catch (error) {
      console.error('Error during unfreeze:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setProofGenerationStatus(`Error: ${errorMessage}`);
      setIsGeneratingProof(false);
      
      setTimeout(() => {
        setProofGenerationStatus('');
      }, 5000);
    }
  };

  // Form validation
  const isFormValid = () => {
    return Boolean(
      selectedChannelId &&
      Object.keys(finalBalances).length > 0 &&
      channelInfo &&
      Number(channelInfo[1]) === 4 // Closing state
    );
  };

  // Download template
  const handleDownloadTemplate = () => {
    const template = {
      "0x1234567890123456789012345678901234567890": {
        "0xA0b86a33E6B0231b4c256F02c1B54da4F0CD6B7D": "1000000000000000000",
        "0x0000000000000000000000000000000000000001": "500000000000000000"
      },
      "0x2345678901234567890123456789012345678901": {
        "0xA0b86a33E6B0231b4c256F02c1B54da4F0CD6B7D": "2000000000000000000",
        "0x0000000000000000000000000000000000000001": "1000000000000000000"
      },
      "_template_info": {
        "description": "Final balances template for unfreeze state",
        "format": "{ participantAddress: { tokenAddress: balance } }",
        "notes": [
          "Replace participant addresses with actual channel participant addresses",
          "Replace token addresses with actual channel allowed token addresses",
          "Balances should be in wei (smallest unit) as decimal strings",
          "ETH is represented as 0x0000000000000000000000000000000000000001",
          "Total balances per token must equal total deposits for that token"
        ]
      }
    };
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `final-balances-template-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"></div>;
  }

  return (
    <div className="min-h-screen space-background">
      <ClientOnly>
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>

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
                <Unlock className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Unfreeze State</h1>
            </div>
            <p className="text-gray-300 ml-13">
              Verify final balances and unfreeze the channel state to close the channel
            </p>
          </div>

          {!isConnected ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Link className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-300 mb-6">
                Please connect your wallet to unfreeze channel state
              </p>
              <ConnectButton />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Channel Selection */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Channel Selection</h2>
                    <p className="text-gray-300 mt-1">
                      Select the channel you want to unfreeze
                    </p>
                  </div>
                </div>
                
                <div className="max-w-md">
                  <label className="block text-sm font-medium text-white mb-2">
                    Channel ID *
                  </label>
                  <input
                    type="text"
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    placeholder="Enter channel ID (e.g., 1, 2, 3...)"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#4fc3f7] focus:ring-1 focus:ring-[#4fc3f7]"
                  />
                </div>
              </div>

              {/* Channel Overview */}
              {selectedChannelId && channelInfo && (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Channel Information</h2>
                      <p className="text-gray-300 mt-1">
                        Review channel status before unfreezing
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Channel ID</div>
                      <div className="text-lg font-semibold text-white">#{selectedChannelId}</div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Status</div>
                      <div className={`text-lg font-semibold ${getChannelStateColor(Number(channelInfo[1]))}`}>
                        {getChannelStateDisplay(Number(channelInfo[1]))}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Participants</div>
                      <div className="text-lg font-semibold text-white">
                        {channelParticipants ? channelParticipants.length : '...'}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Tree Size</div>
                      <div className="text-lg font-semibold text-white">
                        {channelTreeSize ? Number(channelTreeSize) : '...'} leaves
                      </div>
                    </div>
                  </div>

                  {Number(channelInfo[1]) !== 4 && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="text-red-400 text-sm">
                        ⚠️ Channel must be in "Closing" state to unfreeze. Current state: {getChannelStateDisplay(Number(channelInfo[1]))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Final Balances Upload */}
              {selectedChannelId && channelInfo && Number(channelInfo[1]) === 4 && (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                  <div className="p-6 border-b border-[#4fc3f7]/30">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Final Balances
                    </h3>
                    <p className="text-gray-400">
                      Upload the final balances JSON file to verify and unfreeze the channel
                    </p>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    <div className="text-center mb-6">
                      <button
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-[#4fc3f7] rounded-lg hover:bg-[#4fc3f7]/20 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download Template
                      </button>
                    </div>

                    <div className="max-w-2xl mx-auto">
                      <label className="block text-sm font-medium text-white mb-4">
                        Final Balances File (JSON) *
                      </label>
                      {!balancesFile ? (
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-[#4fc3f7] transition-colors">
                          <input
                            type="file"
                            accept=".json"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleBalancesFileUpload(file);
                            }}
                            className="hidden"
                            id="balances-file"
                          />
                          <label htmlFor="balances-file" className="cursor-pointer">
                            <div className="text-gray-500 dark:text-gray-400">
                              <Upload className="mx-auto h-16 w-16 mb-4" />
                              <p className="text-lg font-medium mb-2">Click to upload final balances</p>
                              <p className="text-sm">Upload JSON file containing final balances for all participants</p>
                            </div>
                          </label>
                        </div>
                      ) : (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-12 w-12 text-green-400" />
                              <div>
                                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">{balancesFile.name}</h3>
                                <p className="text-sm text-green-400">Final balances loaded successfully</p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setBalancesFile(null);
                                setFinalBalances({});
                              }}
                              className="text-red-400 hover:text-red-600 p-2"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                              <div className="text-gray-400">Participants</div>
                              <div className="font-semibold text-green-800 dark:text-green-200">
                                {Object.keys(finalBalances).length}
                              </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                              <div className="text-gray-400">Total Entries</div>
                              <div className="font-semibold text-green-800 dark:text-green-200">
                                {finalBalancesArray.reduce((acc, curr) => acc + curr.length, 0)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {balancesError && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                          <p className="text-red-400 text-sm">{balancesError}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Section */}
              {isFormValid() && (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                  <div className="p-6">
                    {/* Proof Generation Status */}
                    {(isGeneratingProof || proofGenerationStatus) && (
                      <div className="mb-4 p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-center">
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
                          Your browser doesn't support WebAssembly for client-side proof generation.
                        </p>
                      </div>
                    )}

                    {isSuccess && (
                      <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-300">
                          <strong className="block mb-1">Success!</strong>
                          Final balances verified and channel state unfrozen! Channel is now closed.
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={handleUnfreezeState}
                      disabled={!isFormValid() || isGeneratingProof || isTransactionLoading || browserCompatible === false}
                      className={`w-full px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
                        isFormValid() && !isGeneratingProof && !isTransactionLoading && browserCompatible !== false
                          ? 'bg-[#4fc3f7] hover:bg-[#029bee] text-white shadow-lg shadow-[#4fc3f7]/30 hover:shadow-xl hover:shadow-[#4fc3f7]/50'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isGeneratingProof ? (
                        <div className="flex items-center justify-center gap-3">
                          <Calculator className="w-5 h-5 animate-pulse" />
                          <span>Generating Proof...</span>
                        </div>
                      ) : isTransactionLoading ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Submitting...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          <Unlock className="w-5 h-5" />
                          <span>Generate Proof & Unfreeze State</span>
                        </div>
                      )}
                    </button>
                    
                    <p className="text-xs text-gray-400 mt-3 text-center">
                      This will generate a Groth16 proof of the final balances and submit it to verify and close the channel
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        <Footer className="mt-auto" />
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 max-w-md w-full mx-4 shadow-lg shadow-[#4fc3f7]/20">
            <div className="text-center">
              <div className="h-16 w-16 bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Channel Successfully Closed!
              </h3>
              <p className="text-gray-300 mb-4">
                The final balances have been verified and the channel state has been unfrozen. 
                The channel is now closed and participants can withdraw their tokens.
              </p>
              <p className="text-sm text-[#4fc3f7] mb-6">
                Channel {selectedChannelId} is ready for withdrawals!
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