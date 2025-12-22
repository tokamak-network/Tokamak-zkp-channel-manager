'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Hash, Users, Key as KeyIcon, Calculator } from 'lucide-react';
import { hashKeccak256 } from '@/lib/frost-wasm';
import { get_key_package_metadata } from '@/lib/wasm/pkg/tokamak_frost_wasm';
import { keccak256 as ethersKeccak256 } from 'ethers';

interface SigningSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  keyPackageData: {
    id: string;
    groupId: string;
    threshold: number;
    total: number;
    keyPackageHex: string;
    groupPublicKeyHex: string;
  } | null;
  onCreateSession: (data: {
    groupId: string;
    threshold: number;
    message: string;
    messageHash: string;
    groupVk: string;
    roster: string[];
  }) => void;
  isAuthenticated: boolean;
}

export function SigningSessionModal({
  isOpen,
  onClose,
  keyPackageData,
  onCreateSession,
  isAuthenticated
}: SigningSessionModalProps) {
  const [channelId, setChannelId] = useState('');
  const [finalStateRoot, setFinalStateRoot] = useState('');
  const [packedData, setPackedData] = useState('');
  const [previewHash, setPreviewHash] = useState('');
  const [rosterFromPackage, setRosterFromPackage] = useState<string[]>([]);

  // Extract roster from key package or imported session when modal opens
  useEffect(() => {
    if (isOpen && keyPackageData) {
      if (keyPackageData.keyPackageHex) {
        // Real key package - extract roster from metadata
        try {
          const metadata = JSON.parse(get_key_package_metadata(keyPackageData.keyPackageHex));
          console.log('📦 Key package metadata:', metadata);
          
          // Extract roster as array of public keys (same as DKG management)
          const pubkeys = Object.values(metadata.roster) as string[];
          
          console.log('📋 Roster public keys:', pubkeys);
          setRosterFromPackage(pubkeys);
        } catch (e) {
          console.error('Failed to extract roster from key package:', e);
          setRosterFromPackage([]);
        }
      } else {
        // Imported session - use participant roster if available
        console.log('📦 Imported session detected, checking for participant roster...');
        console.log('📋 KeyPackageData:', keyPackageData);
        console.log('📋 ParticipantRoster check:', {
          hasParticipantRoster: !!(keyPackageData as any).participantRoster,
          participantRosterLength: (keyPackageData as any).participantRoster?.length || 0,
          participantRoster: (keyPackageData as any).participantRoster
        });
        
        // Check if the imported session has a participant roster (from new DKG output format)
        if ((keyPackageData as any).participantRoster && (keyPackageData as any).participantRoster.length > 0) {
          console.log('✅ Using participant roster from imported session:', (keyPackageData as any).participantRoster);
          setRosterFromPackage((keyPackageData as any).participantRoster);
        } else {
          // Fallback: generate participant IDs based on session data for older imports
          console.log('⚠️ No participant roster found, generating placeholder participant IDs...');
          
          const participantIds: string[] = [];
          for (let i = 1; i <= keyPackageData.total; i++) {
            participantIds.push(`participant_${i}`);
          }
          
          console.log('📋 Generated participant IDs for imported session:', participantIds);
          setRosterFromPackage(participantIds);
        }
      }
    }
  }, [isOpen, keyPackageData]);

  // Calculate abi.encodePacked(channelId, finalStateRoot) and preview hash
  useEffect(() => {
    try {
      if (channelId && finalStateRoot) {
        // Validate channelId is a valid number
        const channelIdNum = parseInt(channelId);
        if (isNaN(channelIdNum) || channelIdNum < 0) {
          setPackedData('');
          setPreviewHash('');
          return;
        }
        
        // Validate finalStateRoot is a valid hex string (32 bytes)
        const cleanStateRoot = finalStateRoot.startsWith('0x') ? finalStateRoot : `0x${finalStateRoot}`;
        if (!/^0x[a-fA-F0-9]{64}$/.test(cleanStateRoot)) {
          setPackedData('');
          setPreviewHash('');
          return;
        }

        // Create abi.encodePacked equivalent
        // For uint256: pad to 32 bytes, for bytes32: use as-is
        const channelIdHex = BigInt(channelIdNum).toString(16).padStart(64, '0');
        const stateRootHex = cleanStateRoot.slice(2);
        const packed = `0x${channelIdHex}${stateRootHex}` as `0x${string}`;
        
        setPackedData(packed);
        
        // Compute preview hash (what the server will compute)
        const hash = ethersKeccak256(packed);
        setPreviewHash(hash);
      } else {
        setPackedData('');
        setPreviewHash('');
      }
    } catch (e) {
      console.error('Failed to compute packed data:', e);
      setPackedData('');
      setPreviewHash('');
    }
  }, [channelId, finalStateRoot]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setChannelId('');
      setFinalStateRoot('');
      setPackedData('');
      setPreviewHash('');
      setRosterFromPackage([]);
    }
  }, [isOpen]);

  if (!isOpen || !keyPackageData) return null;

  const handleSubmit = () => {
    if (!channelId || !finalStateRoot || !packedData || !previewHash) {
      alert('Please enter both channelId and finalStateRoot');
      return;
    }

    if (rosterFromPackage.length === 0) {
      alert('No participants found - cannot create signing session');
      return;
    }

    // Ensure groupId is a valid hex string
    let validGroupId = keyPackageData!.groupId;
    
    // Remove any 0x prefix if present
    if (validGroupId.startsWith('0x')) {
      validGroupId = validGroupId.slice(2);
    }
    
    // If it's not a valid hex string (e.g., "group_123456"), convert it to hex
    if (!/^[0-9a-fA-F]+$/.test(validGroupId)) {
      // Convert the string to hex representation
      const encoder = new TextEncoder();
      const bytes = encoder.encode(validGroupId);
      validGroupId = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.log('📝 Converted non-hex groupId to hex:', {
        original: keyPackageData!.groupId,
        converted: validGroupId
      });
    }
    
    // Remove 0x prefix for server compatibility
    const cleanMessage = packedData.startsWith('0x') ? packedData.slice(2) : packedData;
    const cleanMessageHash = previewHash.startsWith('0x') ? previewHash.slice(2) : previewHash;
    const cleanGroupVk = keyPackageData!.groupPublicKeyHex.startsWith('0x') ? keyPackageData!.groupPublicKeyHex.slice(2) : keyPackageData!.groupPublicKeyHex;
    
    console.log('📤 Sending session data:', {
      message: cleanMessage,
      messageHash: cleanMessageHash,
      groupVk: cleanGroupVk,
      groupId: validGroupId,
      threshold: keyPackageData!.threshold
    });
    
    onCreateSession({
      groupId: validGroupId,
      threshold: keyPackageData!.threshold,
      message: cleanMessage, // Send the packed data without 0x prefix
      messageHash: cleanMessageHash, // Send hash without 0x prefix
      groupVk: cleanGroupVk, // Send group verification key without 0x prefix
      roster: rosterFromPackage
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border-2 border-blue-500 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Create Signing Session</h2>
            <p className="text-sm text-gray-400 mt-1">Using key package: {keyPackageData.groupId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Key Package Info */}
          <div className="bg-blue-900/20 border border-blue-500/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <KeyIcon className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-blue-400">Key Package Details</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Group ID:</span>
                <span className="ml-2 text-white font-mono">{keyPackageData.groupId}</span>
              </div>
              <div>
                <span className="text-gray-400">Threshold:</span>
                <span className="ml-2 text-white font-semibold">{keyPackageData.threshold}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400">Group Public Key:</span>
                <p className="mt-1 text-white font-mono text-xs break-all bg-gray-800 p-2">
                  {keyPackageData.groupPublicKeyHex}
                </p>
              </div>
            </div>
          </div>

          {/* Channel ID Input */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Calculator className="w-4 h-4 text-blue-400" />
              Channel ID
            </label>
            <input
              type="number"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Enter channel ID (e.g., 123)"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500"
              autoFocus
            />
          </div>

          {/* Final State Root Input */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Hash className="w-4 h-4 text-purple-400" />
              Final State Root
            </label>
            <input
              type="text"
              value={finalStateRoot}
              onChange={(e) => setFinalStateRoot(e.target.value)}
              placeholder="Enter final state root (0x...)"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              Must be a 32-byte hex string (66 characters including 0x)
            </p>
          </div>

          {/* Packed Data - Auto-computed */}
          {packedData && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                <MessageSquare className="w-4 h-4 text-orange-400" />
                abi.encodePacked(channelId, finalStateRoot)
              </label>
              <div className="bg-orange-900/20 border border-orange-500/50 p-3">
                <p className="font-mono text-xs text-orange-400 break-all">
                  {packedData}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                This packed data will be sent to the server for signing
              </p>
            </div>
          )}

          {/* Preview Hash */}
          {previewHash && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Hash className="w-4 h-4 text-green-400" />
                Preview: keccak256(abi.encodePacked(...))
              </label>
              <div className="bg-green-900/20 border border-green-500/50 p-3">
                <p className="font-mono text-xs text-green-400 break-all">
                  {previewHash}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                This is what the server will compute and actually sign
              </p>
            </div>
          )}

          {/* Participant Roster from Key Package */}
          {rosterFromPackage.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Users className="w-4 h-4 text-purple-400" />
                Participants {keyPackageData?.keyPackageHex ? 'from Key Package' : 'from Imported Session'}
              </label>
              <p className="text-xs text-gray-400 mb-3">
                {rosterFromPackage.length} participant(s) found (Threshold: {keyPackageData?.threshold})
              </p>
              {!keyPackageData?.keyPackageHex && rosterFromPackage.length > 0 && rosterFromPackage[0]?.startsWith('participant_') && (
                <div className="mb-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                  <p className="text-xs text-red-300">
                    ⚠️ <strong>Legacy Imported Session:</strong> This session uses placeholder participant IDs. 
                    Signing sessions may fail without real participant public keys. 
                    Use a newer DKG session export with participant roster for better compatibility.
                  </p>
                </div>
              )}
              {!keyPackageData?.keyPackageHex && rosterFromPackage.length > 0 && !rosterFromPackage[0]?.startsWith('participant_') && (
                <div className="mb-3 p-3 bg-green-900/20 border border-green-500/50 rounded-lg">
                  <p className="text-xs text-green-300">
                    ✅ <strong>Modern Imported Session:</strong> This session includes participant public keys 
                    and can be used to create signing sessions.
                  </p>
                </div>
              )}
              <div className="bg-purple-900/20 border border-purple-500/50 p-4">
                <div className="space-y-2">
                  {rosterFromPackage.map((pubkey, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 font-mono text-xs text-purple-300 break-all bg-gray-800 p-2">
                        {pubkey}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isAuthenticated || !channelId || !finalStateRoot || !packedData || (!keyPackageData?.keyPackageHex && (!rosterFromPackage.length || rosterFromPackage[0]?.startsWith('participant_')))}
            className="flex-1 px-6 py-3 bg-[#028bee] hover:bg-[#0277d4] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold transition-all"
          >
            {!isAuthenticated 
              ? 'Not Authenticated' 
              : !keyPackageData?.keyPackageHex && (!rosterFromPackage.length || rosterFromPackage[0]?.startsWith('participant_'))
                ? 'Cannot Create from Legacy Import'
                : 'Create Signing Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

