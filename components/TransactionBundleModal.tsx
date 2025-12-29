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
import { createPublicClient, http } from "viem";

// Local type definitions (previously from firebase-types)
type Channel = any;
type StateSnapshot = any;
type UserBalance = any;
type Participant = any;
import { sepolia } from "viem/chains";
import {
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI,
} from "@/lib/contracts";
import { parseProofFromBase64Zip } from "@/lib/proofAnalyzer";
import { useSignMessage, useAccount } from "wagmi";
import { L2_PRV_KEY_MESSAGE } from "@/lib/l2KeyMessage";
import { ALCHEMY_KEY } from "@/lib/constants";

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
  const [isSigned, setIsSigned] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [currentStateNumber, setCurrentStateNumber] = useState<number | null>(
    null
  );
  const [isSigning, setIsSigning] = useState(false);
  const [signature, setSignature] = useState<`0x${string}` | null>(null);
  const [signedTxData, setSignedTxData] = useState<any>(null);
  const [includeProof, setIncludeProof] = useState(false); // Option to run prove binary
  const [generatedZipBlob, setGeneratedZipBlob] = useState<Blob | null>(null); // Store generated ZIP for proof submission
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

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
      setCurrentStateNumber(null);
      setError(null);
      setDownloadComplete(false);
      setSignedTxData(null);
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
          const publicClient = createPublicClient({
            chain: sepolia,
            transport: http(
              `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
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
      // Still set state number to 0 if there's an error
      if (currentStateNumber === null) {
        setCurrentStateNumber(0);
      }
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

  // Generate L2 signed transaction using synthesizer binary
  const synthesizeL2Transfer = async (
    initTxHash: string,
    previousStateSnapshot?: any
  ) => {
    if (!signature) {
      throw new Error("Signature is required to synthesize L2 transfer");
    }

    const response = await fetch("/api/synthesize-l2-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: selectedChannelId,
        initTx: initTxHash,
        signature,
        recipient: toAddress.trim(),
        amount: tokenAmount.trim(),
        useSepolia: true,
        previousStateSnapshot: previousStateSnapshot || null,
        includeProof,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to synthesize L2 transfer");
    }

    // Response is a ZIP file blob
    return await response.blob();
  };

  // Legacy: Generate L2 signed transaction (kept for backwards compatibility)
  const generateSignedTransaction = async () => {
    if (!signature) {
      throw new Error("Signature is required to generate signed transaction");
    }

    // Encode transfer callData: transfer(address to, uint256 amount)
    // Function selector for transfer(address,uint256) = 0xa9059cbb
    const functionSelector = "0xa9059cbb";
    const paddedToAddress = toAddress
      .trim()
      .toLowerCase()
      .replace("0x", "")
      .padStart(64, "0");
    // Convert token amount to wei (assuming 18 decimals)
    const amountInWei = BigInt(Math.floor(Number(tokenAmount) * 1e18));
    const paddedAmount = amountInWei.toString(16).padStart(64, "0");
    const callData =
      `${functionSelector}${paddedToAddress}${paddedAmount}` as `0x${string}`;

    // L2 contract address (TON token on L2)
    const l2ContractAddress =
      "0xa30fe40285B8f5c0457DbC3B7C8A280373c40044" as `0x${string}`;

    const response = await fetch("/api/create-l2-signed-transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature,
        nonce: currentStateNumber || 0, // Use current state number as nonce
        to: l2ContractAddress,
        callData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create signed transaction");
    }

    const result = await response.json();
    return result;
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

  // OPTIMIZED: Helper to get initializationTxHash with minimal Firebase calls
  const getInitializationTxHash = async (
    channelId: string,
    channelData: Channel | null
  ): Promise<string | null> => {
    // 1. Try from already loaded channel data first (no Firebase call)
    // Note: initializationTxHash is stored dynamically and not in the Channel type
    const channelAny = channelData as any;
    if (channelAny?.initializationTxHash) {
      return channelAny.initializationTxHash;
    }
    if (channelAny?.initialProof?.initializationTxHash) {
      return channelAny.initialProof.initializationTxHash;
    }

    // 2. Single Firebase call to get initialProof (most common location)
    try {
      const initialProofData = await getData<any>(
        `channels/${channelId}/initialProof`
      );
      if (initialProofData?.initializationTxHash) {
        return initialProofData.initializationTxHash;
      }
    } catch (err) {
      console.warn("Failed to get initializationTxHash:", err);
    }

    return null;
  };

  // OPTIMIZED: Helper to get latest verified proof's state snapshot
  const getLatestStateSnapshot = async (
    channelId: string
  ): Promise<any | null> => {
    try {
      // Get only the metadata first (without zipFile.content if possible)
      // Note: Firebase doesn't support partial reads, so we get the whole thing
      // but we only need the latest proof's content
      const verifiedProofsData = await getData<any>(
        `channels/${channelId}/verifiedProofs`
      );

      if (!verifiedProofsData) return null;

      // Find the latest proof key (highest sequenceNumber)
      const entries = Object.entries(verifiedProofsData);
      if (entries.length === 0) return null;

      let latestKey = entries[0][0];
      let latestSeq = (entries[0][1] as any)?.sequenceNumber || 0;

      for (const [key, value] of entries) {
        const seq = (value as any)?.sequenceNumber || 0;
        if (seq > latestSeq) {
          latestSeq = seq;
          latestKey = key;
        }
      }

      // Get zipFile content from the latest proof
      const latestProof = verifiedProofsData[latestKey];
      let zipFileContent = latestProof?.zipFile?.content;

      // If content not in initial fetch, get it separately (this handles Firebase's lazy loading)
      if (!zipFileContent) {
        try {
          const zipFileData = await getData<any>(
            `channels/${channelId}/verifiedProofs/${latestKey}/zipFile`
          );
          zipFileContent = zipFileData?.content;
        } catch (err) {
          console.warn("Failed to fetch zipFile content:", err);
          return null;
        }
      }

      if (!zipFileContent) return null;

      // Parse and extract state_snapshot
      const { snapshot } = await parseProofFromBase64Zip(zipFileContent);
      return snapshot || null;
    } catch (err) {
      console.warn("Failed to get latest state snapshot:", err);
      return null;
    }
  };

  // Synthesize L2 transfer and download result
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
      const initTxHash = await getInitializationTxHash(
        selectedChannelId,
        bundleData?.channel || null
      );

      if (!initTxHash) {
        throw new Error(
          "Could not find initialization transaction hash for this channel"
        );
      }

      // OPTIMIZED: Get state snapshot with single efficient call
      const previousStateSnapshot = await getLatestStateSnapshot(
        selectedChannelId
      );

      console.log("Synthesizing L2 transfer with:", {
        channelId: selectedChannelId,
        initTx: initTxHash,
        recipient: toAddress.trim(),
        amount: tokenAmount.trim(),
        hasPreviousState: !!previousStateSnapshot,
      });

      // Call synthesizer API
      const zipBlob = await synthesizeL2Transfer(
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
        link.download = `l2-transfer-channel-${selectedChannelId}.zip`;
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
      console.error("Failed to synthesize L2 transfer:", err);
      setError(
        err instanceof Error ? err.message : "Failed to synthesize L2 transfer"
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
    if (!generatedZipBlob || !selectedChannelId || !address) {
      setError("Missing required data for proof submission");
      return;
    }

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
      setIsSubmittingProof(false);
    }
  };

  // OPTIMIZED: Removed duplicate handleDownload - use handleSynthesizerDownload instead
  // The legacy handleDownload had 8+ redundant Firebase calls that have been consolidated
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
      // Generate L2 signed transaction first
      let l2SignedTx = null;
      if (signature) {
        try {
          console.log("Generating L2 signed transaction...");
          l2SignedTx = await generateSignedTransaction();
          console.log("L2 signed transaction generated:", l2SignedTx);
          setSignedTxData(l2SignedTx);
        } catch (txErr) {
          console.error("Failed to generate L2 signed transaction:", txErr);
          setError(
            `Warning: L2 transaction generation failed - ${
              txErr instanceof Error ? txErr.message : String(txErr)
            }`
          );
        }
      }

      // OPTIMIZED: Use already loaded bundleData (fetched once in fetchBundleData)
      const channel = bundleData?.channel;
      const snapshot = bundleData?.snapshot;

      const zip = new JSZip();

      // OPTIMIZED: Single call to get initializationTxHash
      const initializationTxHash = await getInitializationTxHash(
        selectedChannelId,
        channel || null
      );

      if (!initializationTxHash) {
        throw new Error(
          `Could not find initialization transaction hash for channel ${selectedChannelId}. Please ensure the channel has been initialized.`
        );
      }

      // OPTIMIZED: Single call to get latest state snapshot
      const latestStateSnapshot = await getLatestStateSnapshot(
        selectedChannelId
      );

      // Create transaction-info.json
      const transactionInfo = {
        channelId: selectedChannelId,
        initializedTxHash: initializationTxHash,
        toAddress: toAddress.trim(),
        tokenAmount: tokenAmount.trim(),
        currentStateNumber,
        signed: isSigned,
        ...(signature && { signature }),
      };
      zip.file(
        "transaction-info.json",
        JSON.stringify(transactionInfo, null, 2)
      );

      // Add L2 signed transaction if available
      if (l2SignedTx) {
        zip.file(
          "signed-transaction.json",
          JSON.stringify(l2SignedTx, null, 2)
        );
      }

      // Add state_snapshot.json if available
      if (latestStateSnapshot) {
        zip.file(
          "state_snapshot.json",
          JSON.stringify(latestStateSnapshot, null, 2)
        );
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
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Failed to create bundle:", err);
      setError(err instanceof Error ? err.message : "Failed to create bundle");
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
    setCurrentStateNumber(null);
    setSignedTxData(null);
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
                      {toAddress.slice(0, 6)}...{toAddress.slice(-4)}
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
                      {toAddress.slice(0, 10)}...{toAddress.slice(-8)}
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
