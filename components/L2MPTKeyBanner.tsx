'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Key, Calculator, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { ethers } from 'ethers';
import { generateMptKeyFromWallet } from '@/lib/mptKeyUtils';

interface L2MPTKeyBannerProps {
  className?: string;
}

interface ComputedKey {
  channelId: number;
  tokenAddress: string;
  mptKey: string;
}

export function L2MPTKeyBanner({ className }: L2MPTKeyBannerProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [channelId, setChannelId] = useState<number>(1);
  const [tokenAddress, setTokenAddress] = useState('0xa30fe40285B8f5c0457DbC3B7C8A280373c40044'); // TON token
  const [computedKeys, setComputedKeys] = useState<ComputedKey[]>([]);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string>('');

  // Reset error when inputs change
  useEffect(() => {
    setError('');
  }, [channelId, tokenAddress]);

  const computeMPTKey = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    setIsComputing(true);
    setError('');

    try {
      // Create a deterministic message for the user to sign
      // This message includes the channel ID and token address to make it unique
      const message = `Generate MPT Key for Channel ${channelId} with token ${tokenAddress}\n\nThis signature is used to derive your L2 MPT key deterministically.\nSigning this message is safe and does not give anyone access to your funds.`;
      
      // Request user to sign the message
      const signature = await signMessageAsync({ message });
      
      // Use the signature to derive a deterministic private key
      // Hash the signature to get a deterministic seed
      const signatureHash = ethers.keccak256(ethers.toUtf8Bytes(signature));
      const privateKeyBigInt = BigInt(signatureHash) % BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'); // secp256k1 order
      const privateKeyHex = '0x' + privateKeyBigInt.toString(16).padStart(64, '0');
      
      // Create a wallet from the derived private key
      const wallet = new ethers.Wallet(privateKeyHex);
      
      // Generate MPT key using the derived wallet
      const mptKey = generateMptKeyFromWallet(
        wallet,
        channelId,
        tokenAddress
      );

      const newKey: ComputedKey = {
        channelId,
        tokenAddress,
        mptKey
      };

      setComputedKeys(prev => [newKey, ...prev.slice(0, 4)]); // Keep only 5 most recent
      
      setError(''); // Clear any previous errors

    } catch (err) {
      if (err instanceof Error && err.message.includes('User rejected')) {
        setError('Signature cancelled by user');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to compute MPT key');
      }
    } finally {
      setIsComputing(false);
    }
  };

  const copyToClipboard = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const removeKey = (index: number) => {
    setComputedKeys(prev => prev.filter((_, i) => i !== index));
  };

  if (!isConnected) return null;

  return (
    <div className={`bg-gradient-to-r from-[#4fc3f7]/10 to-[#029bee]/10 border border-[#4fc3f7]/30 ${className || ''}`}>
      <div className="p-4">
        {/* Banner Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 flex items-center justify-center">
              <Key className="w-5 h-5 text-[#4fc3f7]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">L2 MPT Key Generator</h3>
              <p className="text-sm text-gray-300">
                Compute Merkle Patricia Tree keys for your deposits
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#029bee] transition-colors flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            {isExpanded ? 'Hide' : 'Generate Keys'}
          </button>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-6 space-y-4">
            {/* Input Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Channel ID
                </label>
                <input
                  type="number"
                  min="1"
                  value={channelId}
                  onChange={(e) => setChannelId(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:ring-[#4fc3f7] focus:border-[#4fc3f7] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Token Address
                </label>
                <select
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:ring-[#4fc3f7] focus:border-[#4fc3f7] focus:outline-none"
                >
                  <option value="0xa30fe40285B8f5c0457DbC3B7C8A280373c40044">TON Token</option>
                </select>
              </div>
            </div>
        

            {/* Generate Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={computeMPTKey}
                disabled={isComputing}
                className="px-6 py-3 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Calculator className="w-4 h-4" />
                {isComputing ? 'Computing...' : 'Generate MPT Key'}
              </button>

              {error && (
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              )}
            </div>

            {/* Generated Keys */}
            {computedKeys.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-white">Generated Keys</h4>
                <div className="space-y-2">
                  {computedKeys.map((key, index) => (
                    <div
                      key={`${key.mptKey}-${index}`}
                      className="bg-[#0a1930]/80 border border-[#4fc3f7]/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 text-[#4fc3f7] text-xs">
                              Alice
                            </span>
                            <span className="px-2 py-1 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 text-[#4fc3f7] text-xs">
                              Channel {key.channelId}
                            </span>
                            <span className="px-2 py-1 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 text-[#4fc3f7] text-xs">
                              TON
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 mb-1">MPT Key:</p>
                          <p className="font-mono text-xs text-white break-all bg-black/30 p-2 border border-[#4fc3f7]/20">
                            {key.mptKey}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(key.mptKey)}
                            className="p-2 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 text-[#4fc3f7] hover:bg-[#4fc3f7]/30 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedKey === key.mptKey ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => removeKey(index)}
                            className="p-2 bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Instructions */}
            <div className="bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 p-4">
              <h4 className="font-semibold text-[#4fc3f7] mb-2">How to use generated keys:</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• These are real L2MPT keys generated using JubJub cryptography</li>
                <li>• Copy the generated MPT key and paste it into the "L2 MPT Key" field when making deposits</li>
                <li>• Ensure the channel ID matches your deposit parameters</li>
                <li>• Each unique combination of wallet address, channel ID, and token generates a different key deterministically</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}