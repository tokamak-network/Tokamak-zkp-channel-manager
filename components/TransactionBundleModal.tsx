"use client";

import { useState, useEffect, useRef } from "react";
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
  Upload,
} from "lucide-react";
import {
  getChannel,
  getActiveChannels,
  getLatestSnapshot,
  getChannelUserBalances,
  getChannelParticipants,
  getData,
  getCurrentStateNumber,
  updateData,
} from "@/lib/db-client";
import { readContracts } from "@wagmi/core";

// Local type definitions (previously from firebase-types)
type Channel = any;
type UserBalance = any;
type Participant = any;
import {
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI,
  TON_TOKEN_ADDRESS,
} from "@/lib/contracts";
import { parseProofFromBase64Zip } from "@/lib/proofAnalyzer";
import { useSignMessage, useAccount } from "wagmi";
import { L2_PRV_KEY_MESSAGE } from "@/lib/l2KeyMessage";
import { ETHERS_RPC_URL, HAS_ETHERS_RPC_CONFIG } from "@/lib/rpc";
import { StateSnapshot } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/stateManager/types";
import { Common, CommonOpts, Mainnet } from "@ethereumjs/common";
import { getEddsaPublicKey, poseidon } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/crypto";
import { createERC20TransferTx } from "@/lib/tokamakl2js";
import { fetchChannelData, getBlockInfo, getBlockNumber, getContractCode } from "@/lib/ethers";
import { SynthesizeTxRequest } from "@/app/api/tokamak-zk-evm/route";
import { addHexPrefix, bytesToHex } from "@ethereumjs/util";
import { getInitializationTxHash, getLatestStateSnapshot } from "@/lib/server/db-host";

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

type ModalStep = "input" | "summary" | "downloading" | "proofReady";

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
  const [recipient, setRecipient] = useState<`0x${string}` | null>(null);
  const [tokenAmount, setTokenAmount] = useState<string | null>(null);
  const [currentStateNumber, setCurrentStateNumber] = useState<number | null>(
    null
  );
  const [keySeed, setKeySeed] = useState<`0x${string}` | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signedTxData, setSignedTxData] = useState<any>(null);
  const [includeProof, setIncludeProof] = useState(false); // Option to run prove binary
  const [generatedZipBlob, setGeneratedZipBlob] = useState<Blob | null>(null); // Store generated ZIP for proof submission
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const isSubmittingProofRef = useRef(false);

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
      setKeySeed(null);
      setRecipient(null);
      setTokenAmount(null);
      setCurrentStateNumber(null);
      setError(null);
      setDownloadComplete(false);
      setIsSigning(false);
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
      // Fetch state number first (independent of other data)
      const stateNumber = await getCurrentStateNumber(channelId);
      console.log("fetchBundleData: stateNumber =", stateNumber);
      setCurrentStateNumber(stateNumber);

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
          if (!HAS_ETHERS_RPC_CONFIG) {
            throw new Error(
              "Missing NEXT_ETHERS_RPC_URL"
            );
          }

          const contractParticipantsData = await readContracts({
            contracts: [
              {
                address: ROLLUP_BRIDGE_CORE_ADDRESS,
                abi: ROLLUP_BRIDGE_CORE_ABI,
                functionName: "getChannelParticipants",
                args: [BigInt(channelId)],
              },
            ],
          });
          const contractParticipants = contractParticipantsData?.[0]
            ?.result as readonly `0x${string}`[];

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
      // Still set state number to 0 if there's an error
      if (currentStateNumber === null) {
        setCurrentStateNumber(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Generate key pair using MetaMask
  const generateKeySeed = async () => {
    if (!isConnected || !address) {
      setError("Please connect your wallet first");
      return;
    }

    if (!selectedChannelId) {
      setError("Please select a channel first");
      return;
    }

    setError(null);
    setIsSigning(true);
    try {
      const message = L2_PRV_KEY_MESSAGE + selectedChannelId;
      const seed = await signMessageAsync({ message });
      setKeySeed(seed);
    } catch (err) {
      if (err instanceof Error && err.message.includes("User rejected")) {
        setError("Signature cancelled by user");
      } else {
        console.error("Failed to generate a seed from user signature:", err);
        setError(
          err instanceof Error ? err.message : "Failed in interaction with MetaMask"
        );
      }
      setKeySeed(null);
    } finally {
      setIsSigning(false);
    }
  };

  // Validate all input fields
  const isFormValid = () => {
    return (
      keySeed !== null &&
      recipient !== null &&
      tokenAmount !== null &&
      recipient.trim().length > 0 &&
      tokenAmount.trim().length > 0 &&
      !isNaN(Number(tokenAmount)) &&
      Number(tokenAmount) > 0
    );
  };

  // Create an L2 ERC20 transfer (signed) and run synthesizer
  const runSynthesizer = async (
    initTxHash: `0x${string}`,
    previousStateSnapshot: StateSnapshot
  ) => {
    if (!isFormValid) {
      throw new Error('Tx input format is not filled.')
    }

    const signedTx = await createERC20TransferTx(
      0,
      recipient!,
      BigInt(tokenAmount!.trim()),
      keySeed!,
      TON_TOKEN_ADDRESS,
    );
    const signedTxStr= bytesToHex(signedTx.serialize());
    const postMessage: SynthesizeTxRequest = {
      channelId: selectedChannelId,
      channelInitTxHash: initTxHash,
      signedTxRlpStr: signedTxStr,
      previousStateSnapshot,
      includeProof,
    }

    const response = await fetch("/api/tokamak-zk-evm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postMessage),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to synthesize L2 transaction");
    }

    // Response is a ZIP file blob
    return await response.blob();
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

  // Synthesize L2 transaction and download result
  const handleSynthesizerDownload = async () => {
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
      // OPTIMIZED: Use already loaded bundleData.channel, only fetch if missing
      const initTxHash = bundleData?.channel?.initializationTxHash === undefined ? 
        await getInitializationTxHash(selectedChannelId) :
        bundleData?.channel?.initializationTxHash;

      if (!initTxHash) {
        throw new Error(
          "Could not find initialization transaction hash for this channel"
        );
      }

      // OPTIMIZED: Get state snapshot with single efficient call
      let previousStateSnapshot = await getLatestStateSnapshot(
        selectedChannelId
      );
      if (previousStateSnapshot === null) {
        const channelId = Number(addHexPrefix(selectedChannelId));
        const channelData = await fetchChannelData(
          ETHERS_RPC_URL, 
          channelId,
        );
        previousStateSnapshot = {
          channelId,
          stateRoot: channelData.initialRoot,
          registeredKeys: channelData.registeredKeys,
          storageEntries: channelData.storageEntries,
          contractAddress: channelData.contractAddress,
          preAllocatedLeaves: channelData.preAllocatedLeaves,
        };
      }

      // Call synthesizer API
      const zipBlob = await runSynthesizer(
        initTxHash,
        previousStateSnapshot
      );

      // If proof is included, show options instead of auto-downloading
      if (includeProof) {
        setGeneratedZipBlob(zipBlob);
        setStep("proofReady");
        setDownloadComplete(true);
      } else {
        // Download the ZIP file immediately
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `l2-transaction-channel-${selectedChannelId}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setDownloadComplete(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to synthesize L2 transaction:", err);
      setError(
        err instanceof Error ? err.message : "Failed to synthesize L2 transaction"
      );
      setStep("summary");
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle downloading the generated ZIP file
  const handleDownloadGeneratedZip = () => {
    if (!generatedZipBlob || !selectedChannelId) return;

    const url = URL.createObjectURL(generatedZipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `l2-transfer-channel-${selectedChannelId}-with-proof.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle submitting the proof to Firebase (same logic as SubmitProofModal)
  const handleSubmitProof = async () => {
    if (isSubmittingProofRef.current) {
      return;
    }

    if (!generatedZipBlob || !selectedChannelId || !address) {
      setError("Missing required data for proof submission");
      return;
    }

    isSubmittingProofRef.current = true;
    setIsSubmittingProof(true);
    setError(null);

    try {
      // Step 1: Get next proof number atomically from backend
      const proofNumberResponse = await fetch("/api/get-next-proof-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: parseInt(selectedChannelId) }),
      });

      if (!proofNumberResponse.ok) {
        const errorData = await proofNumberResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get next proof number");
      }

      const { proofNumber, subNumber, proofId, storageProofId } =
        await proofNumberResponse.json();

      // Step 2: Upload ZIP file to Firebase Storage
      const formData = new FormData();
      formData.append(
        "file",
        new File([generatedZipBlob], `proof-${proofId}.zip`, {
          type: "application/zip",
        })
      );
      formData.append("channelId", selectedChannelId);
      formData.append("proofId", storageProofId);

      const uploadResponse = await fetch("/api/save-proof-zip", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.details || "Upload failed"
        );
      }

      // Step 3: Save metadata to Firebase Realtime Database
      const proofMetadata = {
        proofId: proofId,
        sequenceNumber: proofNumber,
        subNumber: subNumber,
        submittedAt: new Date().toISOString(),
        submitter: address,
        timestamp: Date.now(),
        uploadStatus: "complete",
        status: "pending",
        channelId: selectedChannelId,
      };

      await updateData(
        `channels/${selectedChannelId}/submittedProofs/${storageProofId}`,
        proofMetadata
      );

      // Success!
      setDownloadComplete(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Failed to submit proof:", err);
      setError(err instanceof Error ? err.message : "Failed to submit proof");
    } finally {
      isSubmittingProofRef.current = false;
      setIsSubmittingProof(false);
    }
  };


  const handleClose = () => {
    setDownloadComplete(false);
    setError(null);
    setBundleData(null);
    setStep("input");
    setKeySeed(null);
    setRecipient(null);
    setTokenAmount(null);
    setCurrentStateNumber(null);
    setIsSigning(false);
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
                  {keySeed ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Signed successfully</span>
                    </div>
                  ) : (
                    <Button
                      onClick={generateKeySeed}
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
                  Recipient L2 Address
                </label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={recipient ?? ""}
                  onChange={(e) => setRecipient(addHexPrefix(e.target.value))}
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
                  value={tokenAmount ?? ""}
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

              {/* Include Proof Option */}
              <div className="flex items-center space-x-3 p-3 bg-[#0a1930]/50 border border-[#4fc3f7]/20 rounded-lg">
                <input
                  type="checkbox"
                  id="includeProof"
                  checked={includeProof}
                  onChange={(e) => setIncludeProof(e.target.checked)}
                  className="w-5 h-5 rounded border-[#4fc3f7]/30 bg-[#0a1930] text-[#4fc3f7] focus:ring-[#4fc3f7] focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="includeProof" className="flex-1 cursor-pointer">
                  <span className="text-sm font-medium text-white">
                    Generate ZK Proof
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Include proof.json in the download (takes longer to process)
                  </p>
                </label>
              </div>

              {/* Next State Number */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#4fc3f7]" />
                  Next State
                </label>
                <div className="bg-[#0a1930] border border-[#4fc3f7]/30 rounded-md px-4 py-2 text-white">
                  {currentStateNumber !== null ? (
                    <span className="text-lg font-semibold text-[#4fc3f7]">
                      State #{currentStateNumber}
                    </span>
                  ) : (
                    <span className="text-gray-500">Loading...</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  State number for this transaction (calculated from latest
                  verified proof + 1)
                </p>
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
                      {(recipient?? "").slice(0, 6)}...{(recipient ?? "").slice(-4)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-[#4fc3f7]/10">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <Coins className="w-4 h-4" />
                      Token Amount
                    </span>
                    <span className="text-white font-medium">
                      {tokenAmount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-[#4fc3f7]/10">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Next State
                    </span>
                    <span className="text-white font-medium">
                      {currentStateNumber !== null
                        ? `State #${currentStateNumber}`
                        : "Loading..."}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Generate ZK Proof
                    </span>
                    <span
                      className={`font-medium ${
                        includeProof ? "text-green-400" : "text-gray-500"
                      }`}
                    >
                      {includeProof ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleSynthesizerDownload}
                  disabled={isDownloading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      {includeProof
                        ? "Synthesizing & Proving..."
                        : "Synthesizing..."}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      {includeProof
                        ? "Synthesize, Prove & Download"
                        : "Synthesize & Download"}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleBackToInput}
                  variant="outline"
                  className="w-full border-[#4fc3f7]/30 text-[#4fc3f7] hover:bg-[#4fc3f7]/10"
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Downloading Step */}
          {step === "downloading" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <LoadingSpinner size="lg" />
              <p className="text-gray-400 text-sm">
                {includeProof
                  ? "Synthesizing & generating proof... This may take a few minutes."
                  : "Synthesizing L2 transfer... Please wait a few seconds."}
              </p>
            </div>
          )}

          {/* Proof Ready Step - Show after proof generation is complete */}
          {step === "proofReady" && generatedZipBlob && (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                <div>
                  <h4 className="text-green-400 font-medium">
                    Proof Generated Successfully!
                  </h4>
                  <p className="text-gray-400 text-sm">
                    Your L2 transfer with ZK proof is ready. You can submit it
                    to the channel or download it.
                  </p>
                </div>
              </div>

              <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/20 rounded p-4 space-y-3">
                <h4 className="text-sm font-medium text-[#4fc3f7] flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Transaction Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Channel</span>
                    <span className="text-white font-mono">
                      #{selectedChannelId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Recipient</span>
                    <span className="text-white font-mono text-xs">
                      {(recipient ?? "").slice(0, 10)}...{(recipient ?? "").slice(-8)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount</span>
                    <span className="text-white">{tokenAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Includes Proof</span>
                    <span className="text-green-400">Yes</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleSubmitProof}
                  disabled={isSubmittingProof}
                  aria-busy={isSubmittingProof}
                  className="w-full bg-[#4fc3f7] hover:bg-[#4fc3f7]/80 text-[#0a1930] font-medium disabled:opacity-50"
                >
                  {isSubmittingProof ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Submitting Proof...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Submit Proof to Channel
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDownloadGeneratedZip}
                  variant="outline"
                  className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download ZIP with Proof
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="w-full border-[#4fc3f7]/30 text-[#4fc3f7] hover:bg-[#4fc3f7]/10"
                >
                  Close
                </Button>
              </div>
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
