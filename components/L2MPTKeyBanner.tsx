"use client";

import { useState, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Key, Calculator, AlertCircle, Copy, CheckCircle2 } from "lucide-react";
import { L2_PRV_KEY_MESSAGE } from "@/lib/l2KeyMessage";
import { deriveL2KeysAndAddressFromSignature, DerivedL2Account } from "@/lib/mptKeyUtils";
interface L2MPTKeyBannerProps {
  className?: string;
}

interface ComputedKey {
  channelId: number;
  slotIndex: number;
  accountL2: DerivedL2Account; 
}

export function L2MPTKeyBanner({ className }: L2MPTKeyBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [channelId, setChannelId] = useState<number>(0);
  const [slotIndex, setSlotIndex] = useState<number>(0);
  const [computedKeys, setComputedKeys] = useState<ComputedKey[]>([]);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string>("");
  const [copiedAddress, setCopiedAddress] = useState<string>("");
  const { signMessageAsync } = useSignMessage();
  const { address, isConnected } = useAccount();

  // Reset error when inputs change
  useEffect(() => {
    setError("");
  }, [channelId]);

  const computeMPTKey = async () => {
    if (!isConnected || !address) {
      setError("Please connect your wallet first");
      return;
    }

    // Additional check for signMessageAsync availability (Firefox fix)
    if (!signMessageAsync) {
      setError("Wallet signing not available. Please reconnect your wallet.");
      return;
    }

    setIsComputing(true);
    setError("");

    try {
      const message = L2_PRV_KEY_MESSAGE + `${channelId}`;
      
      // Try to sign with additional error handling for Firefox
      const signature = await signMessageAsync({message});
      
      const accountL2 = deriveL2KeysAndAddressFromSignature(signature, slotIndex);

      const newKey: ComputedKey = {
        channelId,
        slotIndex,
        accountL2,
      };

      setComputedKeys((prev) => [newKey, ...prev.slice(0, 4)]); // Keep only 5 most recent

      setError(""); // Clear any previous errors
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("User rejected")) {
          setError("Signature cancelled by user");
        } else if (err.message.includes("ConnectorNotFoundError") || err.message.includes("Connector not found")) {
          setError("Wallet connection lost. Please disconnect and reconnect your wallet.");
        } else if (err.message.includes("ChainMismatchError")) {
          setError("Wrong network. Please switch to the correct network.");
        } else {
          setError(`Error: ${err.message}`);
        }
      } else {
        setError("Failed to compute MPT key. Please try again.");
      }
    } finally {
      setIsComputing(false);
    }
  };

  const copyToClipboard = async (key: string) => {
    try {
      // Check if clipboard API is available (Firefox may have restrictions)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(key);
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = key;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    } catch (err) {
      setError("Failed to copy to clipboard. Please copy manually.");
    }
  };

  const copyAddressToClipboard = async (address: string) => {
    try {
      // Check if clipboard API is available (Firefox may have restrictions)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = address;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(""), 2000);
    } catch (err) {
      setError("Failed to copy address to clipboard. Please copy manually.");
    }
  };

  const removeKey = (index: number) => {
    setComputedKeys((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      className={`bg-gradient-to-r from-[#4fc3f7]/10 to-[#029bee]/10 border border-[#4fc3f7]/30 ${
        className || ""
      }`}
    >
      <div className="p-4">
        {/* Banner Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 flex items-center justify-center">
              <Key className="w-5 h-5 text-[#4fc3f7]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                L2 MPT Key Generator
              </h3>
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
            {isExpanded ? "Hide" : "Generate Keys"}
          </button>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-6 space-y-4">
            {/* Input Form */}
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Channel ID
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={channelId}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      // Allow 0 and positive integers, default to 0 for invalid input
                      setChannelId(isNaN(value) ? 0 : Math.max(0, value));
                    }
                    }
                    className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:ring-[#4fc3f7] focus:border-[#4fc3f7] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Slot Index
                  </label>
                  <select
                    value={slotIndex}
                    onChange={(e) =>
                      setSlotIndex(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:ring-[#4fc3f7] focus:border-[#4fc3f7] focus:outline-none"
                  >
                    <option value="0xa30fe40285B8f5c0457DbC3B7C8A280373c40044">
                      TON Token
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={computeMPTKey}
                disabled={isComputing || !isConnected || !address || !signMessageAsync}
                className="px-6 py-3 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Calculator className="w-4 h-4" />
                {isComputing ? "Computing..." : "Generate MPT Key"}
              </button>
              
              {/* Connection Status Indicator */}
              {isConnected && address ? (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Wallet Connected
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  Wallet Not Connected
                </div>
              )}

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
                <h4 className="text-lg font-semibold text-white">
                  Generated Keys
                </h4>
                <div className="space-y-2">
                  {computedKeys.map((key, index) => (
                    <div
                      key={`${key.accountL2.mptKey}-${index}`}
                      className="bg-[#0a1930]/80 border border-[#4fc3f7]/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 text-[#4fc3f7] text-xs">
                              Channel {key.channelId}
                            </span>
                            <span className="px-2 py-1 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 text-[#4fc3f7] text-xs">
                              TON
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm text-gray-300 mb-1">
                                L2 Address:
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="flex-1 font-mono text-xs text-white break-all bg-black/30 p-2 border border-[#4fc3f7]/20">
                                  {key.accountL2.l2Address}
                                </p>
                                <button
                                  onClick={() =>
                                    copyAddressToClipboard(
                                      key.accountL2.l2Address
                                    )
                                  }
                                  className="p-2 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 text-[#4fc3f7] hover:bg-[#4fc3f7]/30 transition-colors flex-shrink-0"
                                  title="Copy L2 Address"
                                >
                                  {copiedAddress === key.accountL2.l2Address ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-gray-300 mb-1">
                                MPT Key:
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="flex-1 font-mono text-xs text-white break-all bg-black/30 p-2 border border-[#4fc3f7]/20">
                                  {key.accountL2.mptKey}
                                </p>
                                <button
                                  onClick={() =>
                                    copyToClipboard(key.accountL2.mptKey)
                                  }
                                  className="p-2 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 text-[#4fc3f7] hover:bg-[#4fc3f7]/30 transition-colors flex-shrink-0"
                                  title="Copy MPT Key"
                                >
                                  {copiedKey === key.accountL2.mptKey ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start">
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
              <h4 className="font-semibold text-[#4fc3f7] mb-2">
                How to use generated keys:
              </h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>
                  • Keys are generated client-side using JubJub cryptography and
                  Poseidon hash
                </li>
                <li>
                  • Copy the generated MPT key and paste it into the "L2 MPT
                  Key" field when making deposits
                </li>
                <li>• Ensure the channel ID matches your deposit parameters</li>
                <li>
                  • Each unique combination of wallet address, channel ID, and
                  token generates a different key deterministically
                </li>
                <li>
                  • Your private key never leaves your browser - all computation
                  is done locally
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
