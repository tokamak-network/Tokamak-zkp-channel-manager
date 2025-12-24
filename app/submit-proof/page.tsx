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
import { FileText, Link, ShieldOff, CheckCircle2, AlertCircle, Download, Hash, FolderArchive, Loader2, ExternalLink } from 'lucide-react';
import JSZip from 'jszip';

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

interface RawProofJson {
  proof_entries_part1: string[];
  proof_entries_part2: string[];
  a_pub_user: string[];
  a_pub_block: string[];
  a_pub_function: string[];
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
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  
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


  
  // Compute final state root from the last proof's a_pub_user[10] (lower) and a_pub_user[11] (upper)
  const finalStateRoot = useMemo(() => {
    if (uploadedProofs.length === 0) return null;
    const lastProof = uploadedProofs[uploadedProofs.length - 1];
    if (lastProof.data.publicInputs.length < 12) return null;
    
    // a_pub_user[10] = lower 16 bytes, a_pub_user[11] = upper 16 bytes of resulting merkle root
    const lowerBytes = lastProof.data.publicInputs[10];
    const upperBytes = lastProof.data.publicInputs[11];
    
    // Combine: upper (16 bytes) + lower (16 bytes) = 32 bytes
    const lowerHex = lowerBytes.toString(16).padStart(32, '0');
    const upperHex = upperBytes.toString(16).padStart(32, '0');
    
    return `0x${upperHex}${lowerHex}` as `0x${string}`;
  }, [uploadedProofs]);
  
  // Compute message hash for signature: keccak256(abi.encodePacked(channelId, finalStateRoot))
  const computedMessageHash = useMemo(() => {
    if (!selectedChannelId || !finalStateRoot) return null;
    
    try {
      const channelIdBigInt = BigInt(selectedChannelId);
      const messageHash = keccak256(encodePacked(
        ['uint256', 'bytes32'],
        [channelIdBigInt, finalStateRoot]
      ));
      
      console.log('=== SIGNATURE MESSAGE COMPUTATION ===');
      console.log('Channel ID:', selectedChannelId);
      console.log('Channel ID (BigInt):', channelIdBigInt.toString());
      console.log('Final State Root:', finalStateRoot);
      console.log('Computed Message Hash:', messageHash);
      console.log('====================================');
      
      return messageHash;
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
      3: 'Closing',
      4: 'Closed'
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
      const jsonData = JSON.parse(text) as RawProofJson;
      
      // Validate required proof fields for new format
      const requiredFields = ['proof_entries_part1', 'proof_entries_part2', 'a_pub_user', 'a_pub_block', 'a_pub_function'];
      const missingFields = requiredFields.filter(field => !jsonData[field as keyof RawProofJson]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required proof fields: ${missingFields.join(', ')}`);
      }
      
      // Validate array structures
      if (!Array.isArray(jsonData.proof_entries_part1) || !Array.isArray(jsonData.proof_entries_part2)) {
        throw new Error('proof_entries_part1 and proof_entries_part2 must be arrays');
      }
      if (!Array.isArray(jsonData.a_pub_user) || !Array.isArray(jsonData.a_pub_block) || !Array.isArray(jsonData.a_pub_function)) {
        throw new Error('a_pub_user, a_pub_block, and a_pub_function must be arrays');
      }
      
      // Concatenate public inputs: a_pub_user + a_pub_block + a_pub_function
      const publicInputsRaw = [...jsonData.a_pub_user, ...jsonData.a_pub_block, ...jsonData.a_pub_function];
      
      console.log('=== PUBLIC INPUTS DEBUG ===');
      console.log('a_pub_user length:', jsonData.a_pub_user.length);
      console.log('a_pub_block length:', jsonData.a_pub_block.length);
      console.log('a_pub_function length:', jsonData.a_pub_function.length);
      console.log('Total publicInputsRaw length:', publicInputsRaw.length);
      console.log('First 5 a_pub_function elements:', jsonData.a_pub_function.slice(0, 5));
      console.log('Function data at indices 66-71 in final array:', publicInputsRaw.slice(66, 72));
      console.log('Function data starting at index 64 (first 10):', publicInputsRaw.slice(64, 74));
      console.log('============================');
      
      // Convert and validate proof data
      // Note: smax is fixed at 256, function signature and preprocess data are extracted by the contract
      const newProofData: ProofData = {
        proofPart1: jsonData.proof_entries_part1.map((x: string) => BigInt(x)),
        proofPart2: jsonData.proof_entries_part2.map((x: string) => BigInt(x)),
        publicInputs: publicInputsRaw.map((x: string) => BigInt(x)),
        smax: BigInt(256),
        functions: []
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

  // Handle verified proofs ZIP upload (from state explorer download)
  const handleVerifiedProofsZipUpload = async (file: File) => {
    try {
      setProofError('');
      setIsProcessingZip(true);
      
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Get all file paths
      const allFiles = Object.keys(zip.files).filter(name => !name.endsWith('/'));
      
      // Find proof folders (proof_1, proof_2, etc.)
      // Structure: channel-{id}-all-verified-proofs/proof_N/
      const proofFolders = new Map<number, { proofJson: string | null; instanceJson: string | null }>();
      
      for (const filePath of allFiles) {
        const parts = filePath.split('/');
        // Look for proof_N folder pattern
        const proofFolderMatch = parts.find(p => /^proof_\d+$/i.test(p));
        if (proofFolderMatch) {
          const proofNumber = parseInt(proofFolderMatch.replace(/proof_/i, ''), 10);
          const fileName = parts[parts.length - 1].toLowerCase();
          
          if (!proofFolders.has(proofNumber)) {
            proofFolders.set(proofNumber, { proofJson: null, instanceJson: null });
          }
          
          const entry = proofFolders.get(proofNumber)!;
          if (fileName === 'proof.json') {
            entry.proofJson = filePath;
          } else if (fileName === 'instance.json') {
            entry.instanceJson = filePath;
          }
        }
      }
      
      if (proofFolders.size === 0) {
        throw new Error('No proof folders found. Expected format: proof_1/, proof_2/, etc.');
      }
      
      // Sort by proof number and process
      const sortedProofNumbers = Array.from(proofFolders.keys()).sort((a, b) => a - b);
      const newProofs: UploadedProof[] = [];
      
      // Check if we have room for all proofs
      const availableSlots = 5 - uploadedProofs.length;
      if (sortedProofNumbers.length > availableSlots) {
        throw new Error(`Cannot add ${sortedProofNumbers.length} proofs. Only ${availableSlots} slots available (max 5 total).`);
      }
      
      for (const proofNumber of sortedProofNumbers) {
        const entry = proofFolders.get(proofNumber)!;
        
        if (!entry.proofJson || !entry.instanceJson) {
          throw new Error(`proof_${proofNumber}: Missing ${!entry.proofJson ? 'proof.json' : 'instance.json'}`);
        }
        
        // Read proof.json
        const proofFile = zip.file(entry.proofJson);
        if (!proofFile) {
          throw new Error(`Cannot read proof.json from proof_${proofNumber}`);
        }
        const proofContent = await proofFile.async('string');
        const proofData = JSON.parse(proofContent);
        
        // Read instance.json
        const instanceFile = zip.file(entry.instanceJson);
        if (!instanceFile) {
          throw new Error(`Cannot read instance.json from proof_${proofNumber}`);
        }
        const instanceContent = await instanceFile.async('string');
        const instanceData = JSON.parse(instanceContent);
        
        // Validate required fields
        if (!proofData.proof_entries_part1 || !Array.isArray(proofData.proof_entries_part1)) {
          throw new Error(`proof_${proofNumber}: Invalid proof.json - missing proof_entries_part1`);
        }
        if (!proofData.proof_entries_part2 || !Array.isArray(proofData.proof_entries_part2)) {
          throw new Error(`proof_${proofNumber}: Invalid proof.json - missing proof_entries_part2`);
        }
        if (!instanceData.a_pub_user || !Array.isArray(instanceData.a_pub_user)) {
          throw new Error(`proof_${proofNumber}: Invalid instance.json - missing a_pub_user`);
        }
        if (!instanceData.a_pub_block || !Array.isArray(instanceData.a_pub_block)) {
          throw new Error(`proof_${proofNumber}: Invalid instance.json - missing a_pub_block`);
        }
        if (!instanceData.a_pub_function || !Array.isArray(instanceData.a_pub_function)) {
          throw new Error(`proof_${proofNumber}: Invalid instance.json - missing a_pub_function`);
        }
        
        // Combine proof and instance data
        const publicInputsRaw = [...instanceData.a_pub_user, ...instanceData.a_pub_block, ...instanceData.a_pub_function];
        
        const newProofData: ProofData = {
          proofPart1: proofData.proof_entries_part1.map((x: string) => BigInt(x)),
          proofPart2: proofData.proof_entries_part2.map((x: string) => BigInt(x)),
          publicInputs: publicInputsRaw.map((x: string) => BigInt(x)),
          smax: BigInt(256),
          functions: []
        };
        
        // Create virtual file for display
        const virtualFile = new File(
          [JSON.stringify({ ...proofData, ...instanceData }, null, 2)],
          `proof_${proofNumber}.json`,
          { type: 'application/json' }
        );
        
        newProofs.push({
          id: `proof_${Date.now()}_${proofNumber}_${Math.random().toString(36).substr(2, 9)}`,
          file: virtualFile,
          data: newProofData
        });
      }
      
      setUploadedProofs(prev => [...prev, ...newProofs]);
      
    } catch (error) {
      console.error('Error processing verified proofs ZIP:', error);
      setProofError(error instanceof Error ? error.message : 'Failed to process verified proofs ZIP');
    } finally {
      setIsProcessingZip(false);
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
  
  // View formatted JSON in new tab
  const viewFormattedJson = (proof: UploadedProof) => {
    // Convert BigInt values back to hex strings for display
    const formattedData = {
      proof_entries_part1: proof.data.proofPart1.map(n => '0x' + n.toString(16)),
      proof_entries_part2: proof.data.proofPart2.map(n => '0x' + n.toString(16)),
      a_pub_user: proof.data.publicInputs.slice(0, 40).map(n => '0x' + n.toString(16)),
      a_pub_block: proof.data.publicInputs.slice(40, 64).map(n => '0x' + n.toString(16)),
      a_pub_function: proof.data.publicInputs.slice(64).map(n => '0x' + n.toString(16)),
      _metadata: {
        fileName: proof.file.name,
        totalPublicInputs: proof.data.publicInputs.length,
        smax: proof.data.smax.toString(),
        generatedAt: new Date().toISOString()
      }
    };
    
    // Create a blob and open in new tab
    const jsonString = JSON.stringify(formattedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };
  
  // Template download handlers
  const handleDownloadProofTemplate = () => {
    const template = {
      proof_entries_part1: [
        "0x121663f41d6fa5c8cb9cd49c8fcae320",
        "0x1333f45f71fbcad419367b462ad0e90f"
      ],
      proof_entries_part2: [
        "0x997ff8d20d3e32eb45cc8e5596b4015580120048c97e03ab4bb3db8986f6ec07",
        "0xc3ebbf2e66143e6f9adc26a14e1ac50df1556f7c9d5205457bea00772276e12b"
      ],
      a_pub_user: [
        "0x00", "0x00", "0x00", "0x00", "0x00", "0x00", "0x00", "0x00",
        "0x5c1103c2056371f62b88ecd6b08b7b3b",
        "0x531702f2c7452fc52ecdbd305c08929f",
        "0x89a9a9e9ccdff791c018ef5b70111143",
        "0x0d35f1c31abb040057c5ed5057e7c501",
        "0x00", "0x00", "0x00", "0x00", "0x00", "0x00", "0x00", "0x00",
        "0x00", "0x00", "0x00", "0x00", "0x00", "0x00", "0x00", "0x00",
        "0x00", "0x00", "0x00", "0x00", "0x00", "0x00", "0x00", "0x00",
        "0x00", "0x00", "0x00", "0x00"
      ],
      a_pub_block: [
        "0x4e7256340cc820415a6022a7d1c93a35", "0x5cc0dde1",
        "0x69297a5c", "0x00", "0x945f42", "0x00",
        "0x00", "0x00", "0x00", "0x00", "0x00", "0x00",
        "0x00", "0x00", "0x00", "0x00", "0x00", "0x00",
        "0x00", "0x00", "0x00", "0x00", "0x00", "0x00"
      ],
      a_pub_function: [
        "0x01", "0xffffffffffffffffffffffffffffffff", "0xffffffff",
        "0x00", "0x00", "0x00", "0x00", "0x00"
      ],
      _template_info: {
        description: "Template for individual proof data submission (new format)",
        notes: [
          "Replace all placeholder values with your actual proof data",
          "IMPORTANT: Each file should contain exactly ONE proof",
          "Upload separate files for each proof (max 5 total)",
          "Drag and drop to reorder proofs - order matters!",
          "proof_entries_part1/part2: ZK proof components (hex strings, 16 bytes / 32 bytes)",
          "a_pub_user: User public inputs (40 elements) - index 10,11 contain resulting merkle root",
          "a_pub_block: Block public inputs (24 elements)",
          "a_pub_function: Function public inputs (variable length)",
          "Note: smax (256), function signature and preprocess data are handled by the contract",
          "All numeric values should be provided as hex strings"
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
  
  // Check if channel is in correct state for proof submission (Open=2)
  const isChannelStateValid = channelInfo && Number(channelInfo[1]) === 2;
  
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

      <div className="ml-0 lg:ml-72 transition-all duration-300 min-h-screen space-background flex flex-col">
        <main className="px-4 py-8 lg:px-8 flex-1">
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
                  <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
                    <button
                      onClick={handleDownloadProofTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-[#4fc3f7] rounded-lg hover:bg-[#4fc3f7]/20 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download Single Proof Template
                    </button>
                    
                    {/* Auto-format from State Explorer ZIP */}
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/50 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept=".zip"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) await handleVerifiedProofsZipUpload(file);
                          e.target.value = ''; // Reset input
                        }}
                        className="hidden"
                        disabled={isProcessingZip}
                      />
                      {isProcessingZip ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FolderArchive className="h-4 w-4" />
                          Import from State Explorer ZIP
                        </>
                      )}
                    </label>
                  </div>
                  
                  {/* Info about ZIP import */}
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <FolderArchive className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-purple-300 font-medium mb-1">Auto-format from State Explorer</p>
                        <p className="text-purple-400/80">
                          Upload the ZIP file downloaded from State Explorer's "Download Verified Proofs" button. 
                          The proofs will be automatically formatted and added in order.
                        </p>
                      </div>
                    </div>
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
                                      Inputs: {proof.data.publicInputs.length} elements
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    viewFormattedJson(proof);
                                  }}
                                  className="text-[#4fc3f7] hover:text-[#029bee] p-1 transition-colors"
                                  title="View formatted JSON"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </button>
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
                        Channel must be in "Open" state. Current: {getChannelStateDisplay(Number(channelInfo[1]))}
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