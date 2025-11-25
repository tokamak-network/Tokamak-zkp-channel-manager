'use client';

import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { Footer } from '@/components/Footer';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS, ROLLUP_BRIDGE_PROOF_MANAGER_ABI, ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import { FileText, Link, ShieldOff, CheckCircle2, Clock, AlertCircle, Download } from 'lucide-react';

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
  finalBalances: bigint[][];
}

interface Signature {
  message: `0x${string}`;
  rx: bigint;
  ry: bigint;
  z: bigint;
}

export default function SubmitProofPage() {
  const { isConnected, hasAccess, isMounted, leaderChannel } = useLeaderAccess();
  const { address } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Form state
  const [proofData, setProofData] = useState<ProofData>({
    proofPart1: [],
    proofPart2: [],
    publicInputs: [],
    smax: BigInt(0),
    functions: [],
    finalBalances: []
  });
  
  const [signature, setSignature] = useState<Signature>({
    message: '0x0000000000000000000000000000000000000000000000000000000000000000',
    rx: BigInt(0),
    ry: BigInt(0),
    z: BigInt(0)
  });
  
  const [uploadedProofFile, setUploadedProofFile] = useState<File | null>(null);
  const [uploadedSignatureFile, setUploadedSignatureFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [proofError, setProofError] = useState('');
  const [signatureError, setSignatureError] = useState('');
  
  // Channel information from core contract
  const { data: channelInfo } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelInfo',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });

  const { data: allowedTokens } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelAllowedTokens',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
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
    args: leaderChannel && isFormValid() ? [
      BigInt(leaderChannel.id),
      proofData,
      signature
    ] : undefined,
    enabled: Boolean(leaderChannel && isFormValid())
  });
  
  const { data, write } = useContractWrite(config);
  
  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });
  
  // File upload handlers
  const handleProofFileUpload = async (file: File) => {
    try {
      setProofError('');
      
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Validate required proof fields
      const requiredFields = ['proofPart1', 'proofPart2', 'publicInputs', 'smax', 'functions', 'finalBalances'];
      const missingFields = requiredFields.filter(field => !jsonData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required proof fields: ${missingFields.join(', ')}`);
      }
      
      // Validate function count (1-5 maximum)
      if (!Array.isArray(jsonData.functions) || jsonData.functions.length === 0) {
        throw new Error('Must provide at least 1 function proof');
      }
      
      if (jsonData.functions.length > 5) {
        throw new Error('Cannot provide more than 5 function proofs');
      }
      
      // Validate each function structure
      jsonData.functions.forEach((func: any, index: number) => {
        if (!func.functionSignature || !func.preprocessedPart1 || !func.preprocessedPart2) {
          throw new Error(`Function ${index + 1} missing required fields: functionSignature, preprocessedPart1, or preprocessedPart2`);
        }
        if (!Array.isArray(func.preprocessedPart1) || !Array.isArray(func.preprocessedPart2)) {
          throw new Error(`Function ${index + 1} preprocessed parts must be arrays`);
        }
      });
      
      // Convert and validate proof data
      const newProofData: ProofData = {
        proofPart1: jsonData.proofPart1.map((x: any) => BigInt(x)),
        proofPart2: jsonData.proofPart2.map((x: any) => BigInt(x)),
        publicInputs: jsonData.publicInputs.map((x: any) => BigInt(x)),
        smax: BigInt(jsonData.smax),
        functions: jsonData.functions.map((func: any) => ({
          functionSignature: func.functionSignature as `0x${string}`,
          preprocessedPart1: func.preprocessedPart1.map((x: any) => BigInt(x)),
          preprocessedPart2: func.preprocessedPart2.map((x: any) => BigInt(x))
        })),
        finalBalances: jsonData.finalBalances.map((participantBalances: any[]) => 
          participantBalances.map((balance: any) => BigInt(balance))
        )
      };
      
      setProofData(newProofData);
      setUploadedProofFile(file);
      
    } catch (error) {
      console.error('Error parsing proof file:', error);
      setProofError(error instanceof Error ? error.message : 'Invalid proof file format');
    }
  };
  
  const handleSignatureFileUpload = async (file: File) => {
    try {
      setSignatureError('');
      
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Validate required signature fields
      const requiredFields = ['message', 'rx', 'ry', 'z'];
      const missingFields = requiredFields.filter(field => !jsonData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required signature fields: ${missingFields.join(', ')}`);
      }
      
      // Convert signature data
      const newSignature: Signature = {
        message: jsonData.message as `0x${string}`,
        rx: BigInt(jsonData.rx),
        ry: BigInt(jsonData.ry),
        z: BigInt(jsonData.z)
      };
      
      setSignature(newSignature);
      setUploadedSignatureFile(file);
      
    } catch (error) {
      console.error('Error parsing signature file:', error);
      setSignatureError(error instanceof Error ? error.message : 'Invalid signature file format');
    }
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
        },
        {
          functionSignature: "0xb5bd20250df117ee1576cde77471907f0792dabd126e96e46ea0b2c71299ea2f",
          preprocessedPart1: ["0x2346e4364cc024d1bb70d584096fae3d"],
          preprocessedPart2: ["0xe217961dd8cac07bc427c136bc12f424521b3e3aaab440fdcdd66a902e22c0b5"]
        }
      ],
      finalBalances: [
        ["1000000000000000000", "2000000000000000000"], // Participant 1 balances for each token
        ["1500000000000000000", "1800000000000000000"]  // Participant 2 balances for each token
      ],
      _template_info: {
        description: "Template for multi-proof data submission",
        notes: [
          "Replace all placeholder values with your actual proof data",
          "MULTIPLE PROOFS: You can include 1-5 function proofs in the functions array",
          "proofPart1/proofPart2: Combined ZK proof components for all functions (as hex strings)",
          "publicInputs: Combined public signals for all proofs",
          "smax: Maximum S value from proof generation",
          "functions: Array of 1-5 registered functions used in the proofs",
          "finalBalances: 2D array - finalBalances[participantIndex][tokenIndex]",
          "Each function entry contains its signature and preprocessed proof parts",
          "All numeric values should be provided as strings to avoid precision loss",
          "Contract validates each function proof and enforces balance conservation"
        ]
      }
    };
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi-proof-template-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleDownloadSignatureTemplate = () => {
    const template = {
      message: "0x0000000000000000000000000000000000000000000000000000000000000000",
      rx: "0",
      ry: "0", 
      z: "0",
      _template_info: {
        description: "Template for group threshold signature submission",
        notes: [
          "Replace all placeholder values with your actual signature data",
          "message: 32-byte message hash as hex string (0x...)",
          "rx: Signature R point x coordinate as decimal string",
          "ry: Signature R point y coordinate as decimal string", 
          "z: Schnorr signature scalar as decimal string",
          "All numeric values should be provided as decimal strings"
        ]
      }
    };
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signature-template-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Form validation
  function isFormValid(): boolean {
    return Boolean(
      uploadedProofFile &&
      uploadedSignatureFile &&
      proofData.proofPart1.length > 0 &&
      proofData.proofPart2.length > 0 &&
      proofData.functions.length > 0 &&
      proofData.finalBalances.length > 0 &&
      signature.message !== '0x0000000000000000000000000000000000000000000000000000000000000000'
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
  
  const canSubmit = isConnected && hasAccess && leaderChannel && isFormValid() && isChannelStateValid && !isLoading && !isTransactionLoading;

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
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Submit Multi-Proof & Signature</h1>
            </div>
            <p className="text-gray-300 ml-13">
              Submit 1-5 ZK function proofs and group threshold signature to finalize the channel
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
          ) : !hasAccess ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <ShieldOff className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
              <p className="text-gray-300">
                Only channel leaders can submit proofs and signatures
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Channel Overview */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Channel Information</h2>
                    <p className="text-gray-300 mt-1">
                      Review your channel status before submitting proof
                    </p>
                  </div>
                </div>
                
                {leaderChannel && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4">
                      <div className="text-sm text-gray-400">Channel ID</div>
                      <div className="text-lg font-semibold text-white">#{leaderChannel.id}</div>
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
                      <div className="text-sm text-gray-400">Tokens</div>
                      <div className="text-lg font-semibold text-white">
                        {allowedTokens ? allowedTokens.length : '...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Proof Data Upload */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                <div className="p-6 border-b border-[#4fc3f7]/30">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Multi-Proof Data
                  </h3>
                  <p className="text-gray-400">
                    Upload JSON containing 1-5 ZK function proofs, balances, and verification data
                  </p>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="text-center mb-6">
                    <button
                      onClick={handleDownloadProofTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-[#4fc3f7] rounded-lg hover:bg-[#4fc3f7]/20 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download Multi-Proof Template
                    </button>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <label className="block text-sm font-medium text-white mb-4">
                      Proof Data File (JSON) *
                    </label>
                    {!uploadedProofFile ? (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-[#4fc3f7] transition-colors">
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
                            <p className="text-lg font-medium mb-2">Click to upload multi-proof file</p>
                            <p className="text-sm">Upload JSON containing 1-5 function proofs and final balances</p>
                          </div>
                        </label>
                      </div>
                    ) : (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-12 w-12 text-green-400" />
                            <div>
                              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">{uploadedProofFile.name}</h3>
                              <p className="text-sm text-green-400">Multi-proof data loaded successfully</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setUploadedProofFile(null);
                              setProofData({
                                proofPart1: [],
                                proofPart2: [],
                                publicInputs: [],
                                smax: BigInt(0),
                                functions: [],
                                finalBalances: []
                              });
                            }}
                            className="text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-400">Function Proofs</div>
                            <div className="font-semibold text-green-800 dark:text-green-200">{proofData.functions.length}/5</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-400">Participants</div>
                            <div className="font-semibold text-green-800 dark:text-green-200">{proofData.finalBalances.length}</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-400">Public Inputs</div>
                            <div className="font-semibold text-green-800 dark:text-green-200">{proofData.publicInputs.length}</div>
                          </div>
                        </div>
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

              {/* Signature Upload */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                <div className="p-6 border-b border-[#4fc3f7]/30">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Group Threshold Signature
                  </h3>
                  <p className="text-gray-400">
                    Upload the group threshold signature from your off-chain signing ceremony
                  </p>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="text-center mb-6">
                    <button
                      onClick={handleDownloadSignatureTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-[#4fc3f7] rounded-lg hover:bg-[#4fc3f7]/20 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download Signature Template
                    </button>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <label className="block text-sm font-medium text-white mb-4">
                      Signature File (JSON) *
                    </label>
                    {!uploadedSignatureFile ? (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-[#4fc3f7] transition-colors">
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSignatureFileUpload(file);
                          }}
                          className="hidden"
                          id="signature-file"
                        />
                        <label htmlFor="signature-file" className="cursor-pointer">
                          <div className="text-gray-500 dark:text-gray-400">
                            <FileText className="mx-auto h-16 w-16 mb-4" />
                            <p className="text-lg font-medium mb-2">Click to upload signature file</p>
                            <p className="text-sm">Upload a JSON file containing the group threshold signature</p>
                          </div>
                        </label>
                      </div>
                    ) : (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-12 w-12 text-green-400" />
                            <div>
                              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">{uploadedSignatureFile.name}</h3>
                              <p className="text-sm text-green-400">Signature loaded successfully</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setUploadedSignatureFile(null);
                              setSignature({
                                message: '0x0000000000000000000000000000000000000000000000000000000000000000',
                                rx: BigInt(0),
                                ry: BigInt(0),
                                z: BigInt(0)
                              });
                            }}
                            className="text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-400">Message</div>
                            <div className="font-semibold text-green-800 dark:text-green-200 truncate">{signature.message.slice(0, 10)}...</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-400">Signature Valid</div>
                            <div className="font-semibold text-green-800 dark:text-green-200">✓ Ready</div>
                          </div>
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
                        Please upload both proof data and signature files
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
                      'Submit Multi-Proof & Signature'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
        
        <Footer className="mt-auto" />
      </div>
    </div>
  );
}