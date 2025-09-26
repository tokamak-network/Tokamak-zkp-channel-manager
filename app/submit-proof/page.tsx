'use client';

import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount, useContractReads } from 'wagmi';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { MobileNavigation } from '@/components/MobileNavigation';
import { MobileMenuButton } from '@/components/MobileMenuButton';
import { useLeaderAccess } from '@/hooks/useLeaderAccess';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { generateMPTLeavesFromToken, tokenToSmallestUnit, validateBalanceConservation } from '@/lib/mptHelper';
import { computeFinalStateRoot } from '@/lib/merkleProofGenerator';
import { ETH_TOKEN_ADDRESS } from '@/lib/contracts';

export default function SubmitProofPage() {
  const { isConnected, hasAccess, isMounted, leaderChannel } = useLeaderAccess();
  const { address } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Proof submission form state
  const [proofData, setProofData] = useState({
    aggregatedProofHash: '',
    finalStateRoot: '',
    proofPart1: [] as bigint[],
    proofPart2: [] as bigint[],
    publicInputs: [] as bigint[],
    smax: '',
    initialMPTLeaves: [] as `0x${string}`[],
    finalMPTLeaves: [] as `0x${string}`[],
    participantRoots: [] as `0x${string}`[]
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  
  // MPT leaf generation state
  const [showMPTGenerator, setShowMPTGenerator] = useState(false);
  const [initialBalances, setInitialBalances] = useState<string[]>([]);
  const [finalBalances, setFinalBalances] = useState<string[]>([]);
  const [generatedInitialMPTLeaves, setGeneratedInitialMPTLeaves] = useState<`0x${string}`[]>([]);
  const [generatedFinalMPTLeaves, setGeneratedFinalMPTLeaves] = useState<`0x${string}`[]>([]);
  
  // Final state root computation state
  const [showFinalStateComputation, setShowFinalStateComputation] = useState(false);
  const [participantBalances, setParticipantBalances] = useState<string[]>([]);
  const [computedFinalStateRoot, setComputedFinalStateRoot] = useState<string>('');
  const [participantLeavesData, setParticipantLeavesData] = useState<string[]>([]);
  const [participantRootsData, setParticipantRootsData] = useState<string[]>([]);
  
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
  
  const { data: channelParticipants, error: participantsError, isLoading: participantsLoading } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });

  // Log errors for debugging
  useEffect(() => {
    if (participantsError) {
      console.error('Error fetching channel participants:', participantsError);
    }
  }, [participantsError]);

  // Fetch L2 public keys for all channel participants
  const l2PublicKeyContracts = channelParticipants && leaderChannel ? 
    channelParticipants.map(participant => ({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: 'getL2PublicKey',
      args: [BigInt(leaderChannel.id), participant],
    })) : [];

  const { data: l2PublicKeysData, error: l2KeysError, isLoading: l2KeysLoading } = useContractReads({
    contracts: l2PublicKeyContracts,
    enabled: Boolean(channelParticipants && leaderChannel && channelParticipants.length > 0),
  });

  // State to store fetched L2 addresses
  const [fetchedL2Addresses, setFetchedL2Addresses] = useState<string[]>([]);
  const [showManualAddressInput, setShowManualAddressInput] = useState(false);
  const [manualAddresses, setManualAddresses] = useState<string>('');
  
  const { data: isChannelReadyToClose } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'isChannelReadyToClose',
    args: leaderChannel ? [BigInt(leaderChannel.id)] : undefined,
    enabled: Boolean(leaderChannel?.id !== undefined)
  });
  
  const { data: channelDeposits } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelDeposits',
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

  // Initialize balances based on participant count
  useEffect(() => {
    if (participantCount > 0 && initialBalances.length !== participantCount) {
      // Initialize with zero balances for all participants
      const defaultInitialBalances = Array(participantCount).fill('0.0');
      const defaultFinalBalances = Array(participantCount).fill('0.0');
      
      setInitialBalances(defaultInitialBalances);
      setFinalBalances(defaultFinalBalances);
      
      // Initialize final state computation arrays - only balances now
      const defaultBalancesFS = Array(participantCount).fill('0.0');
      setParticipantBalances(defaultBalancesFS);
      
      // Clear computed values when participant count changes
      setComputedFinalStateRoot('');
      setParticipantLeavesData([]);
      setParticipantRootsData([]);
    }
  }, [participantCount, initialBalances.length]);

  // Fetch L2 addresses for all participants using the getL2PublicKey contract function
  useEffect(() => {
    const fetchL2Addresses = async () => {
      console.log('fetchL2Addresses called', { 
        channelParticipants, 
        leaderChannelId: leaderChannel?.id,
        hasAccess,
        isConnected,
        participantsError: !!participantsError,
        participantsLoading,
        l2PublicKeysData,
        l2KeysError: !!l2KeysError,
        l2KeysLoading
      });
      
      // Early return if we don't have the required conditions
      if (!isConnected || !hasAccess || leaderChannel?.id === undefined) {
        console.log('Missing basic requirements for L2 address fetching', {
          isConnected,
          hasAccess,
          leaderChannelId: leaderChannel?.id
        });
        return;
      }

      // If we have L2 public keys data from the contract, use it
      if (l2PublicKeysData && Array.isArray(l2PublicKeysData) && !l2KeysLoading) {
        try {
          console.log('L2 public keys data received:', l2PublicKeysData);
          console.log('L2 public keys data structure:', JSON.stringify(l2PublicKeysData, null, 2));
          
          const l2Addresses = l2PublicKeysData.map((result: any, index) => {
            console.log(`L2 public key result ${index}:`, result);
            
            // Handle different possible result structures
            let l2Address: string | null = null;
            
            try {
              // Check for success/result structure (wagmi v1 style)
              if (result?.status === 'success' && result?.result) {
                l2Address = result.result;
              }
              // Check for direct result property
              else if (result?.result) {
                l2Address = result.result;
              }
              // Check if result itself is the address
              else if (typeof result === 'string' && result.startsWith('0x')) {
                l2Address = result;
              }
              // Check if result has other properties that might contain the address
              else if (result && typeof result === 'object') {
                // Log all properties to understand the structure
                console.log(`Result properties for ${index}:`, Object.keys(result));
              }
            } catch (error) {
              console.error(`Error processing result ${index}:`, error);
            }
            
            console.log(`Extracted L2 address for participant ${index}:`, l2Address);
            
            // Check if it's a valid non-zero address
            if (l2Address && typeof l2Address === 'string' && l2Address !== '0x0000000000000000000000000000000000000000') {
              return l2Address;
            } else {
              console.log(`L2 address is zero/empty for participant ${index}, using L1 address as fallback`);
              return channelParticipants?.[index] || '';
            }
          }).filter(addr => addr && addr.length > 0);
          
          console.log('Setting L2 addresses:', l2Addresses);
          setFetchedL2Addresses(l2Addresses);
        } catch (error) {
          console.error('Error processing L2 public keys:', error);
          setFetchedL2Addresses([]);
        }
        return;
      }

      // If L2 keys are still loading, wait
      if (l2KeysLoading) {
        console.log('L2 public keys still loading...');
        return;
      }

      // If there's an error fetching L2 keys but we have participants, use L1 as fallback
      if (l2KeysError && channelParticipants && Array.isArray(channelParticipants)) {
        console.log('L2 keys fetch failed, using L1 addresses as fallback:', l2KeysError);
        setFetchedL2Addresses([...channelParticipants]);
        return;
      }

      // If participants are still loading, wait
      if (participantsLoading) {
        console.log('Channel participants still loading...');
        return;
      }

      // If there's an error or no participants after loading, provide manual option
      if (participantsError || (!participantsLoading && !channelParticipants)) {
        console.log('No participants data available - manual input required');
      }
    };

    fetchL2Addresses();
  }, [channelParticipants, leaderChannel?.id, hasAccess, isConnected, participantsError, participantsLoading, l2PublicKeysData, l2KeysError, l2KeysLoading]);

  // Clear computed values when inputs change
  useEffect(() => {
    // Clear computed final state root when participant balances or L2 addresses change
    setComputedFinalStateRoot('');
    setParticipantLeavesData([]);
    setParticipantRootsData([]);
  }, [participantBalances, fetchedL2Addresses, leaderChannel?.id, tokenDecimals]);

  // Clear generated MPT leaves when balance inputs change
  useEffect(() => {
    // Clear generated MPT leaves when initial/final balances change
    setGeneratedInitialMPTLeaves([]);
    setGeneratedFinalMPTLeaves([]);
  }, [initialBalances, finalBalances, tokenDecimals]);
  
  // Prepare final submission data for contract call
  const prepareFinalSubmissionData = () => {
    let finalData = { ...proofData };
    
    // Override with generated data if available
    if (computedFinalStateRoot) {
      finalData.finalStateRoot = computedFinalStateRoot;
    }
    
    if (participantRootsData.length > 0) {
      finalData.participantRoots = participantRootsData.map(root => root as `0x${string}`);
    }
    
    if (generatedInitialMPTLeaves.length > 0) {
      finalData.initialMPTLeaves = generatedInitialMPTLeaves;
    }
    
    if (generatedFinalMPTLeaves.length > 0) {
      finalData.finalMPTLeaves = generatedFinalMPTLeaves;
    }
    
    return finalData;
  };

  // Prepare the submitAggregatedProof transaction
  const { config, error: prepareError } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'submitAggregatedProof',
    args: (() => {
      if (!leaderChannel) return undefined;
      
      const finalData = prepareFinalSubmissionData();
      if (!finalData.aggregatedProofHash || !finalData.finalStateRoot) return undefined;
      
      return [
        BigInt(leaderChannel.id),
        {
          aggregatedProofHash: finalData.aggregatedProofHash as `0x${string}`,
          finalStateRoot: finalData.finalStateRoot as `0x${string}`,
          proofPart1: finalData.proofPart1,
          proofPart2: finalData.proofPart2,
          publicInputs: finalData.publicInputs,
          smax: finalData.smax ? BigInt(finalData.smax) : BigInt(0),
          initialMPTLeaves: finalData.initialMPTLeaves,
          finalMPTLeaves: finalData.finalMPTLeaves,
          participantRoots: finalData.participantRoots
        }
      ];
    })(),
    enabled: Boolean(leaderChannel && (proofData.aggregatedProofHash || computedFinalStateRoot))
  });
  
  const { data, write } = useContractWrite(config);
  
  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });
  
  
  const handleFileUpload = async (file: File) => {
    try {
      setFileError('');
      
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Validate that core proof fields are present (we'll allow UI-generated fields to be missing)
      const coreProofFields = [
        'proof_entries_part1', 'proof_entries_part2', 'public_inputs', 'smax'
      ];
      
      const missingCoreFields = coreProofFields.filter(field => !jsonData[field]);
      if (missingCoreFields.length > 0) {
        throw new Error(`Missing required core proof fields: ${missingCoreFields.join(', ')}`);
      }
      
      // Parse and validate all data - handle array format consistently
      const aggregatedProofHash = jsonData.proofHash ? 
        (Array.isArray(jsonData.proofHash) ? jsonData.proofHash[0] : jsonData.proofHash) : 
        '';
      const finalStateRoot = jsonData.finalStateRoot ? 
        (Array.isArray(jsonData.finalStateRoot) ? jsonData.finalStateRoot[0] : jsonData.finalStateRoot) : 
        '';
      const participantRoots = jsonData.ParticipantRoots || [];
      const initialMPTLeaves = jsonData.InitialMPTLeaves || [];
      const finalMPTLeaves = jsonData.FinalMPTLeaves || [];
      const proofPart1 = jsonData.proof_entries_part1.map((hex: string) => BigInt(hex));
      const proofPart2 = jsonData.proof_entries_part2.map((hex: string) => BigInt(hex));
      const publicInputs = jsonData.public_inputs.map((hex: string) => BigInt(hex));
      const smax = (Array.isArray(jsonData.smax) ? jsonData.smax[0] : jsonData.smax).toString();
      
      // Update all proof data at once
      setProofData({
        aggregatedProofHash,
        finalStateRoot,
        proofPart1,
        proofPart2,
        publicInputs,
        smax,
        initialMPTLeaves: initialMPTLeaves.map((leaf: string) => leaf as `0x${string}`),
        finalMPTLeaves: finalMPTLeaves.map((leaf: string) => leaf as `0x${string}`),
        participantRoots: participantRoots.map((root: string) => root as `0x${string}`)
      });
      
      setUploadedFile(file);
      
    } catch (error) {
      console.error('Error parsing proof file:', error);
      setFileError(error instanceof Error ? error.message : 'Invalid file format');
    }
  };
  
  const removeFile = () => {
    setUploadedFile(null);
    setFileError('');
    
    // Reset all proof data
    setProofData({
      aggregatedProofHash: '',
      finalStateRoot: '',
      proofPart1: [],
      proofPart2: [],
      publicInputs: [],
      smax: '',
      initialMPTLeaves: [],
      finalMPTLeaves: [],
      participantRoots: []
    });
  };
  
  const handleGenerateMPTLeaves = () => {
    try {
      const initialMPTLeaves = generateMPTLeavesFromToken(initialBalances, tokenDecimals);
      const finalMPTLeaves = generateMPTLeavesFromToken(finalBalances, tokenDecimals);
      
      setGeneratedInitialMPTLeaves(initialMPTLeaves);
      setGeneratedFinalMPTLeaves(finalMPTLeaves);
      
      // Validate balance conservation
      const initialSmallestUnitBalances = initialBalances.map(token => tokenToSmallestUnit(token, tokenDecimals));
      const finalSmallestUnitBalances = finalBalances.map(token => tokenToSmallestUnit(token, tokenDecimals));
      
      if (!validateBalanceConservation(initialSmallestUnitBalances, finalSmallestUnitBalances)) {
        alert('Warning: Total initial balance does not equal total final balance. This will cause "Balance conservation violated" error.');
      }
    } catch (error) {
      console.error('Error generating MPT leaves:', error);
      alert(`Error generating MPT leaves: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your balance inputs and token decimals.`);
    }
  };
  
  const handleDownloadMPTLeaves = () => {
    if (generatedInitialMPTLeaves.length === 0 || generatedFinalMPTLeaves.length === 0) {
      alert('Please generate MPT leaves first');
      return;
    }
    
    const mptData = {
      tokenInfo: {
        address: tokenAddress,
        symbol: tokenSymbol,
        decimals: tokenDecimals,
        isETH: isETH
      },
      channelInfo: {
        participantCount,
        channelId: leaderChannel?.id
      },
      balances: {
        initial: initialBalances,
        final: finalBalances,
        initialTotal: initialBalances.reduce((sum, bal) => sum + parseFloat(bal || '0'), 0),
        finalTotal: finalBalances.reduce((sum, bal) => sum + parseFloat(bal || '0'), 0)
      },
      initialMPTLeaves: generatedInitialMPTLeaves,
      finalMPTLeaves: generatedFinalMPTLeaves,
      generatedAt: new Date().toISOString(),
      note: "Generated MPT leaves for RollupBridge proof submission"
    };
    
    const blob = new Blob([JSON.stringify(mptData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mpt-leaves-channel-${leaderChannel?.id || 'unknown'}-${tokenSymbol}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`MPT leaves downloaded as JSON file for ${tokenSymbol} channel with ${participantCount} participants`);
  };
  
  const handleDownloadProofTemplate = () => {
    // Template contains ONLY the core proof data that users need to provide
    // UI-generated fields (finalStateRoot, ParticipantRoots, InitialMPTLeaves, FinalMPTLeaves)
    // are NOT included as they will be generated by the UI sections
    const template = {
      "proofHash": [
        "0xa5bd20250df117ee1576cde77471907f0792dabd126e96e46ea0b2c71299ea1e"
      ],
      "proof_entries_part1": [
        "0x1236d4364cc024d1bb70d584096fae2c",
        "0x14caedc95bee5309da79cfe59aa67ba3",
        "0x0573b8e1fe407ab0e47f7677b3333c8b"
      ],
      "proof_entries_part2": [
        "0xd107861dd8cac07bc427c136bc12f424521b3e3aaab440fdcdd66a902e22c0a4",
        "0x27d4a95a71f8b939514a0e455984f5c90b9fdcf5702a3da9a8d73f7f93292c23",
        "0x08393216d4961ef999d5938af832fd08b8ff691f4a25cd77786485e9891e2389"
      ],
      "public_inputs": [
        "0x00000000000000000000000000000000d9bb52200d942752f44a41d658ee82de",
        "0x00000000000000000000000000000000000000000000000000000000cfc387b2",
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      ],
      "smax": [512]
    };
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AggProofData-template-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Core proof data template downloaded! Fill in your proof data, then use steps 2 & 3 to generate the remaining fields automatically.');
  };
  
  const handleComputeFinalStateRoot = () => {
    try {
      // Check multiple sources for channel ID
      let channelId = leaderChannel?.id;
      
      // Debug logging
      console.log('=== CHANNEL DEBUG INFO ===');
      console.log('leaderChannel:', leaderChannel);
      console.log('leaderChannel?.id:', leaderChannel?.id);
      console.log('typeof leaderChannel?.id:', typeof leaderChannel?.id);
      console.log('channelInfo:', channelInfo);
      console.log('========================');
      
      // If leaderChannel.id is not available, we should use the channel ID from the URL parameters
      // or contract context, but for now let's just use leaderChannel.id
      if (channelId === undefined || channelId === null) {
        alert('Channel ID not available. Please ensure you are connected and have a valid channel.');
        return;
      }
      
      // Validate balances and check if L2 addresses are available
      const emptyBalances = participantBalances.filter(bal => !bal.trim() || parseFloat(bal) < 0);
      
      if (emptyBalances.length > 0) {
        alert('Please fill in all participant balances with valid positive numbers');
        return;
      }
      
      if (fetchedL2Addresses.length === 0) {
        alert('L2 addresses are still being fetched. Please wait a moment and try again.');
        return;
      }
      
      if (fetchedL2Addresses.length !== participantBalances.length) {
        alert('Mismatch between number of participants and fetched L2 addresses');
        return;
      }
      
      // Convert balances to smallest unit
      const balancesInSmallestUnit = participantBalances.map(balance => 
        tokenToSmallestUnit(balance, tokenDecimals)
      );
      
      // Prepare participants data using fetched L2 addresses
      const participants = fetchedL2Addresses.map((l2Address, index) => ({
        l2Address: l2Address.trim(),
        balance: balancesInSmallestUnit[index].toString()
      }));
      
      // Compute final state root (this generates participant roots as intermediate states)
      const result = computeFinalStateRoot(Number(channelId), participants);
      
      setComputedFinalStateRoot(result.finalStateRoot);
      setParticipantLeavesData(result.participantLeaves);
      setParticipantRootsData(result.participantRoots); // Use participant roots, not channel root sequence
      
    } catch (error) {
      console.error('Error computing final state root:', error);
      alert(`Error computing final state root: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  
  
  const handleSubmit = async () => {
    // Prepare final submission data by combining uploaded JSON data with generated UI data
    let finalSubmissionData = { ...proofData };
    
    // Override with generated data if available
    if (computedFinalStateRoot) {
      finalSubmissionData.finalStateRoot = computedFinalStateRoot;
    }
    
    if (participantRootsData.length > 0) {
      finalSubmissionData.participantRoots = participantRootsData.map(root => root as `0x${string}`);
    }
    
    if (generatedInitialMPTLeaves.length > 0) {
      finalSubmissionData.initialMPTLeaves = generatedInitialMPTLeaves;
    }
    
    if (generatedFinalMPTLeaves.length > 0) {
      finalSubmissionData.finalMPTLeaves = generatedFinalMPTLeaves;
    }
    
    // Validate that we have all required data
    if (!finalSubmissionData.aggregatedProofHash) {
      alert('Missing aggregated proof hash. Please upload a JSON file containing proof_entries and other core proof data.');
      return;
    }
    
    if (!finalSubmissionData.finalStateRoot) {
      alert('Missing final state root. Please either include it in your JSON file or generate it using the "Final state and participant roots computation" section.');
      return;
    }
    
    if (!finalSubmissionData.proofPart1 || finalSubmissionData.proofPart1.length === 0) {
      alert('Missing proof_entries_part1. Please upload a JSON file with valid proof data.');
      return;
    }
    
    if (!finalSubmissionData.initialMPTLeaves || finalSubmissionData.initialMPTLeaves.length === 0) {
      alert('Missing Initial MPT Leaves. Please either include them in your JSON file or generate them using the "MPT Leaves Generator" section.');
      return;
    }
    
    if (!finalSubmissionData.finalMPTLeaves || finalSubmissionData.finalMPTLeaves.length === 0) {
      alert('Missing Final MPT Leaves. Please either include them in your JSON file or generate them using the "MPT Leaves Generator" section.');
      return;
    }
    
    // Debug logging
    console.log('=== DEBUG INFO ===');
    console.log('Channel ID:', leaderChannel?.id);
    console.log('Channel Info:', channelInfo);
    console.log('Channel State:', channelInfo ? Number(channelInfo[1]) : 'undefined');
    console.log('Channel State Name:', channelInfo ? getChannelStateDisplay(Number(channelInfo[1])) : 'undefined');
    console.log('Participants:', channelParticipants);
    console.log('Participant Count:', channelParticipants?.length);
    console.log('MPT Leaves Count:', proofData.initialMPTLeaves.length);
    console.log('Participant Roots Count:', proofData.participantRoots.length);
    console.log('Is Leader:', hasAccess);
    console.log('Connected Address:', address);
    console.log('Token Address:', tokenAddress);
    console.log('Token Symbol:', tokenSymbol);
    console.log('Token Decimals:', tokenDecimals);
    console.log('Channel Deposits:', channelDeposits);
    console.log('Total Channel Deposits:', channelDeposits ? channelDeposits[0] : 'undefined');
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
      console.error('Error submitting proof:', error);
      alert('Error submitting proof. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const isFormValid = (() => {
    const finalData = prepareFinalSubmissionData();
    return Boolean(
      // Core proof data from uploaded JSON is required
      finalData.proofPart1.length > 0 && 
      finalData.proofPart2.length > 0 && 
      finalData.publicInputs.length > 0 &&
      finalData.smax &&
      // Final state root can come from JSON or UI generation
      finalData.finalStateRoot &&
      // MPT Leaves can come from JSON or UI generation
      finalData.initialMPTLeaves.length > 0 &&
      finalData.finalMPTLeaves.length > 0 &&
      // Participant roots can come from JSON or UI generation
      finalData.participantRoots.length > 0
    );
  })();
  
  // Check if channel is in correct state for proof submission (Open=2 or Active=3)
  const isChannelStateValid = channelInfo && (Number(channelInfo[1]) === 2 || Number(channelInfo[1]) === 3);
  
  const canSubmit = isConnected && hasAccess && leaderChannel && isFormValid && isChannelStateValid && !isLoading && !isTransactionLoading;

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
                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">📋</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Submit Aggregated Proof</h1>
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

        {/* Mobile Navigation Menu */}
        <MobileNavigation 
          showMobileMenu={showMobileMenu} 
          setShowMobileMenu={setShowMobileMenu} 
        />

        <main className="flex-1 p-4 sm:p-6">
          {!isConnected ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Connect Your Wallet</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please connect your wallet to submit aggregated proof
              </p>
            </div>
          ) : !hasAccess ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚫</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This page is only accessible to channel leaders
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                You need to be a channel leader to submit aggregated proofs
              </p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Channel Overview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xl">📋</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Submit Aggregated Proof</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Finalize your channel's off-chain computations and settle on-chain
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
                      <div className="text-sm text-gray-600 dark:text-gray-400">Ready to Submit Signature</div>
                      <div className={`text-lg font-semibold ${
                        (channelInfo && Number(channelInfo[1]) === 4) || isChannelReadyToClose ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {(channelInfo && Number(channelInfo[1]) === 4) || isChannelReadyToClose ? '✓ Yes' : '⏳ Not Yet'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Proof Submission Form */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Aggregated Proof Data (step 1)
                  </h4>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Template Download Section */}
                  <div className="max-w-2xl mx-auto mb-6">
                    <div className="text-center">
                      <button
                        onClick={handleDownloadProofTemplate}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Aggregated Proof Data Template
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Get a template JSON file with the correct structure and placeholder values
                      </p>
                    </div>
                  </div>

                  {/* Single File Upload Section */}
                  <div className="max-w-2xl mx-auto">
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
                      Aggregated Proof Data File (JSON) *
                    </label>
                    {!uploadedFile ? (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          className="hidden"
                          id="proof-data-file"
                        />
                        <label htmlFor="proof-data-file" className="cursor-pointer">
                          <div className="text-gray-500 dark:text-gray-400">
                            <svg className="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-lg font-medium mb-2">Click to upload proof data file</p>
                            <p className="text-sm mb-4">Upload a single JSON file containing all proof parameters</p>
                            <div className="text-xs text-gray-400 space-y-1">
                              <p>Expected structure: Core proof data only</p>
                              <p>Contains: proofHash, proof_entries_part1, proof_entries_part2, public_inputs, smax</p>
                              <p>Other fields will be generated by steps 2 & 3 below</p>
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
                              <p className="text-sm text-green-600 dark:text-green-400">Proof data loaded successfully</p>
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
                        
                        {/* Data Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-600 dark:text-gray-400">Proof Entries Part 1</div>
                            <div className="font-semibold text-green-800 dark:text-green-200">{proofData.proofPart1.length} entries</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-600 dark:text-gray-400">Proof Entries Part 2</div>
                            <div className="font-semibold text-green-800 dark:text-green-200">{proofData.proofPart2.length} entries</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-600 dark:text-gray-400">Public Inputs</div>
                            <div className="font-semibold text-green-800 dark:text-green-200">{proofData.publicInputs.length} inputs</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-600 dark:text-gray-400">Smax</div>
                            <div className="font-semibold text-green-800 dark:text-green-200">{proofData.smax}</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-gray-600 dark:text-gray-400">Proof Hash</div>
                            <div className="font-semibold text-green-800 dark:text-green-200 truncate">{proofData.aggregatedProofHash.slice(0, 8)}...</div>
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
                  
                  {/* Final State Root Computation */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Final state & Participant Roots Computation (step 2)
                      </h4>
                      <button
                        onClick={() => setShowFinalStateComputation(!showFinalStateComputation)}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        {showFinalStateComputation ? 'Hide' : 'Show'} Computation
                      </button>
                    </div>
                    
                    {showFinalStateComputation && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
                        <div className="mb-4">
                          <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-lg mb-4">
                            <div className="text-sm text-blue-900 dark:text-blue-100">
                              <strong>Channel Info:</strong> Channel #{leaderChannel?.id ?? 'N/A'} • {tokenSymbol} ({tokenDecimals} decimals) • {participantCount} participants
                              {tokenAddress && (
                                <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 break-all">
                                  Token: {tokenAddress}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                            Compute the final state root exactly as the contract does in initializeChannelState. 
                            This uses quaternary Merkle tree logic with participant L2 addresses and their final balances.
                          </p>
                        </div>
                        
                        {/* Show fetched L2 addresses */}
                        {fetchedL2Addresses.length > 0 && (
                          <div className="mb-6">
                            <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">
                              Participant L2 Addresses {l2KeysError ? '(L1 Fallback)' : '(From Contract)'}
                            </h5>
                            <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-lg">
                              <div className="space-y-1 text-xs">
                                {fetchedL2Addresses.map((l2Address, index) => (
                                  <div key={index} className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                                    <span className="w-20">Participant {index + 1}:</span>
                                    <span className="font-mono">{l2Address}</span>
                                    {l2KeysError && channelParticipants && l2Address === channelParticipants[index] && (
                                      <span className="text-xs text-blue-600 dark:text-blue-300">(L1 fallback)</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {l2KeysError && (
                                <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
                                  ⚠️ L2 public key fetch failed, using L1 addresses as fallback
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Manual address input */}
                        {showManualAddressInput && fetchedL2Addresses.length === 0 && (
                          <div className="mb-6">
                            <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">
                              Manual Participant L2 Addresses
                            </h5>
                            <div className="space-y-3">
                              <textarea
                                value={manualAddresses}
                                onChange={(e) => setManualAddresses(e.target.value)}
                                className="w-full h-24 p-3 text-xs font-mono border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                placeholder="Enter participant addresses one per line, e.g.:&#10;0x1234...&#10;0x5678...&#10;0x9abc..."
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const addresses = manualAddresses
                                      .split('\n')
                                      .map(addr => addr.trim())
                                      .filter(addr => addr.length > 0);
                                    setFetchedL2Addresses(addresses);
                                    setShowManualAddressInput(false);
                                  }}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                                >
                                  Use These Addresses
                                </button>
                                <button
                                  onClick={() => {
                                    setShowManualAddressInput(false);
                                    setManualAddresses('');
                                  }}
                                  className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white text-xs rounded transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-6">
                          {/* Participant Balances */}
                          <div>
                            <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">
                              Final Balances ({tokenSymbol})
                            </h5>
                            <div className="space-y-2">
                              {participantBalances.map((balance, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <span className="text-xs text-blue-700 dark:text-blue-300 w-20">
                                    Participant {index + 1}:
                                  </span>
                                  <input
                                    type="number"
                                    step={tokenDecimals === 6 ? "0.000001" : "0.000000000000000001"}
                                    value={balance}
                                    onChange={(e) => {
                                      const newBalances = [...participantBalances];
                                      newBalances[index] = e.target.value;
                                      setParticipantBalances(newBalances);
                                    }}
                                    className="flex-1 px-3 py-1 border border-blue-300 dark:border-blue-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  />
                                  <span className="text-xs text-blue-700 dark:text-blue-300">{tokenSymbol}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        {/* Compute Button */}
                        <div className="flex flex-wrap gap-2 mt-4">
                          <div className="space-y-2">
                            <button
                              onClick={handleComputeFinalStateRoot}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={fetchedL2Addresses.length === 0}
                            >
                              Compute Final State Root
                            </button>
                            
                            {/* User feedback for disabled state */}
                            {fetchedL2Addresses.length === 0 && (
                              <div className="text-xs">
                                {!isConnected ? (
                                  <div className="text-red-600 dark:text-red-400">
                                    ⚠️ Please connect your wallet to submit proofs
                                  </div>
                                ) : !hasAccess ? (
                                  <div className="text-red-600 dark:text-red-400">
                                    ⚠️ Only channel leaders can submit proofs. You must be the leader of a channel to access this feature.
                                  </div>
                                ) : !leaderChannel ? (
                                  <div className="text-orange-600 dark:text-orange-400">
                                    ⏳ Loading your channel information...
                                  </div>
                                ) : !channelParticipants ? (
                                  <div className="text-orange-600 dark:text-orange-400">
                                    ⏳ Loading channel participants...
                                  </div>
                                ) : l2KeysLoading ? (
                                  <div className="text-orange-600 dark:text-orange-400">
                                    ⏳ Fetching L2 public keys from contract...
                                  </div>
                                ) : l2KeysError ? (
                                  <div className="space-y-2">
                                    <div className="text-yellow-600 dark:text-yellow-400">
                                      ⚠️ L2 key fetch failed, using L1 addresses as fallback
                                    </div>
                                    <button
                                      onClick={() => setShowManualAddressInput(true)}
                                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                    >
                                      Enter L2 addresses manually
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="text-orange-600 dark:text-orange-400">
                                      ⏳ Processing L2 public keys...
                                    </div>
                                    <button
                                      onClick={() => setShowManualAddressInput(true)}
                                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                    >
                                      Enter L2 addresses manually
                                    </button>
                                  </div>
                                )}
                                
                                {/* Debug information (show only in development) */}
                                {process.env.NODE_ENV === 'development' && (
                                  <details className="mt-2">
                                    <summary className="text-gray-500 cursor-pointer">Debug Info</summary>
                                    <div className="ml-2 space-y-1 text-gray-600 dark:text-gray-400">
                                      <div>• Connected: {isConnected ? 'Yes' : 'No'}</div>
                                      <div>• Has access: {hasAccess ? 'Yes' : 'No'}</div>
                                      <div>• Leader channel: {leaderChannel?.id !== undefined ? `Channel ${leaderChannel.id}` : 'None'}</div>
                                      <div>• Channel participants: {channelParticipants ? `${channelParticipants.length} found` : 'Loading...'}</div>
                                      <div>• L2 keys loading: {l2KeysLoading ? 'Yes' : 'No'}</div>
                                      <div>• L2 keys error: {l2KeysError ? 'Yes' : 'No'}</div>
                                      <div>• L2 keys data: {l2PublicKeysData ? `${l2PublicKeysData.length} results` : 'None'}</div>
                                      <div>• L2 addresses: {fetchedL2Addresses.length} fetched</div>
                                    </div>
                                  </details>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Balance Summary */}
                        {participantBalances.length > 0 && (
                          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-800 rounded-lg">
                            <div className="text-xs text-blue-700 dark:text-blue-300">
                              <strong>Balance Total:</strong> {participantBalances.reduce((sum, bal) => sum + parseFloat(bal || '0'), 0).toFixed(6)} {tokenSymbol}
                            </div>
                          </div>
                        )}
                        
                        {/* Computed Final State Root */}
                        {computedFinalStateRoot && (
                          <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-700">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                Computed Final State Root
                              </h5>
                              <span className="text-xs text-green-600 dark:text-green-400">
                                ✅ Computation complete
                              </span>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                              <div className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                                {computedFinalStateRoot}
                              </div>
                            </div>
                            
                            {/* Computed Participant Roots */}
                            {participantRootsData.length > 0 && (
                              <div className="mt-4">
                                <h6 className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">
                                  Computed Participant Roots (Channel Root Sequence)
                                </h6>
                                <div className="bg-white dark:bg-gray-800 p-2 rounded border max-h-40 overflow-y-auto">
                                  {participantRootsData.map((root, index) => (
                                    <div key={index} className="mb-2 text-xs break-all text-gray-700 dark:text-gray-300">
                                      <div className="font-semibold mb-1">Participant {index + 1}:</div>
                                      <div className="font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">{root}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {participantLeavesData.length > 0 && (
                              <div className="mt-4">
                                <h6 className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">
                                  Participant Leaves (Preview)
                                </h6>
                                <div className="bg-white dark:bg-gray-800 p-2 rounded border max-h-32 overflow-y-auto">
                                  {participantLeavesData.map((leaf, index) => (
                                    <div key={index} className="mb-1 text-xs break-all text-gray-700 dark:text-gray-300">
                                      {index + 1}: {leaf.slice(0, 20)}...{leaf.slice(-10)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* MPT Leaves Generator */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        MPT Leaves Computation (step 3)
                      </h4>
                      <button
                        onClick={() => setShowMPTGenerator(!showMPTGenerator)}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        {showMPTGenerator ? 'Hide' : 'Show'} Computation
                      </button>
                    </div>
                    
                    {showMPTGenerator && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
                        <div className="mb-4">
                          <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-lg mb-4">
                            <div className="text-sm text-blue-900 dark:text-blue-100">
                              <strong>Channel Info:</strong> {tokenSymbol} ({tokenDecimals} decimals) • {participantCount} participants
                              {tokenAddress && (
                                <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 break-all">
                                  Token: {tokenAddress}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                            Generate MPT leaves that match your channel's current state to avoid "Initial balance mismatch" errors. 
                            Download the generated leaves as a JSON file to use in your proof data.
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Initial Balances */}
                          <div>
                            <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">
                              Initial Balances ({tokenSymbol})
                            </h5>
                            <div className="space-y-2">
                              {initialBalances.map((balance, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <span className="text-xs text-blue-700 dark:text-blue-300 w-20">
                                    Participant {index + 1}:
                                  </span>
                                  <input
                                    type="number"
                                    step={tokenDecimals === 6 ? "0.000001" : "0.000000000000000001"}
                                    value={balance}
                                    onChange={(e) => {
                                      const newBalances = [...initialBalances];
                                      newBalances[index] = e.target.value;
                                      setInitialBalances(newBalances);
                                    }}
                                    className="flex-1 px-3 py-1 border border-blue-300 dark:border-blue-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  />
                                  <span className="text-xs text-blue-700 dark:text-blue-300">{tokenSymbol}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Final Balances */}
                          <div>
                            <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">
                              Final Balances ({tokenSymbol})
                            </h5>
                            <div className="space-y-2">
                              {finalBalances.map((balance, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <span className="text-xs text-blue-700 dark:text-blue-300 w-20">
                                    Participant {index + 1}:
                                  </span>
                                  <input
                                    type="number"
                                    step={tokenDecimals === 6 ? "0.000001" : "0.000000000000000001"}
                                    value={balance}
                                    onChange={(e) => {
                                      const newBalances = [...finalBalances];
                                      newBalances[index] = e.target.value;
                                      setFinalBalances(newBalances);
                                    }}
                                    className="flex-1 px-3 py-1 border border-blue-300 dark:border-blue-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  />
                                  <span className="text-xs text-blue-700 dark:text-blue-300">{tokenSymbol}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        {/* Generate Buttons and Balance Summary */}
                        {initialBalances.length > 0 && (
                          <div className="text-xs text-blue-700 dark:text-blue-300 mb-4">
                            <strong>Balance Totals:</strong> Initial: {initialBalances.reduce((sum, bal) => sum + parseFloat(bal || '0'), 0).toFixed(6)} {tokenSymbol} • Final: {finalBalances.reduce((sum, bal) => sum + parseFloat(bal || '0'), 0).toFixed(6)} {tokenSymbol}
                            {Math.abs(initialBalances.reduce((sum, bal) => sum + parseFloat(bal || '0'), 0) - finalBalances.reduce((sum, bal) => sum + parseFloat(bal || '0'), 0)) > 0.000001 && (
                              <span className="text-red-600 dark:text-red-400 ml-2">⚠ Totals don't match!</span>
                            )}
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          <button
                            onClick={handleGenerateMPTLeaves}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={initialBalances.length === 0}
                          >
                            Generate MPT Leaves
                          </button>
                          {generatedInitialMPTLeaves.length > 0 && (
                            <button
                              onClick={handleDownloadMPTLeaves}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download MPT Leaves JSON
                            </button>
                          )}
                        </div>
                        
                        {/* Generated MPT Leaves Preview */}
                        {generatedInitialMPTLeaves.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-700">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                Generated MPT Leaves Preview
                              </h5>
                              <span className="text-xs text-green-600 dark:text-green-400">
                                ✅ Ready to download
                              </span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                              <div>
                                <div className="text-blue-700 dark:text-blue-300 mb-2">Initial MPT Leaves:</div>
                                <div className="bg-white dark:bg-gray-800 p-2 rounded border max-h-32 overflow-y-auto">
                                  {generatedInitialMPTLeaves.map((leaf, index) => (
                                    <div key={index} className="mb-1 break-all text-gray-700 dark:text-gray-300">
                                      {index + 1}: {leaf.slice(0, 20)}...{leaf.slice(-10)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-blue-700 dark:text-blue-300 mb-2">Final MPT Leaves:</div>
                                <div className="bg-white dark:bg-gray-800 p-2 rounded border max-h-32 overflow-y-auto">
                                  {generatedFinalMPTLeaves.map((leaf, index) => (
                                    <div key={index} className="mb-1 break-all text-gray-700 dark:text-gray-300">
                                      {index + 1}: {leaf.slice(0, 20)}...{leaf.slice(-10)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
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
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isLoading || isTransactionLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Submitting...</span>
                        </div>
                      ) : (
                        'Submit Aggregated Proof'
                      )}
                    </button>
                    
                    {!isFormValid && (
                      <div className="text-sm text-amber-600 dark:text-amber-400">
                        ⚠️ Please provide all required data: Upload a JSON file with proof entries and use the computation sections to generate missing data (Final State Root, MPT Leaves, or Participant Roots)
                      </div>
                    )}
                    
                    {isFormValid && !isChannelStateValid && channelInfo && (
                      <div className="text-sm text-red-600 dark:text-red-400">
                        🚫 Channel must be in "Open" or "Active" state to submit proofs. Current state: {getChannelStateDisplay(Number(channelInfo[1]))}
                      </div>
                    )}
                    
                    {isSuccess && (
                      <div className="text-sm text-green-600 dark:text-green-400">
                        ✅ Proof submitted successfully!
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Information Panel */}
              {channelInfo && channelTimeoutInfo && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
                    📊 Off-Chain Computation Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-blue-700 dark:text-blue-300 font-medium">Channel Information</div>
                      <div className="text-blue-600 dark:text-blue-400 mt-1">
                        • Target Contract: {channelInfo[0]}<br/>
                        • Initial State Root: {channelInfo[3]}<br/>
                        • Participant Count: {channelInfo[2]?.toString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-blue-700 dark:text-blue-300 font-medium">Timeline</div>
                      <div className="text-blue-600 dark:text-blue-400 mt-1">
                        • Channel Opened: {channelTimeoutInfo && channelTimeoutInfo[0] ? new Date(Number(channelTimeoutInfo[0]) * 1000).toLocaleDateString() : 'N/A'}<br/>
                        • Timeout Period: {channelTimeoutInfo && channelTimeoutInfo[1] ? `${Number(channelTimeoutInfo[1])} seconds` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
        
        {isSuccess && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
            ✅ Proof submitted successfully!
          </div>
        )}

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
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span className="font-medium">Website</span>
              </a>
              <a href="https://medium.com/tokamak-network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
                </svg>
                <span className="font-medium">Medium</span>
              </a>
              <a href="https://discord.gg/J4chV2zuAK" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className="font-medium">Discord</span>
              </a>
              <a href="https://t.me/tokamak_network" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span className="font-medium">Telegram</span>
              </a>
              <a href="https://www.linkedin.com/company/tokamaknetwork/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span className="font-medium">LinkedIn</span>
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