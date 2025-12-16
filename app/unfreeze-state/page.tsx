'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useContractRead, useContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
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
import { generateClientSideProof, isClientProofGenerationSupported, getMemoryRequirement, requiresExternalDownload, getDownloadSize } from '@/lib/clientProofGeneration';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';
import { Unlock, Link, FileText, CheckCircle2, XCircle, Calculator, Download, Upload, Settings } from 'lucide-react';

interface FinalBalances {
  [participantAddress: string]: string;
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
  
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [finalBalances, setFinalBalances] = useState<FinalBalances>({});
  const [balancesFile, setBalancesFile] = useState<File | null>(null);
  const [balancesError, setBalancesError] = useState('');
  
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [proofGenerationStatus, setProofGenerationStatus] = useState('');
  const [generatedProof, setGeneratedProof] = useState<ChannelFinalizationProof | null>(null);
  const [browserCompatible, setBrowserCompatible] = useState<boolean | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const { hasChannels, leadingChannels, channelStatsData, isLoading: isLoadingChannels } = useUserRolesDynamic();

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      setBrowserCompatible(isClientProofGenerationSupported());
    }
  }, []);

  const closingChannels = leadingChannels
    .map(channelId => {
      const stats = channelStatsData[channelId];
      if (!stats || stats[2] !== 4) return null;
      return {
        id: channelId,
        stats,
        targetContract: stats[1] as `0x${string}`,
        state: stats[2],
        participantCount: stats[3]
      };
    })
    .filter(Boolean) as {
      id: number;
      stats: readonly [bigint, `0x${string}`, number, bigint, `0x${string}`];
      targetContract: `0x${string}`;
      state: number;
      participantCount: bigint;
    }[];

  useEffect(() => {
    if (closingChannels.length === 1 && !selectedChannelId) {
      setSelectedChannelId(closingChannels[0].id);
    }
  }, [closingChannels, selectedChannelId]);

  const effectiveSelectedId = selectedChannelId ?? (closingChannels.length === 1 ? closingChannels[0].id : null);
  const selectedChannel = effectiveSelectedId !== null ? closingChannels.find(ch => ch.id === effectiveSelectedId) : null;

  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: selectedChannel ? [BigInt(selectedChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!selectedChannel
  });

  const { data: channelTreeSize } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelTreeSize',
    args: selectedChannel ? [BigInt(selectedChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!selectedChannel
  });

  const { data: channelTargetContract } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelTargetContract',
    args: selectedChannel ? [BigInt(selectedChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!selectedChannel
  });

  const { data: finalStateRoot } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelFinalStateRoot',
    args: selectedChannel ? [BigInt(selectedChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!selectedChannel
  });

  const { data: isSignatureVerified } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'isSignatureVerified',
    args: selectedChannel ? [BigInt(selectedChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!selectedChannel
  });

  const { data: preAllocatedCount } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getPreAllocatedLeavesCount',
    args: channelTargetContract ? [channelTargetContract] : undefined,
    enabled: isMounted && isConnected && !!channelTargetContract
  });

  const { data: preAllocatedKeys } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getPreAllocatedKeys',
    args: channelTargetContract ? [channelTargetContract] : undefined,
    enabled: isMounted && isConnected && !!channelTargetContract
  });

  const { data: totalDeposits } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelTotalDeposits',
    args: selectedChannel ? [BigInt(selectedChannel.id)] : undefined,
    enabled: isMounted && isConnected && !!selectedChannel
  });

  const finalBalancesArray = useMemo(() => {
    if (!channelParticipants || !finalBalances) return [];
    return (channelParticipants as string[]).map((participant: string) => {
      const balance = finalBalances[participant.toLowerCase()] || finalBalances[participant] || '0';
      return BigInt(balance);
    });
  }, [channelParticipants, finalBalances]);

  const { write: verifyFinalBalances, data: verifyData } = useContractWrite({
    address: ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
    abi: ROLLUP_BRIDGE_PROOF_MANAGER_ABI,
    functionName: 'verifyFinalBalancesGroth16',
  });

  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: verifyData?.hash,
  });

  useEffect(() => {
    if (isSuccess) {
      setShowSuccessPopup(true);
      setIsGeneratingProof(false);
      setProofGenerationStatus('');
    }
  }, [isSuccess]);

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

  const getChannelStateColor = (state: number) => {
    switch (state) {
      case 0: return 'text-gray-500';
      case 1: return 'text-blue-400';
      case 2: return 'text-green-400';
      case 3: return 'text-green-400';
      case 4: return 'text-yellow-400';
      case 5: return 'text-red-400';
      default: return 'text-gray-500';
    }
  };

  const handleBalancesFileUpload = async (file: File) => {
    try {
      setBalancesError('');
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      if (typeof jsonData !== 'object' || jsonData === null) {
        throw new Error('Invalid JSON format');
      }
      
      const balances: FinalBalances = {};
      for (const [participant, balance] of Object.entries(jsonData)) {
        if (participant.startsWith('_')) continue;
        if (typeof balance !== 'string') {
          throw new Error(`Invalid balance for participant ${participant}`);
        }
        balances[participant.toLowerCase()] = balance;
      }
      
      setFinalBalances(balances);
      setBalancesFile(file);
    } catch (error) {
      console.error('Error parsing balances file:', error);
      setBalancesError(error instanceof Error ? error.message : 'Invalid file format');
    }
  };

  const generateGroth16Proof = async () => {
    if (!selectedChannel || !channelParticipants || !channelTreeSize || !finalStateRoot || !channelTargetContract) {
      throw new Error('Missing channel data');
    }

    setProofGenerationStatus('Collecting channel data...');
    
    const participantCount = (channelParticipants as string[]).length;
    const treeSize = Number(channelTreeSize);
    const preAllocCount = preAllocatedCount ? Number(preAllocatedCount) : 0;
    
    if (![16, 32, 64, 128].includes(treeSize)) {
      throw new Error(`Unsupported tree size: ${treeSize}`);
    }
    
    setProofGenerationStatus(`Collecting data for ${treeSize}-leaf merkle tree (${preAllocCount} pre-allocated + ${participantCount} participants)...`);
    
    const storageKeysL2MPT: string[] = [];
    const storageValues: string[] = [];
    
    if (preAllocCount > 0 && preAllocatedKeys) {
      setProofGenerationStatus(`Fetching ${preAllocCount} pre-allocated leaves...`);
      
      for (let i = 0; i < (preAllocatedKeys as `0x${string}`[]).length; i++) {
        const key = (preAllocatedKeys as `0x${string}`[])[i];
        
        try {
          const response = await fetch(`/api/get-pre-allocated-leaf?targetContract=${channelTargetContract}&mptKey=${key}`);
          if (response.ok) {
            const result = await response.json();
            if (result.exists) {
              storageKeysL2MPT.push(BigInt(key).toString());
              storageValues.push(result.value);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch pre-allocated leaf for key ${key}:`, error);
          throw new Error(`Failed to fetch pre-allocated leaf for key ${key}`);
        }
      }
    }
    
    setProofGenerationStatus(`Processing ${participantCount} participants...`);
    
    for (let i = 0; i < (channelParticipants as string[]).length && storageKeysL2MPT.length < treeSize; i++) {
      const participant = (channelParticipants as string[])[i];
      
      setProofGenerationStatus(`Fetching L2 MPT key for participant ${i + 1}...`);
      
      let l2MptKey = '0';
      try {
        const keyResponse = await fetch(`/api/get-l2-mpt-key?participant=${participant}&channelId=${selectedChannel.id}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (keyResponse.ok) {
          const keyResult = await keyResponse.json();
          l2MptKey = keyResult.key || '0';
        }
      } catch (error) {
        console.error(`Failed to fetch L2 MPT key for ${participant}:`, error);
      }
      
      const finalBalance = finalBalances[participant.toLowerCase()] || finalBalances[participant] || '0';
      
      storageKeysL2MPT.push(l2MptKey);
      storageValues.push(finalBalance);
    }
    
    while (storageKeysL2MPT.length < treeSize) {
      storageKeysL2MPT.push('0');
      storageValues.push('0');
    }
    
    setProofGenerationStatus('Preparing circuit input...');
    
    const circuitInput = {
      storage_keys_L2MPT: storageKeysL2MPT,
      storage_values: storageValues,
      treeSize: treeSize
    };
    
    console.log('Circuit Input for Final Balances:', circuitInput);
    console.log('Final State Root:', finalStateRoot);
    
    const memoryReq = getMemoryRequirement(treeSize);
    const needsDownload = requiresExternalDownload(treeSize);
    const downloadInfo = needsDownload ? ` + ${getDownloadSize(treeSize)} download` : '';
    setProofGenerationStatus(`Generating Groth16 proof for ${treeSize}-leaf tree (${memoryReq}${downloadInfo})...`);
    
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

  const handleUnfreezeState = async () => {
    if (!selectedChannel) return;
    
    setIsGeneratingProof(true);
    
    try {
      const proof = await generateGroth16Proof();
      setGeneratedProof(proof);
      
      setProofGenerationStatus('Submitting to blockchain...');
      
      verifyFinalBalances?.({
        args: [
          BigInt(selectedChannel.id),
          finalBalancesArray,
          proof
        ]
      });
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

  const isFormValid = () => {
    return Boolean(
      selectedChannel &&
      Object.keys(finalBalances).length > 0 &&
      isSignatureVerified &&
      selectedChannel.state === 4
    );
  };

  const handleDownloadTemplate = () => {
    const participants = channelParticipants as string[] || [];
    const template: any = {};
    
    participants.forEach(participant => {
      template[participant] = "0";
    });
    
    template["_template_info"] = {
      "description": "Final balances template for unfreeze state",
      "format": "{ participantAddress: balance }",
      "notes": [
        "Replace balance values with actual final balances in wei",
        "Total balances must equal total deposits for the channel",
        "Balances should be in wei (smallest unit) as decimal strings"
      ]
    };
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `final-balances-channel-${selectedChannel?.id || 'template'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a1930] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#4fc3f7] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
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

      <div className="ml-0 lg:ml-72 transition-all duration-300 min-h-screen space-background flex flex-col">
        <main className="px-4 py-8 lg:px-8 flex-1">
          <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                <Unlock className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Unfreeze State</h1>
            </div>
            <p className="text-gray-300 ml-13">
              Verify final balances and close the channel
            </p>
          </div>

          {!isConnected ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Link className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-300 mb-6">Please connect your wallet to unfreeze channel state</p>
              <ConnectButton />
            </div>
          ) : isLoadingChannels ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-[#4fc3f7] animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Loading Channels...</h3>
              <p className="text-gray-300">Fetching your channel data from the blockchain</p>
            </div>
          ) : !hasChannels ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
              <p className="text-gray-300 mb-4">This page is only accessible to channel leaders</p>
            </div>
          ) : closingChannels.length === 0 ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Unlock className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Channels to Unfreeze</h3>
              <p className="text-gray-300 mb-4">You don't have any channels in "Closing" state</p>
              <p className="text-sm text-gray-400">Submit proofs first to move channels to Closing state</p>
            </div>
          ) : (
            <div className="space-y-6">
              {closingChannels.length > 1 && (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#4fc3f7]" />
                    Select Channel to Unfreeze
                  </h3>
                  <div className="grid gap-3">
                    {closingChannels.map((channel) => (
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
                              <p className="text-sm text-yellow-400">{getChannelStateName(channel.state)}</p>
                            </div>
                          </div>
                          {selectedChannelId === channel.id && (
                            <CheckCircle2 className="w-6 h-6 text-[#4fc3f7]" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedChannel && (
                <>
                  <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#4fc3f7]" />
                      Channel {selectedChannel.id} - Ready to Close
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                        <div className="text-sm text-gray-400">Status</div>
                        <div className={`text-xl font-bold ${getChannelStateColor(selectedChannel.state)}`}>
                          {getChannelStateName(selectedChannel.state)}
                        </div>
                      </div>
                      <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                        <div className="text-sm text-gray-400">Participants</div>
                        <div className="text-xl font-bold text-white">{channelParticipants?.length || 0}</div>
                      </div>
                      <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                        <div className="text-sm text-gray-400">Tree Size</div>
                        <div className="text-xl font-bold text-white">{channelTreeSize ? Number(channelTreeSize) : '...'}</div>
                      </div>
                      <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                        <div className="text-sm text-gray-400">Signature</div>
                        <div className={`text-xl font-bold ${isSignatureVerified ? 'text-green-400' : 'text-red-400'}`}>
                          {isSignatureVerified ? 'Verified' : 'Not Verified'}
                        </div>
                      </div>
                    </div>
                    
                    {totalDeposits && (
                      <div className="mt-4 p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50">
                        <div className="text-sm text-gray-400">Total Deposits (must match final balances sum)</div>
                        <div className="text-xl font-bold text-[#4fc3f7]">{formatUnits(totalDeposits as bigint, 18)} tokens</div>
                      </div>
                    )}
                    
                    {!isSignatureVerified && (
                      <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30">
                        <p className="text-red-400 text-sm">
                          ⚠️ Signature must be verified before unfreezing. Submit proofs first.
                        </p>
                      </div>
                    )}
                  </div>

                  {isSignatureVerified && (
                    <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                      <div className="p-6 border-b border-[#4fc3f7]/30">
                        <h3 className="text-xl font-semibold text-white mb-2">Final Balances</h3>
                        <p className="text-gray-400">Upload the final balances JSON file</p>
                      </div>
                      
                      <div className="p-6 space-y-6">
                        <div className="text-center mb-6">
                          <button
                            onClick={handleDownloadTemplate}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-[#4fc3f7] hover:bg-[#4fc3f7]/20 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            Download Template
                          </button>
                        </div>

                        <div className="max-w-2xl mx-auto">
                          {!balancesFile ? (
                            <div className="border-2 border-dashed border-gray-600 p-8 text-center hover:border-[#4fc3f7] transition-colors">
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
                                <Upload className="mx-auto h-16 w-16 mb-4 text-gray-400" />
                                <p className="text-lg font-medium text-white mb-2">Click to upload final balances</p>
                                <p className="text-sm text-gray-400">Upload JSON file with final balances for all participants</p>
                              </label>
                            </div>
                          ) : (
                            <div className="bg-green-900/20 border border-green-700 p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <CheckCircle2 className="h-12 w-12 text-green-400" />
                                  <div>
                                    <h3 className="text-lg font-semibold text-green-200">{balancesFile.name}</h3>
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
                              
                              <div className="text-sm text-gray-300">
                                <p>Participants with balances: {Object.keys(finalBalances).length}</p>
                              </div>
                            </div>
                          )}
                          {balancesError && (
                            <div className="mt-4 p-4 bg-red-900/20 border border-red-700">
                              <p className="text-red-400 text-sm">{balancesError}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {isFormValid() && (
                    <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                      <div className="p-6">
                        {(isGeneratingProof || proofGenerationStatus) && (
                          <div className="mb-4 p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-center">
                            <div className="flex items-center gap-3 justify-center mb-2">
                              <Calculator className={`w-5 h-5 text-[#4fc3f7] ${isGeneratingProof ? 'animate-pulse' : ''}`} />
                              <span className="text-[#4fc3f7] font-medium">
                                {isGeneratingProof ? 'Generating Proof' : 'Proof Status'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300">{proofGenerationStatus}</p>
                          </div>
                        )}

                        {browserCompatible === false && (
                          <div className="mb-4 p-3 bg-red-500/20 border border-red-400/50">
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              <span className="font-medium">Browser Not Compatible</span>
                            </div>
                          </div>
                        )}

                        {isSuccess && (
                          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-green-300">
                              <strong className="block mb-1">Success!</strong>
                              Channel closed! Participants can now withdraw.
                            </div>
                          </div>
                        )}
                        
                        <button
                          onClick={handleUnfreezeState}
                          disabled={!isFormValid() || isGeneratingProof || isTransactionLoading || browserCompatible === false}
                          className={`w-full px-8 py-4 font-semibold text-lg transition-all ${
                            isFormValid() && !isGeneratingProof && !isTransactionLoading && browserCompatible !== false
                              ? 'bg-[#4fc3f7] hover:bg-[#029bee] text-white shadow-lg shadow-[#4fc3f7]/30'
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
                              <span>Generate Proof & Close Channel</span>
                            </div>
                          )}
                        </button>
                        
                        <div className="mt-4 p-3 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-center">
                          <div className="text-sm text-gray-300">Proof Generation Details:</div>
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            <div>
                              <span className="text-gray-400">Tree Size:</span>
                              <div className="text-[#4fc3f7] font-medium">{channelTreeSize ? Number(channelTreeSize) : 'Auto'} leaves</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Pre-allocated:</span>
                              <div className="text-[#4fc3f7] font-medium">{preAllocatedCount ? Number(preAllocatedCount) : 0} leaves</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          </div>
        </main>

        <Footer className="mt-auto" />
      </div>

      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 max-w-md w-full mx-4 shadow-lg shadow-[#4fc3f7]/20">
            <div className="text-center">
              <div className="h-16 w-16 bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Channel Successfully Closed!</h3>
              <p className="text-gray-300 mb-4">
                Final balances verified. Participants can now withdraw their tokens.
              </p>
              <p className="text-sm text-[#4fc3f7] mb-6">Channel {selectedChannel?.id} is ready for withdrawals!</p>
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
