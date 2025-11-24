'use client';

import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { Footer } from '@/components/Footer';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { getTokenSymbol, getTokenDecimals } from '@/lib/tokenUtils';
import { PenTool, Link, ShieldOff, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { ETH_TOKEN_ADDRESS } from '@/lib/contracts';

export default function SignProofPage() {
  const { isConnected, hasAccess, isMounted, leaderChannel } = useLeaderAccess();
  const { address } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Signature form state
  const [signatureData, setSignatureData] = useState({
    message: '',
    rx: '',
    ry: '',
    z: ''
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  
  // Channel information
  const { data: channelInfo } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelInfo',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  const { data: channelTimeoutInfo } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelTimeout',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  // Check if channel is ready to close based on state (signatures submitted)
  const isChannelReadyToClose = channelInfo ? Number(channelInfo[1]) === 2 : false; // State 2 = Closing/Ready to close

  // Get token information for the channel
  const tokenAddress = channelInfo?.[0] as `0x${string}` | undefined; // targetContract from getChannelInfo
  const participantCount = channelInfo?.[2] ? Number(channelInfo[2]) : 0;
  
  // TODO: debugTokenInfo function removed from new contract architecture
  // Using centralized token mapping functions
  const tokenSymbol = tokenAddress ? getTokenSymbol(tokenAddress) : 'TOKEN';
  const tokenDecimals = tokenAddress ? getTokenDecimals(tokenAddress) : 18;
  const isETH = tokenAddress === ETH_TOKEN_ADDRESS;
  
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
      0: 'text-gray-500 dark:text-gray-400',        // None
      1: 'text-[#4fc3f7]',        // Initialized  
      2: 'text-green-400',      // Open
      3: 'text-green-400',      // Active
      4: 'text-yellow-400',    // Closing
      5: 'text-red-400'           // Closed
    };
    return colors[stateNumber as keyof typeof colors] || 'text-gray-500 dark:text-gray-400';
  };
  
  // TODO: signAggregatedProof function not available in current contract ABI
  // Prepare the signAggregatedProof transaction
  const config = {
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'openChannel',
    enabled: false, // Disabled since signAggregatedProof not available
  } as const;
  const prepareError = new Error('signAggregatedProof function not available in current contract ABI');
  
  const { data, write } = useContractWrite(config);
  
  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });
  
  const handleInputChange = (field: string, value: string) => {
    setSignatureData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleFileUpload = async (file: File) => {
    try {
      setFileError('');
      
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Validate that all required signature fields are present
      const requiredFields = ['message', 'rx', 'ry', 'z'];
      
      const missingFields = requiredFields.filter(field => !jsonData[field]);
      if (missingFields.length > 0) {
        throw new Error(`Missing required signature fields: ${missingFields.join(', ')}`);
      }
      
      // Parse and validate all signature data
      const message = Array.isArray(jsonData.message) ? jsonData.message[0] : jsonData.message;
      const rx = Array.isArray(jsonData.rx) ? jsonData.rx[0] : jsonData.rx;
      const ry = Array.isArray(jsonData.ry) ? jsonData.ry[0] : jsonData.ry;
      const z = Array.isArray(jsonData.z) ? jsonData.z[0] : jsonData.z;
      
      // Update signature data
      setSignatureData({
        message: message.toString(),
        rx: rx.toString(),
        ry: ry.toString(),
        z: z.toString()
      });
      
      setUploadedFile(file);
      
    } catch (error) {
      console.error('Error parsing signature file:', error);
      setFileError(error instanceof Error ? error.message : 'Invalid file format');
    }
  };
  
  const removeFile = () => {
    setUploadedFile(null);
    setFileError('');
    
    // Reset all signature data
    setSignatureData({
      message: '',
      rx: '',
      ry: '',
      z: ''
    });
  };
  
  const handleDownloadSignatureTemplate = () => {
    const template = {
      message: "0x0000000000000000000000000000000000000000000000000000000000000000",
      rx: "0",
      ry: "0", 
      z: "0",
      _template_info: {
        description: "Template for aggregated proof signature submission",
        notes: [
          "Replace all placeholder values with your actual signature data",
          "message: 32-byte message hash as hex string (0x...)",
          "rx: Signature R point x coordinate as decimal string or hex",
          "ry: Signature R point y coordinate as decimal string or hex", 
          "z: Schnorr signature scalar as decimal string or hex",
          "All numeric values can be provided as decimal strings or hex strings",
          "Remove this _template_info object before submission"
        ],
        generated_at: new Date().toISOString(),
        channel_id: leaderChannel?.id || "unknown"
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
    
    alert('Signature template downloaded! Replace placeholder values with your actual signature data.');
  };
  
  const handleSubmit = async () => {
    if (!signatureData.message || !signatureData.rx || !signatureData.ry || !signatureData.z) {
      alert('Please upload a valid signature JSON file first');
      return;
    }
    
    // Debug logging
    console.log('=== SIGNATURE DEBUG INFO ===');
    console.log('Channel ID:', leaderChannel?.id);
    console.log('Channel Info:', channelInfo);
    console.log('Channel State:', channelInfo ? Number(channelInfo[1]) : 'undefined');
    console.log('Channel State Name:', channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'undefined');
    console.log('Signature Data:', signatureData);
    console.log('Is Leader:', hasAccess);
    console.log('Connected Address:', address);
    console.log('=================');
    
    if (!write) {
      if (prepareError) {
        console.log('Prepare Error:', prepareError);
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
      console.error('Error signing proof:', error);
      alert('Error signing proof. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const isFormValid = uploadedFile &&
                      signatureData.message && 
                      signatureData.rx && 
                      signatureData.ry && 
                      signatureData.z;
  
  // Check if channel is in correct state for signature submission (Closing=4)
  const isChannelStateValid = channelInfo && Number(channelInfo[1]) === 4;
  
  // Check if signature has already been submitted
  // If channel is in Closing state but isChannelReadyToClose is true, then sigVerified = true
  const isSignatureAlreadySubmitted = isChannelStateValid && isChannelReadyToClose;
  
  const canSubmit = isConnected && hasAccess && leaderChannel && isFormValid && isChannelStateValid && !isSignatureAlreadySubmitted && !isLoading && !isTransactionLoading;

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
                <PenTool className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Sign Aggregated Proof</h1>
            </div>
            <p className="text-gray-300 ml-13">
              Sign the aggregated proof to confirm channel finalization
            </p>
          </div>

          {!isConnected ? (
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
              <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                <Link className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-300 mb-6">
                Please connect your wallet to sign aggregated proofs
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
                Only channel leaders can sign aggregated proofs
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Channel Overview */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                    <PenTool className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Channel Information</h2>
                    <p className="text-gray-300 mt-1">
                      Submit your group threshold signature to finalize the channel closure
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
                      <div className={`text-lg font-semibold ${channelInfo ? getChannelStateColor(Number(channelInfo[1])) : 'text-gray-500 dark:text-gray-400'}`}>
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
                      <div className="text-sm text-gray-400">Ready to Close</div>
                      <div className={`text-lg font-semibold flex items-center gap-2 ${
                        isChannelReadyToClose ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {isChannelReadyToClose ? (
                          <><CheckCircle2 className="w-5 h-5" /> Yes</>
                        ) : (
                          <><Clock className="w-5 h-5" /> Not Yet</>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Signature Submission Form */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                <div className="p-6 border-b border-[#4fc3f7]/30">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Group Threshold Signature
                  </h3>
                  <p className="text-gray-400">
                    Submit the group threshold signature generated from your off-chain signing ceremony
                  </p>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Template Download Section */}
                  <div className="max-w-2xl mx-auto mb-6">
                    <div className="text-center">
                      <button
                        onClick={handleDownloadSignatureTemplate}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Signature Template
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Get a template JSON file with the correct signature structure
                      </p>
                    </div>
                  </div>

                  {/* File Upload Section */}
                  <div className="max-w-2xl mx-auto">
                    <label className="block text-sm font-medium text-white mb-4">
                      Signature Data File (JSON) *
                    </label>
                    {!uploadedFile ? (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-green-400 dark:hover:border-green-500 transition-colors">
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          className="hidden"
                          id="signature-file"
                        />
                        <label htmlFor="signature-file" className="cursor-pointer">
                          <div className="text-gray-500 dark:text-gray-400">
                            <svg className="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-lg font-medium mb-2">Click to upload signature file</p>
                            <p className="text-sm mb-4">Upload a JSON file containing your group threshold signature</p>
                            <div className="text-xs text-gray-400 space-y-1">
                              <p>Expected structure: message, rx, ry, z</p>
                              <p>Contains: Group threshold signature from signing ceremony</p>
                            </div>
                          </div>
                        </label>
                      </div>
                    ) : (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center">
                              <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">{uploadedFile.name}</h3>
                              <p className="text-sm text-green-400">Signature data loaded successfully</p>
                            </div>
                          </div>
                          <button
                            onClick={removeFile}
                            className="text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Signature Data Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-400">Message</div>
                            <div className="font-semibold text-green-800 dark:text-green-200 truncate">{signatureData.message.slice(0, 20)}...</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-400">R Point (rx, ry)</div>
                            <div className="font-semibold text-green-800 dark:text-green-200 truncate">
                              ({signatureData.rx.slice(0, 8)}..., {signatureData.ry.slice(0, 8)}...)
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 col-span-1 md:col-span-2">
                            <div className="text-gray-400">Signature Scalar (z)</div>
                            <div className="font-semibold text-green-800 dark:text-green-200 truncate">{signatureData.z.slice(0, 20)}...</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {fileError && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                        <p className="text-red-400 text-sm">{fileError}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Submit Button */}
                  <div className="pt-6 border-t border-[#4fc3f7]/30">
                    {/* Status Messages */}
                    {!isFormValid && (
                      <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-300">
                          <strong className="block mb-1">Missing Required Data</strong>
                          Please upload the signature JSON file containing all required parameters
                        </div>
                      </div>
                    )}
                    
                    {isFormValid && !isChannelStateValid && channelInfo && (
                      <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                        <ShieldOff className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-red-300">
                          <strong className="block mb-1">Invalid Channel State</strong>
                          Channel must be in "Closing" state to sign proofs. Current state: {getChannelStateDisplay(Number(channelInfo[1]))}
                        </div>
                      </div>
                    )}
                    
                    {isFormValid && isChannelStateValid && isSignatureAlreadySubmitted && (
                      <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-300">
                          <strong className="block mb-1">Already Signed</strong>
                          Signature already submitted! Channel is ready to close.
                        </div>
                      </div>
                    )}
                    
                    {isSuccess && (
                      <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-300">
                          <strong className="block mb-1">Success!</strong>
                          Proof signed successfully!
                        </div>
                      </div>
                    )}
                    
                    {/* Submit Button - Full Width */}
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className={`w-full px-8 py-4 font-semibold text-lg transition-all ${
                        canSubmit
                          ? 'bg-[#4fc3f7] hover:bg-[#029bee] text-white shadow-lg shadow-[#4fc3f7]/30 hover:shadow-xl hover:shadow-[#4fc3f7]/50'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isLoading || isTransactionLoading ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Signing Proof...</span>
                        </div>
                      ) : (
                        'Sign Aggregated Proof'
                      )}
                    </button>
                  </div>
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