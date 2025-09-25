'use client';

import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { MobileNavigation } from '@/components/MobileNavigation';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
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
    functionName: 'getChannelTimeoutInfo',
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
  
  const { data: isChannelReadyToClose } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'isChannelReadyToClose',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });

  // Get token information for the channel
  const tokenAddress = channelInfo?.[0] as `0x${string}` | undefined; // targetContract from getChannelInfo
  const participantCount = channelInfo?.[2] ? Number(channelInfo[2]) : 0;
  
  const { data: tokenInfo } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'debugTokenInfo',
    args: tokenAddress && address ? [tokenAddress, address] : undefined,
    enabled: Boolean(tokenAddress && address)
  });
  
  // Extract token metadata
  const tokenSymbol = tokenInfo?.[5] || 'TOKEN';
  const tokenDecimals = tokenInfo?.[6] || 18;
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
      1: 'text-blue-600 dark:text-blue-400',        // Initialized  
      2: 'text-green-600 dark:text-green-400',      // Open
      3: 'text-green-600 dark:text-green-400',      // Active
      4: 'text-yellow-600 dark:text-yellow-400',    // Closing
      5: 'text-red-600 dark:text-red-400'           // Closed
    };
    return colors[stateNumber as keyof typeof colors] || 'text-gray-500 dark:text-gray-400';
  };
  
  // Prepare the signAggregatedProof transaction
  const { config, error: prepareError } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'signAggregatedProof',
    args: leaderChannel && signatureData.message ? [
      BigInt(leaderChannel.id),
      {
        message: signatureData.message as `0x${string}`,
        rx: signatureData.rx ? BigInt(signatureData.rx) : BigInt(0),
        ry: signatureData.ry ? BigInt(signatureData.ry) : BigInt(0),
        z: signatureData.z ? BigInt(signatureData.z) : BigInt(0)
      }
    ] : undefined,
    enabled: Boolean(leaderChannel && signatureData.message && signatureData.rx && signatureData.ry && signatureData.z)
  });
  
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <ClientOnly>
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>
      
      <div className={`flex-1 ml-0 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} flex flex-col min-h-screen transition-all duration-300`}>
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
          <div className="px-4 py-4 lg:px-6">
            <div className="flex items-center justify-between">
              <div className="hidden lg:flex items-center gap-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">✍️</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sign Aggregated Proof</h1>
              </div>
              <div className="flex items-center gap-3">
                <MobileMenuButton 
                  showMobileMenu={showMobileMenu} 
                  setShowMobileMenu={setShowMobileMenu} 
                />
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

        <MobileNavigation 
          showMobileMenu={showMobileMenu} 
          setShowMobileMenu={setShowMobileMenu} 
        />

        <main className="flex-1 p-4 sm:p-6">
          {!isConnected ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔌</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Please connect your wallet to sign aggregated proofs
              </p>
              <ConnectButton />
            </div>
          ) : !hasAccess ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚫</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Only channel leaders can sign aggregated proofs
              </p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Channel Overview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xl">✍️</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sign Aggregated Proof</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Submit your group threshold signature to finalize the channel closure
                    </p>
                  </div>
                </div>
                
                {leaderChannel && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Channel ID</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">#{leaderChannel.id}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                      <div className={`text-lg font-semibold ${channelInfo ? getChannelStateColor(Number(channelInfo[1])) : 'text-gray-500 dark:text-gray-400'}`}>
                        {channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'Loading...'}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Participants</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {channelParticipants ? channelParticipants.length : '...'}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Ready to Close</div>
                      <div className={`text-lg font-semibold ${
                        isChannelReadyToClose ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {isChannelReadyToClose ? '✓ Yes' : '⏳ Not Yet'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Signature Submission Form */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Group Threshold Signature
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
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
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
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
                              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">{uploadedFile.name}</h3>
                              <p className="text-sm text-green-600 dark:text-green-400">Signature data loaded successfully</p>
                            </div>
                          </div>
                          <button
                            onClick={removeFile}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Signature Data Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-600 dark:text-gray-400">Message</div>
                            <div className="font-semibold text-green-800 dark:text-green-200 truncate">{signatureData.message.slice(0, 20)}...</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-600 dark:text-gray-400">R Point (rx, ry)</div>
                            <div className="font-semibold text-green-800 dark:text-green-200 truncate">
                              ({signatureData.rx.slice(0, 8)}..., {signatureData.ry.slice(0, 8)}...)
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 col-span-1 md:col-span-2">
                            <div className="text-gray-600 dark:text-gray-400">Signature Scalar (z)</div>
                            <div className="font-semibold text-green-800 dark:text-green-200 truncate">{signatureData.z.slice(0, 20)}...</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {fileError && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                        <p className="text-red-600 dark:text-red-400 text-sm">{fileError}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Submit Button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                        canSubmit
                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isLoading || isTransactionLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Signing...</span>
                        </div>
                      ) : (
                        'Sign Aggregated Proof'
                      )}
                    </button>
                    
                    {!isFormValid && (
                      <div className="text-sm text-amber-600 dark:text-amber-400">
                        ⚠️ Please upload the signature JSON file containing all required parameters
                      </div>
                    )}
                    
                    {isFormValid && !isChannelStateValid && channelInfo && (
                      <div className="text-sm text-red-600 dark:text-red-400">
                        🚫 Channel must be in "Closing" state to sign proofs. Current state: {getChannelStateDisplay(Number(channelInfo[1]))}
                      </div>
                    )}
                    
                    {isFormValid && isChannelStateValid && isSignatureAlreadySubmitted && (
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        ✅ Signature already submitted! Channel is ready to close.
                      </div>
                    )}
                    
                    {isSuccess && (
                      <div className="text-sm text-green-600 dark:text-green-400">
                        ✅ Proof signed successfully!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
        
        {/* Footer */}
        <footer className="mt-auto bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap justify-center gap-6 mb-6">
              <a href="https://x.com/Tokamak_Network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="font-medium">X (Twitter)</span>
              </a>
              <a href="https://www.tokamak.network/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span className="font-medium">Official Website</span>
              </a>
              <a href="https://medium.com/@tokamak.network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
                </svg>
                <span className="font-medium">Medium</span>
              </a>
              <a href="https://github.com/tokamak-network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">GitHub</span>
              </a>
            </div>
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p>&copy; 2025 Tokamak Network. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}