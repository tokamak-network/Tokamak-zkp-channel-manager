"use client";

import { useState, useEffect } from "react";
import JSZip from "jszip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  Package,
  Download,
  CheckCircle2,
  Users,
  AlertCircle,
  ArrowRight,
  Key,
  Wallet,
  Coins,
  CheckCircle,
} from "lucide-react";
import {
  getChannel,
  getActiveChannels,
  getLatestSnapshot,
  getChannelUserBalances,
  getChannelParticipants,
  getData,
} from "@/lib/realtime-db-helpers";
import type {
  Channel,
  StateSnapshot,
  UserBalance,
  Participant,
} from "@/lib/firebase-types";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import {
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI,
} from "@/lib/contracts";
import { parseProofFromBase64Zip } from "@/lib/proofAnalyzer";
import { useSignMessage, useAccount } from "wagmi";
import { L2_PRV_KEY_MESSAGE } from "@/lib/l2KeyMessage";

interface TransactionBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultChannelId?: string;
}

interface BundleData {
  channel: Channel | null;
  snapshot: StateSnapshot | null;
  balances: UserBalance[];
  participants: Participant[];
}

type ModalStep = "input" | "summary" | "downloading";

export function TransactionBundleModal({
  isOpen,
  onClose,
  defaultChannelId,
}: TransactionBundleModalProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    defaultChannelId || ""
  );
  const [bundleData, setBundleData] = useState<BundleData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transaction input fields
  const [step, setStep] = useState<ModalStep>("input");
  const [isSigned, setIsSigned] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [signature, setSignature] = useState<`0x${string}` | null>(null);

  // Wagmi hooks for MetaMask signing
  const { signMessageAsync } = useSignMessage();
  const { address, isConnected } = useAccount();

  // Auto-select default channel when modal opens
  useEffect(() => {
    if (isOpen && defaultChannelId) {
      setSelectedChannelId(defaultChannelId);
    }
    // Reset form when modal opens
    if (isOpen) {
      setStep("input");
      setIsSigned(false);
      setSignature(null);
      setToAddress("");
      setTokenAmount("");
      setError(null);
      setDownloadComplete(false);
    }
  }, [isOpen, defaultChannelId]);

  // Fetch bundle data when channel is selected
  useEffect(() => {
    if (selectedChannelId) {
      fetchBundleData(selectedChannelId);
    }
  }, [selectedChannelId]);

  const fetchBundleData = async (channelId: string) => {
    setIsLoading(true);
    setError(null);
    setDownloadComplete(false);

    try {
      const [channel, snapshot, balances, firebaseParticipants] =
        await Promise.all([
          getChannel(channelId),
          getLatestSnapshot(channelId),
          getChannelUserBalances(channelId),
          getChannelParticipants(channelId),
        ]);

      // If Firebase has no participants, try to fetch from smart contract
      let participants = firebaseParticipants;
      if (!participants || participants.length === 0) {
        try {
          const publicClient = createPublicClient({
            chain: sepolia,
            transport: http(
              "https://eth-sepolia.g.alchemy.com/v2/N-Gnpjy1WvCfokwj6fiOfuAVL_At6IvE"
            ),
          });

          const contractParticipants = (await publicClient.readContract({
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: "getChannelParticipants",
            args: [BigInt(channelId)],
          })) as readonly `0x${string}`[];

          // Convert contract addresses to Participant format
          participants = contractParticipants.map((address) => ({
            address: address.toLowerCase(),
          })) as Participant[];
        } catch (contractErr) {
          console.warn(
            "Failed to fetch participants from contract:",
            contractErr
          );
          // Keep empty array if contract fetch also fails
          participants = [];
        }
      }

      setBundleData({
        channel,
        snapshot,
        balances,
        participants,
      });
    } catch (err) {
      console.error("Failed to fetch bundle data:", err);
      setError("Failed to load channel data");
    } finally {
      setIsLoading(false);
    }
  };

  // Sign message with MetaMask
  const handleSign = async () => {
    if (!isConnected || !address) {
      setError("Please connect your wallet first");
      return;
    }

    if (!selectedChannelId) {
      setError("Please select a channel first");
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      const message = L2_PRV_KEY_MESSAGE + selectedChannelId;
      const signedMessage = await signMessageAsync({ message });
      setSignature(signedMessage);
      setIsSigned(true);
    } catch (err) {
      if (err instanceof Error && err.message.includes("User rejected")) {
        setError("Signature cancelled by user");
      } else {
        console.error("Failed to sign:", err);
        setError(
          err instanceof Error ? err.message : "Failed to sign with MetaMask"
        );
      }
      setIsSigned(false);
      setSignature(null);
    } finally {
      setIsSigning(false);
    }
  };

  // Validate all input fields
  const isFormValid = () => {
    return (
      isSigned &&
      toAddress.trim().length > 0 &&
      tokenAmount.trim().length > 0 &&
      !isNaN(Number(tokenAmount)) &&
      Number(tokenAmount) > 0
    );
  };

  // Handle proceed to summary
  const handleProceedToSummary = () => {
    if (isFormValid()) {
      setStep("summary");
      setError(null);
    } else {
      setError("Please fill in all fields correctly");
    }
  };

  // Handle back to input
  const handleBackToInput = () => {
    setStep("input");
    setError(null);
  };

  const handleDownload = async () => {
    if (!selectedChannelId) {
      setError("No channel selected");
      return;
    }

    if (!isFormValid()) {
      setError("Please fill in all fields correctly");
      return;
    }

    setStep("downloading");
    setIsDownloading(true);
    setError(null);

    try {
      // Fetch data if not already loaded
      let channel = bundleData?.channel;
      let snapshot = bundleData?.snapshot;
      let balances = bundleData?.balances || [];
      let participants = bundleData?.participants || [];

      if (!channel) {
        try {
          channel = await getChannel(selectedChannelId);
        } catch (err) {
          console.warn("Failed to load channel from Firebase:", err);
        }
      }
      if (!snapshot) {
        try {
          snapshot = await getLatestSnapshot(selectedChannelId);
        } catch (err) {
          console.warn("Failed to load snapshot:", err);
        }
      }
      if (balances.length === 0) {
        try {
          balances = await getChannelUserBalances(selectedChannelId);
        } catch (err) {
          console.warn("Failed to load balances:", err);
        }
      }
      if (participants.length === 0) {
        try {
          participants = await getChannelParticipants(selectedChannelId);
        } catch (err) {
          console.warn("Failed to load participants:", err);
        }
      }

      const zip = new JSZip();

      // Check if verifiedProofs exists and has content
      let verifiedProofs = null;
      let hasVerifiedProofs = false;
      let latestStateSnapshot = null;

      try {
        verifiedProofs = await getData<any>(
          `channels/${selectedChannelId}/verifiedProofs`
        );

        // Check if verifiedProofs is an object (Firebase structure)
        if (verifiedProofs && typeof verifiedProofs === "object") {
          // Convert to array if it's an object
          const proofsArray = Array.isArray(verifiedProofs)
            ? verifiedProofs
            : Object.entries(verifiedProofs).map(
                ([key, value]: [string, any]) => ({
                  proofId: key,
                  ...value,
                })
              );

          hasVerifiedProofs = proofsArray.length > 0;

          // Find the latest verified proof (highest sequenceNumber)
          if (hasVerifiedProofs) {
            const latestProof = proofsArray.reduce(
              (latest: any, current: any) => {
                if (!latest) return current;
                const latestSeq = latest.sequenceNumber || 0;
                const currentSeq = current.sequenceNumber || 0;
                return currentSeq > latestSeq ? current : latest;
              },
              null
            );

            // Try to get zipFile content - it might be in the proof object or need to be fetched separately
            let zipFileContent = latestProof?.zipFile?.content;

            // If zipFile is not directly in the proof, try to fetch it from Firebase
            if (!zipFileContent && latestProof?.proofId) {
              try {
                const zipFileData = await getData<any>(
                  `channels/${selectedChannelId}/verifiedProofs/${latestProof.proofId}/zipFile`
                );
                zipFileContent = zipFileData?.content;
              } catch (err) {
                console.warn("Failed to fetch zipFile from Firebase:", err);
              }
            }

            // Extract state_snapshot.json from the latest proof's ZIP
            if (zipFileContent) {
              try {
                const { snapshot } = await parseProofFromBase64Zip(
                  zipFileContent
                );
                if (snapshot) {
                  latestStateSnapshot = snapshot;
                }
              } catch (parseErr) {
                console.warn(
                  "Failed to parse ZIP from latest proof:",
                  parseErr
                );
              }
            } else {
              console.warn(
                "No zipFile content found for latest verified proof"
              );
            }
          }
        }
      } catch (err) {
        console.warn("Failed to check verifiedProofs:", err);
      }

      // If verifiedProofs folder is empty or doesn't exist, create channel-info.json only
      if (!hasVerifiedProofs) {
        // Get initializationTxHash from Firebase - try multiple paths and ID formats
        let initializationTxHash = null;

        // Try from channel object first
        if (channel?.initializationTxHash) {
          initializationTxHash = channel.initializationTxHash;
        }

        // Try from initialProof object in channel data
        if (
          !initializationTxHash &&
          channel?.initialProof?.initializationTxHash
        ) {
          initializationTxHash = channel.initialProof.initializationTxHash;
        }

        // Try from getChannel with current ID format
        if (!initializationTxHash) {
          try {
            const channelData = await getChannel(selectedChannelId);
            initializationTxHash =
              channelData?.initializationTxHash ||
              channelData?.initialProof?.initializationTxHash ||
              null;
          } catch (err) {
            console.warn(
              "Failed to get channel data with ID:",
              selectedChannelId,
              err
            );
          }
        }

        // Try from initialProof object path
        if (!initializationTxHash) {
          try {
            const initialProofData = await getData<any>(
              `channels/${selectedChannelId}/initialProof`
            );
            if (initialProofData?.initializationTxHash) {
              initializationTxHash = initialProofData.initializationTxHash;
            }
          } catch (err) {
            console.warn(
              "Failed to get initializationTxHash from initialProof:",
              err
            );
          }
        }

        // Try direct path access with current ID
        if (!initializationTxHash) {
          try {
            const directData = await getData<string>(
              `channels/${selectedChannelId}/initializationTxHash`
            );
            initializationTxHash = directData || null;
          } catch (err) {
            console.warn(
              "Failed to get initializationTxHash from direct path:",
              err
            );
          }
        }

        // Try with numeric ID if current is string
        if (!initializationTxHash && !isNaN(Number(selectedChannelId))) {
          try {
            const numericId = Number(selectedChannelId);
            const channelData = await getChannel(String(numericId));
            initializationTxHash =
              channelData?.initializationTxHash ||
              channelData?.initialProof?.initializationTxHash ||
              null;
          } catch (err) {
            console.warn("Failed to get channel data with numeric ID:", err);
          }
        }

        // Try from initialProof object with numeric ID
        if (!initializationTxHash && !isNaN(Number(selectedChannelId))) {
          try {
            const numericId = Number(selectedChannelId);
            const initialProofData = await getData<any>(
              `channels/${numericId}/initialProof`
            );
            if (initialProofData?.initializationTxHash) {
              initializationTxHash = initialProofData.initializationTxHash;
            }
          } catch (err) {
            console.warn(
              "Failed to get initializationTxHash from initialProof with numeric ID:",
              err
            );
          }
        }

        // Try direct path access with numeric ID
        if (!initializationTxHash && !isNaN(Number(selectedChannelId))) {
          try {
            const numericId = Number(selectedChannelId);
            const directData = await getData<string>(
              `channels/${numericId}/initializationTxHash`
            );
            initializationTxHash = directData || null;
          } catch (err) {
            console.warn(
              "Failed to get initializationTxHash from numeric path:",
              err
            );
          }
        }

        if (initializationTxHash) {
          const transactionInfo = {
            channelId: selectedChannelId,
            initializedTxHash: initializationTxHash,
            toAddress: toAddress.trim(),
            tokenAmount: tokenAmount.trim(),
            signed: isSigned,
            ...(signature && { signature }),
          };
          zip.file(
            "transaction-info.json",
            JSON.stringify(transactionInfo, null, 2)
          );
        } else {
          // More helpful error message
          const errorMsg = `Could not find initialization transaction hash for channel ${selectedChannelId}. The channel may not have been initialized yet. Please ensure the channel has been initialized on the blockchain.`;
          console.error(errorMsg, {
            channelId: selectedChannelId,
            channelIdType: typeof selectedChannelId,
            numericId: Number(selectedChannelId),
            channelData: channel,
            verifiedProofs: hasVerifiedProofs,
          });
          throw new Error(errorMsg);
        }
      } else {
        // If verifiedProofs exists, include state_snapshot.json from latest proof
        // Get initializationTxHash
        let initializationTxHash = null;

        if (channel?.initializationTxHash) {
          initializationTxHash = channel.initializationTxHash;
        } else if (channel?.initialProof?.initializationTxHash) {
          initializationTxHash = channel.initialProof.initializationTxHash;
        } else {
          try {
            const channelData = await getChannel(selectedChannelId);
            initializationTxHash =
              channelData?.initializationTxHash ||
              channelData?.initialProof?.initializationTxHash ||
              null;
          } catch (err) {
            console.warn("Failed to get channel data:", err);
          }
        }

        // Create transaction-info.json
        const transactionInfo = {
          channelId: selectedChannelId,
          initializedTxHash: initializationTxHash || null,
          toAddress: toAddress.trim(),
          tokenAmount: tokenAmount.trim(),
          signed: isSigned,
          ...(signature && { signature }),
        };
        zip.file(
          "transaction-info.json",
          JSON.stringify(transactionInfo, null, 2)
        );

        // Add state_snapshot.json from latest verified proof if available
        if (latestStateSnapshot) {
          zip.file(
            "state_snapshot.json",
            JSON.stringify(latestStateSnapshot, null, 2)
          );
        } else {
          console.warn("No state_snapshot.json found in latest verified proof");
        }
      }

      // Generate and download
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tokamak-channel-${
        channel?.channelId || selectedChannelId
      }-state-v${snapshot?.sequenceNumber || 0}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadComplete(true);
      // Reset after a short delay
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Failed to create bundle:", err);
      setError("Failed to create bundle");
      setStep("summary");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenDesktopApp = () => {
    // Try to open with custom protocol
    // This would need to be registered by the desktop app
    const customProtocolUrl = `tokamak-app://create-transaction`;

    // Try opening with custom protocol
    window.location.href = customProtocolUrl;

    // Fallback: Show instructions
    setTimeout(() => {
      // If we're still here, the protocol didn't work
      // The modal stays open so users can see the instructions
    }, 500);
  };

  const handleClose = () => {
    setDownloadComplete(false);
    setError(null);
    setBundleData(null);
    setStep("input");
    setIsSigned(false);
    setSignature(null);
    setToAddress("");
    setTokenAmount("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="bg-[#4fc3f7] p-1.5 rounded">
              <Package className="h-4 w-4 text-white" />
            </div>
            Create Transaction Bundle
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Download the current state to create an offline transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Current Channel Display */}
          {selectedChannelId && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Channel
              </label>
              <div className="bg-[#0a1930] border border-[#4fc3f7]/30 rounded p-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#4fc3f7]" />
                  <span className="text-white font-mono">
                    Channel #{selectedChannelId}
                  </span>
                  {bundleData?.participants && (
                    <span className="text-gray-400 text-sm">
                      ({bundleData.participants.length} participants)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
              <span className="ml-3 text-gray-400">
                Loading channel data...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Input Step */}
          {step === "input" && selectedChannelId && !isLoading && (
            <div className="space-y-4">
              {/* Private Key Signing */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#4fc3f7]" />
                  Sign with MetaMask
                </label>
                <div className="bg-[#0a1930] border border-[#4fc3f7]/30 rounded p-3">
                  {isSigned ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Signed successfully</span>
                    </div>
                  ) : (
                    <Button
                      onClick={handleSign}
                      disabled={isSigning}
                      className="w-full bg-[#4fc3f7] hover:bg-[#4fc3f7]/80 text-[#0a1930] font-medium disabled:opacity-50"
                    >
                      {isSigning ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Signing...
                        </>
                      ) : (
                        <>
                          <Key className="w-4 h-4 mr-2" />
                          Sign with MetaMask
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* To Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#4fc3f7]" />
                  Recipient L2 Address (To)
                </label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  className="bg-[#0a1930] border-[#4fc3f7]/30 text-white placeholder:text-gray-500 focus:border-[#4fc3f7]"
                />
              </div>

              {/* Token Amount */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#4fc3f7]" />
                  Token Amount
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={tokenAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers and decimal point
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      setTokenAmount(value);
                    }
                  }}
                  className="bg-[#0a1930] border-[#4fc3f7]/30 text-white placeholder:text-gray-500 focus:border-[#4fc3f7]"
                />
              </div>

              {/* Proceed Button */}
              <Button
                onClick={handleProceedToSummary}
                disabled={!isFormValid()}
                className="w-full bg-[#4fc3f7] hover:bg-[#4fc3f7]/80 text-[#0a1930] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Summary Step */}
          {step === "summary" && selectedChannelId && !isLoading && (
            <div className="space-y-4">
              <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/20 rounded p-4 space-y-3">
                <h4 className="text-sm font-medium text-[#4fc3f7] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Transaction Summary
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-[#4fc3f7]/10">
                    <span className="text-gray-400 text-sm">Signed</span>
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-[#4fc3f7]/10">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      To Address
                    </span>
                    <span className="text-white font-mono text-sm">
                      {toAddress}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <Coins className="w-4 h-4" />
                      Token Amount
                    </span>
                    <span className="text-white font-medium">
                      {tokenAmount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleBackToInput}
                  variant="outline"
                  className="flex-1 border-[#4fc3f7]/30 text-[#4fc3f7] hover:bg-[#4fc3f7]/10"
                >
                  Back
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="flex-1 bg-[#4fc3f7] hover:bg-[#4fc3f7]/80 text-[#0a1930] font-medium disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Creating Bundle...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Bundle
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Downloading Step */}
          {step === "downloading" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <LoadingSpinner size="lg" />
              <p className="text-gray-400 text-sm">
                Creating transaction bundle...
              </p>
            </div>
          )}

          {/* No channel selected or available */}
          {!isLoading && !selectedChannelId && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No channel selected</p>
              <p className="text-gray-500 text-xs mt-1">
                Please select a channel from the state explorer
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
