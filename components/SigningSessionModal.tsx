'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Hash, Users, Key as KeyIcon } from 'lucide-react';
import { hashKeccak256 } from '@/lib/frost-wasm';
import { get_key_package_metadata } from '@/lib/wasm/pkg/tokamak_frost_wasm';

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
  const [messageToSign, setMessageToSign] = useState('');
  const [messageHash, setMessageHash] = useState('');
  const [rosterFromPackage, setRosterFromPackage] = useState<string[]>([]);

  // Extract roster from key package when modal opens (same as DKG management)
  useEffect(() => {
    if (isOpen && keyPackageData?.keyPackageHex) {
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
    }
  }, [isOpen, keyPackageData]);

  // Auto-compute hash when message changes
  useEffect(() => {
    if (messageToSign.trim()) {
      try {
        const hash = hashKeccak256(messageToSign);
        setMessageHash(hash);
      } catch (e) {
        console.error('Failed to compute hash:', e);
        setMessageHash('');
      }
    } else {
      setMessageHash('');
    }
  }, [messageToSign]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMessageToSign('');
      setMessageHash('');
      setRosterFromPackage([]);
    }
  }, [isOpen]);

  if (!isOpen || !keyPackageData) return null;

  const handleSubmit = () => {
    if (!messageToSign || !messageHash) {
      alert('Please enter a message to sign');
      return;
    }

    if (rosterFromPackage.length === 0) {
      alert('No participants found in key package');
      return;
    }

    onCreateSession({
      groupId: keyPackageData!.groupId,
      threshold: keyPackageData!.threshold,
      message: messageToSign,
      messageHash: messageHash,
      groupVk: keyPackageData!.groupPublicKeyHex,
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

          {/* Message to Sign */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              Message to Sign
            </label>
            <textarea
              value={messageToSign}
              onChange={(e) => setMessageToSign(e.target.value)}
              placeholder="Enter the message you want to sign..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500"
              autoFocus
            />
            {messageToSign && (
              <p className="text-xs text-gray-400 mt-2">
                {messageToSign.length} characters
              </p>
            )}
          </div>

          {/* Message Hash - Auto-computed */}
          {messageHash && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Hash className="w-4 h-4 text-green-400" />
                Message Hash (Keccak256)
              </label>
              <div className="bg-green-900/20 border border-green-500/50 p-3">
                <p className="font-mono text-xs text-green-400 break-all">
                  {messageHash}
                </p>
              </div>
            </div>
          )}

          {/* Participant Roster from Key Package */}
          {rosterFromPackage.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Users className="w-4 h-4 text-purple-400" />
                Participants from Key Package
              </label>
              <p className="text-xs text-gray-400 mb-3">
                {rosterFromPackage.length} participant(s) found (Threshold: {keyPackageData?.threshold})
              </p>
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
            disabled={!isAuthenticated || !messageToSign || !messageHash}
            className="flex-1 px-6 py-3 bg-[#028bee] hover:bg-[#0277d4] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold transition-all"
          >
            {!isAuthenticated ? 'Not Authenticated' : 'Create Signing Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

