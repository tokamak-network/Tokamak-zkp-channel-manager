'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { keccak256, encodePacked } from 'viem';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { Footer } from '@/components/Footer';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS, ROLLUP_BRIDGE_PROOF_MANAGER_ABI, ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import { FileText, Link, ShieldOff, CheckCircle2, Clock, AlertCircle, Download, Hash } from 'lucide-react';

interface ProofData {
  proofPart1: bigint[];
  proofPart2: bigint[];
  publicInputs: bigint[];
  smax: bigint;
  functions: {
    functionSignature: `0x${string}`;
    preprocessedPart1: bigint[];
    preprocessedPart2: bigint[];
  }[];
}

interface UploadedProof {
  id: string;
  file: File;
  data: ProofData;
}

interface SignatureInputs {
  rx: string;
  ry: string;
  z: string;
}

interface Signature {
  message: `0x${string}`;
  rx: bigint;
  ry: bigint;
  z: bigint;
}

export default function SubmitProofPage() {
  const { isConnected, isMounted } = useLeaderAccess();
  const { address } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Form state
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [uploadedProofs, setUploadedProofs] = useState<UploadedProof[]>([]);
  
  const [signatureInputs, setSignatureInputs] = useState<SignatureInputs>({
    rx: '',
    ry: '',
    z: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [proofError, setProofError] = useState('');
  const [signatureError, setSignatureError] = useState('');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  
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

  const { data: targetContract } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelTargetContract',
    args: selectedChannelId ? [BigInt(selectedChannelId)] : undefined,
    enabled: Boolean(selectedChannelId)
  });
  
  // Compute final state root from the last proof's publicInputs[0]
  const finalStateRoot = useMemo(() => {
    if (uploadedProofs.length === 0) return null;
    const lastProof = uploadedProofs[uploadedProofs.length - 1];
    if (lastProof.data.publicInputs.length === 0) return null;
    
    // Extract finalStateRoot from the first slot of the last proof's publicInputs
    return `0x${lastProof.data.publicInputs[0].toString(16).padStart(64, '0')}` as `0x${string}`;
  }, [uploadedProofs]);
  
  // Compute message hash for signature: keccak256(abi.encodePacked(channelId, finalStateRoot))
  const computedMessageHash = useMemo(() => {
    if (!selectedChannelId || !finalStateRoot) return null;
    
    try {
      return keccak256(encodePacked(
        ['uint256', 'bytes32'],
        [BigInt(selectedChannelId), finalStateRoot]
      ));
    } catch (error) {
      console.error('Error computing message hash:', error);
      return null;
    }
  }, [selectedChannelId, finalStateRoot]);
  
  // Build signature object for contract call
  const signature = useMemo<Signature | null>(() => {
    if (!computedMessageHash || !signatureInputs.rx || !signatureInputs.ry || !signatureInputs.z) {
      return null;
    }
    
    try {
      return {
        message: computedMessageHash,
        rx: BigInt(signatureInputs.rx),
        ry: BigInt(signatureInputs.ry),
        z: BigInt(signatureInputs.z)
      };
    } catch (error) {
      console.error('Error parsing signature inputs:', error);
      return null;
    }
  }, [computedMessageHash, signatureInputs]);
  
  // Helper function to get channel state display name
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

  // Get channel state colors
  const getChannelStateColor = (stateNumber: number) => {
    const colors = {
      0: 'text-gray-500 dark:text-gray-400',
      1: 'text-[#4fc3f7]',
      2: 'text-green-400',
      3: 'text-green-400',
      4: 'text-yellow-400',
      5: 'text-red-400'
    };
    return colors[stateNumber as keyof typeof colors] || 'text-gray-500 dark:text-gray-400';
  };
  
  // Contract write preparation for submitProofAndSignature
  const { config, error: prepareError } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
    abi: ROLLUP_BRIDGE_PROOF_MANAGER_ABI,
    functionName: 'submitProofAndSignature',
    args: selectedChannelId && signature && isFormValid() ? [
      BigInt(selectedChannelId),
      uploadedProofs.map(p => p.data),
      signature
    ] : undefined,
    enabled: Boolean(selectedChannelId && signature && isFormValid())
  });
  
  const { data, write } = useContractWrite(config);
  
  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });
  
  // File upload handlers
  const handleProofFileUpload = async (file: File) => {
    try {
      setProofError('');
      
      // Check if we already have 5 proofs
      if (uploadedProofs.length >= 5) {
        setProofError('Maximum of 5 proofs allowed');
        return;
      }
      
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Validate required proof fields (removed finalBalances as it's not per-proof)
      const requiredFields = ['proofPart1', 'proofPart2', 'publicInputs', 'smax', 'functions'];
      const missingFields = requiredFields.filter(field => !jsonData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required proof fields: ${missingFields.join(', ')}`);
      }
      
      // Validate function structure (each proof should have exactly 1 function)
      if (!Array.isArray(jsonData.functions) || jsonData.functions.length !== 1) {
        throw new Error('Each proof must contain exactly one function');
      }
      
      // Validate function structure
      const func = jsonData.functions[0];
      if (!func.functionSignature || !func.preprocessedPart1 || !func.preprocessedPart2) {
        throw new Error('Function missing required fields: functionSignature, preprocessedPart1, or preprocessedPart2');
      }
      if (!Array.isArray(func.preprocessedPart1) || !Array.isArray(func.preprocessedPart2)) {
        throw new Error('Function preprocessed parts must be arrays');
      }
      
      // Convert and validate proof data
      const newProofData: ProofData = {
        proofPart1: jsonData.proofPart1.map((x: any) => BigInt(x)),
        proofPart2: jsonData.proofPart2.map((x: any) => BigInt(x)),
        publicInputs: jsonData.publicInputs.map((x: any) => BigInt(x)),
        smax: BigInt(jsonData.smax),
        functions: [{
          functionSignature: func.functionSignature as `0x${string}`,
          preprocessedPart1: func.preprocessedPart1.map((x: any) => BigInt(x)),
          preprocessedPart2: func.preprocessedPart2.map((x: any) => BigInt(x))
        }]
      };
      
      // Create new uploaded proof with unique ID
      const newUploadedProof: UploadedProof = {
        id: `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        data: newProofData
      };
      
      setUploadedProofs(prev => [...prev, newUploadedProof]);
      
    } catch (error) {
      console.error('Error parsing proof file:', error);
      setProofError(error instanceof Error ? error.message : 'Invalid proof file format');
    }
  };
  
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, proofId: string) => {
    setDraggedItemId(proofId);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    if (!draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null);
      return;
    }
    
    setUploadedProofs(prev => {
      const draggedIndex = prev.findIndex(p => p.id === draggedItemId);
      const targetIndex = prev.findIndex(p => p.id === targetId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const newProofs = [...prev];
      const [draggedItem] = newProofs.splice(draggedIndex, 1);
      newProofs.splice(targetIndex, 0, draggedItem);
      
      return newProofs;
    });
    
    setDraggedItemId(null);
  };
  
  const removeProof = (proofId: string) => {
    setUploadedProofs(prev => prev.filter(p => p.id !== proofId));
  };
  
  // Template download handlers
  const handleDownloadProofTemplate = () => {
    const template = {
      proofPart1: ["0x1236d4364cc024d1bb70d584096fae2c", "0x14caedc95bee5309da79cfe59aa67ba3"],
      proofPart2: ["0xd107861dd8cac07bc427c136bc12f424521b3e3aaab440fdcdd66a902e22c0a4"],
      publicInputs: ["0x00000000000000000000000000000000d9bb52200d942752f44a41d658ee82de"],
      smax: "512",
      functions: [
        {
          functionSignature: "0xa5bd20250df117ee1576cde77471907f0792dabd126e96e46ea0b2c71299ea1e",
          preprocessedPart1: ["0x1236d4364cc024d1bb70d584096fae2c"],
          preprocessedPart2: ["0xd107861dd8cac07bc427c136bc12f424521b3e3aaab440fdcdd66a902e22c0a4"]
        }
      ],
      _template_info: {
        description: "Template for individual proof data submission",
        notes: [
          "Replace all placeholder values with your actual proof data",
          "IMPORTANT: Each file should contain exactly ONE proof",
          "Upload separate files for each proof (max 5 total)",
          "Drag and drop to reorder proofs - order matters!",
          "proofPart1/proofPart2: ZK proof components for this function (as hex strings)",
          "publicInputs: Public signals for this specific proof",
          "smax: Maximum S value from proof generation",
          "functions: Array with exactly 1 function for this proof",
          "Each function entry contains its signature and preprocessed proof parts",
          "All numeric values should be provided as strings to avoid precision loss"
        ]
      }
    };
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `single-proof-template-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  
  // Form validation
  function isFormValid(): boolean {
    return Boolean(
      selectedChannelId &&
      uploadedProofs.length > 0 &&
      uploadedProofs.length <= 5 &&
      signatureInputs.rx &&
      signatureInputs.ry &&
      signatureInputs.z &&
      computedMessageHash &&
      signature
    );
  }
  
  // Submit handler
  const handleSubmit = async () => {
    if (!write) {
      if (prepareError) {
        console.error('Prepare Error:', prepareError);
        alert(`Contract error: ${prepareError.message || 'Transaction preparation failed'}`);
      } else {
        alert('Transaction not ready. Please ensure you have the correct wallet permissions and the channel is in the correct state.');
      }
      return;
    }
    
    try {
      setIsLoading(true);
      write();
    } catch (error) {
      console.error('Error submitting proof:', error);
      alert('Error submitting proof. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check if channel is in correct state for proof submission (Open=2 or Active=3)
  const isChannelStateValid = channelInfo && (Number(channelInfo[1]) === 2 || Number(channelInfo[1]) === 3);
  
  const canSubmit = isConnected && selectedChannelId && isFormValid() && isChannelStateValid && !isLoading && !isTransactionLoading;

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

      <div className="ml-0 lg:ml-72 transition-all duration-300 min-h-screen space-background">
        <main className="px-4 py-8 lg:px-8">
          <div className="max-w-5xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Submit Ordered Proofs & Signature</h1>
            </div>
            <p className="text-gray-300 ml-13">
              Upload individual proof files (max 5), arrange in order, and submit with group signature
            </p>
          </div>

          {!isConnected ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Link className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-300 mb-6">
                Please connect your wallet to submit proofs
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
                      Select the channel you want to submit proofs for
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
              {selectedChannelId && (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Channel Information</h2>
                      <p className="text-gray-300 mt-1">
                        Review channel status before submitting proofs
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
                      <div className={`text-lg font-semibold ${channelInfo ? getChannelStateColor(Number(channelInfo[1])) : 'text-gray-400'}`}>
                        {channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'Loading...'}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Participants</div>
                      <div className="text-lg font-semibold text-white">
                        {channelParticipants ? channelParticipants.length : '...'}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Target Contract</div>
                      <div className="text-lg font-semibold text-white font-mono">
                        {targetContract ? `${targetContract.substring(0, 8)}...${targetContract.substring(36)}` : '...'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Proof Data Upload */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                <div className="p-6 border-b border-[#4fc3f7]/30">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Individual Proof Files
                  </h3>
                  <p className="text-gray-400">
                    Upload separate JSON files for each proof (max 5). Drag to reorder - order matters!
                  </p>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="text-center mb-6">
                    <button
                      onClick={handleDownloadProofTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-[#4fc3f7] rounded-lg hover:bg-[#4fc3f7]/20 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download Single Proof Template
                    </button>
                  </div>

                  {/* Upload area */}
                  <div className="max-w-2xl mx-auto">
                    <label className="block text-sm font-medium text-white mb-4">
                      Add Proof File (JSON) - {uploadedProofs.length}/5
                    </label>
                    
                    {uploadedProofs.length < 5 && (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-[#4fc3f7] transition-colors mb-6">
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleProofFileUpload(file);
                          }}
                          className="hidden"
                          id="proof-file"
                        />
                        <label htmlFor="proof-file" className="cursor-pointer">
                          <div className="text-gray-500 dark:text-gray-400">
                            <FileText className="mx-auto h-16 w-16 mb-4" />
                            <p className="text-lg font-medium mb-2">Click to upload proof file</p>
                            <p className="text-sm">Upload JSON containing exactly one function proof</p>
                          </div>
                        </label>
                      </div>
                    )}
                    
                    {/* Uploaded proofs list with drag and drop */}
                    {uploadedProofs.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-sm text-white font-medium">
                          Uploaded Proofs (drag to reorder):
                        </div>
                        {uploadedProofs.map((proof, index) => (
                          <div
                            key={proof.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, proof.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, proof.id)}
                            className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 cursor-move hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors ${
                              draggedItemId === proof.id ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="bg-[#4fc3f7] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                                    {index + 1}
                                  </span>
                                  <div className="text-sm">
                                    <div className="font-semibold text-green-800 dark:text-green-200">
                                      {proof.file.name}
                                    </div>
                                    <div className="text-green-600 dark:text-green-400 text-xs">
                                      Function: {proof.data.functions[0].functionSignature.slice(0, 10)}...
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-gray-400 text-xs">≡</div>
                                <button
                                  onClick={() => removeProof(proof.id)}
                                  className="text-red-400 hover:text-red-600 p-1"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {proofError && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                        <p className="text-red-400 text-sm">{proofError}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Signature Input */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                <div className="p-6 border-b border-[#4fc3f7]/30">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Group Threshold Signature
                  </h3>
                  <p className="text-gray-400">
                    Enter the signature components (rx, ry, z) from your off-chain signing ceremony
                  </p>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Message Hash Display */}
                  {computedMessageHash && finalStateRoot && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 mb-6">
                      <div className="flex items-start gap-3">
                        <Hash className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                            Computed Message Hash
                          </div>
                          <div className="text-xs font-mono text-blue-600 dark:text-blue-300 break-all bg-white dark:bg-blue-900/30 p-2 rounded border">
                            {computedMessageHash}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            keccak256(abi.encodePacked(channelId: {selectedChannelId}, finalStateRoot: {finalStateRoot}))
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="max-w-2xl mx-auto space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Signature Component rx *
                      </label>
                      <input
                        type="text"
                        value={signatureInputs.rx}
                        onChange={(e) => {
                          setSignatureInputs(prev => ({ ...prev, rx: e.target.value }));
                          setSignatureError('');
                        }}
                        placeholder="Enter rx value (decimal)"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#4fc3f7] focus:ring-1 focus:ring-[#4fc3f7]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Signature Component ry *
                      </label>
                      <input
                        type="text"
                        value={signatureInputs.ry}
                        onChange={(e) => {
                          setSignatureInputs(prev => ({ ...prev, ry: e.target.value }));
                          setSignatureError('');
                        }}
                        placeholder="Enter ry value (decimal)"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#4fc3f7] focus:ring-1 focus:ring-[#4fc3f7]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Signature Component z *
                      </label>
                      <input
                        type="text"
                        value={signatureInputs.z}
                        onChange={(e) => {
                          setSignatureInputs(prev => ({ ...prev, z: e.target.value }));
                          setSignatureError('');
                        }}
                        placeholder="Enter z value (decimal)"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#4fc3f7] focus:ring-1 focus:ring-[#4fc3f7]"
                      />
                    </div>

                    {signature && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">
                            Signature Ready
                          </span>
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          All signature components are valid and message hash computed successfully
                        </div>
                      </div>
                    )}

                    {signatureError && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                        <p className="text-red-400 text-sm">{signatureError}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Submit Section */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                <div className="p-6">
                  {/* Status Messages */}
                  {!isFormValid() && (
                    <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-300">
                        <strong className="block mb-1">Missing Required Data</strong>
                        {!selectedChannelId && "Please enter a channel ID"}
                        {selectedChannelId && uploadedProofs.length === 0 && "Please upload at least one proof file"}
                        {selectedChannelId && uploadedProofs.length > 0 && (!signatureInputs.rx || !signatureInputs.ry || !signatureInputs.z) && "Please enter all signature components (rx, ry, z)"}
                        {selectedChannelId && uploadedProofs.length > 0 && signatureInputs.rx && signatureInputs.ry && signatureInputs.z && !signature && "Invalid signature values - please check your inputs"}
                      </div>
                    </div>
                  )}
                  
                  {isFormValid() && !isChannelStateValid && channelInfo && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                      <ShieldOff className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-300">
                        <strong className="block mb-1">Invalid Channel State</strong>
                        Channel must be in "Open" or "Active" state. Current: {getChannelStateDisplay(Number(channelInfo[1]))}
                      </div>
                    </div>
                  )}
                  
                  {isSuccess && (
                    <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-green-300">
                        <strong className="block mb-1">Success!</strong>
                        Proof and signature submitted successfully! Channel is now in Closing state.
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
                      canSubmit
                        ? 'bg-[#4fc3f7] hover:bg-[#029bee] text-white shadow-lg shadow-[#4fc3f7]/30 hover:shadow-xl hover:shadow-[#4fc3f7]/50'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isLoading || isTransactionLoading ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting...</span>
                      </div>
                    ) : (
                      'Submit Ordered Proofs & Signature'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </main>
        
        <Footer className="mt-auto" />
      </div>
    </div>
  );
}