"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useAccount, usePublicClient, useContractReads } from "wagmi";
import { useSearchParams } from "next/navigation";
import { formatUnits } from "viem";
import { Layout } from "@/components/Layout";
import { ProofCard, ProofData } from "@/components/ProofCard";
import { TransactionBundleModal } from "@/components/TransactionBundleModal";
import { SubmitProofModal } from "@/components/SubmitProofModal";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI,
  TON_TOKEN_ADDRESS,
  ETH_TOKEN_ADDRESS,
} from "@/lib/contracts";
import {
  getData,
  getLatestSnapshot,
  pushData,
  updateData,
  deleteData,
} from "@/lib/realtime-db-helpers";
import { ERC20_ABI } from "@/lib/contracts";
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
  Users,
  Coins,
  Plus,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Layers,
  Shield,
  Hash,
  RefreshCw,
  AlertCircle,
  Upload,
  Download,
} from "lucide-react";
import JSZip from "jszip";

// Types
interface ParticipantBalance {
  address: string;
  initialDeposit: string; // 초기 deposit 금액
  currentBalance: string; // 현재 state 기준 밸런스
  symbol: string;
  decimals: number;
}

interface StateTransition {
  sequenceNumber: number;
  proofId: string;
  timestamp: number;
  submitter: string;
  merkleRoots: {
    initial: string;
    resulting: string;
  };
  balanceChanges: {
    address: string;
    before: string;
    after: string;
    change: string; // +/- amount
  }[];
}

interface OnChainChannel {
  id: number;
  state: number; // 0: Pending, 1: Active, 2: Closed
  participantCount: number;
  participants: string[];
  leader: string;
  isLeader: boolean;
  targetAddress: string;
  hasPublicKey: boolean;
}

// Channel state enum - matches contract: None(0), Initialized(1), Open(2), Active(3), Closing(4), Closed(5)
const ChannelState = {
  0: "none",
  1: "pending", // Initialized - awaiting deposits/setup
  2: "active", // Open - ready for operations
  3: "active", // Active - in use
  4: "closing", // Closing - being finalized
  5: "closed", // Closed - finalized
} as const;

// Mock proofs data - In production, fetch from Firebase
const getMockProofsForChannel = (channelId: number): ProofData[] => {
  return [
    {
      id: 1,
      status: "verified",
      timestamp: Date.now() - 3600000,
      submitter: "0x1234567890123456789012345678901234567890",
      channelId,
    },
    {
      id: 2,
      status: "verified",
      timestamp: Date.now() - 7200000,
      submitter: "0x9876543210987654321098765432109876543210",
      channelId,
    },
    {
      id: 3,
      status: "pending",
      timestamp: Date.now() - 1800000,
      submitter: "0x1234567890123456789012345678901234567890",
      channelId,
    },
  ];
};

// Channel Selection View Component
function ChannelSelectionView({
  channels,
  onSelectChannel,
  isLoading,
  onRefresh,
  error,
}: {
  channels: OnChainChannel[];
  onSelectChannel: (channel: OnChainChannel) => void;
  isLoading: boolean;
  onRefresh: () => void;
  error: string | null;
}) {
  const activeChannels = channels.filter((c) => {
    const state = ChannelState[c.state as keyof typeof ChannelState];
    return state === "active";
  });
  const pendingChannels = channels.filter((c) => {
    const state = ChannelState[c.state as keyof typeof ChannelState];
    return state === "pending";
  });
  const closedChannels = channels.filter((c) => {
    const state = ChannelState[c.state as keyof typeof ChannelState];
    return state === "closed" || state === "closing";
  });

  return (
    <div className="p-4 pb-20">
      <div className="max-w-5xl w-full mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-6 shadow-lg shadow-[#4fc3f7]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#4fc3f7] p-2 rounded">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  State Explorer
                </h2>
                <p className="text-gray-400 text-sm">
                  Select a channel to view its state
                </p>
              </div>
            </div>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-[#4fc3f7]/10 hover:bg-[#4fc3f7]/20 text-[#4fc3f7] rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
            <span className="ml-4 text-gray-400">
              Loading your channels from blockchain...
            </span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-medium">
                Failed to load channels
              </p>
              <p className="text-red-400/70 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* No Channels */}
        {!isLoading && !error && channels.length === 0 && (
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No Channels Found
            </h3>
            <p className="text-gray-400">
              You are not participating in any channels.
            </p>
          </div>
        )}

        {/* Active Channels */}
        {!isLoading && activeChannels.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Active Channels ({activeChannels.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 text-left hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20 group"
                >
                  {/* Channel Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-semibold group-hover:text-[#4fc3f7] transition-colors font-mono">
                          Channel #{channel.id}
                        </h4>
                        {channel.isLeader && (
                          <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-medium">
                            LEADER
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-400 text-xs">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                      Active
                    </div>
                  </div>

                  {/* Channel Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-[#0a1930]/50 p-2 rounded">
                      <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Participants
                      </div>
                      <div className="text-white font-medium text-sm">
                        {channel.participantCount}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 p-2 rounded">
                      <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Public Key
                      </div>
                      <div className="text-white font-medium text-sm">
                        {channel.hasPublicKey ? "✓ Set" : "✗ Not set"}
                      </div>
                    </div>
                  </div>

                  {/* Target Contract */}
                  <div className="text-xs text-gray-500">
                    Target: {channel.targetAddress.slice(0, 6)}...
                    {channel.targetAddress.slice(-4)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pending Channels */}
        {!isLoading && pendingChannels.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              Pending Channels ({pendingChannels.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-yellow-500/30 p-5 text-left hover:border-yellow-500/50 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-semibold font-mono">
                        Channel #{channel.id}
                      </h4>
                      {channel.isLeader && (
                        <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-medium">
                          LEADER
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-yellow-400 text-xs">
                      <Clock className="w-3 h-3" />
                      Pending
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {channel.participantCount} participants • Awaiting
                    initialization
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Closed Channels */}
        {!isLoading && closedChannels.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full" />
              Closed Channels ({closedChannels.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {closedChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-gray-600/30 p-5 text-left hover:border-gray-500/50 transition-all opacity-60 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-gray-400 font-semibold font-mono">
                      Channel #{channel.id}
                    </h4>
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <XCircle className="w-3 h-3" />
                      Closed
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {channel.participantCount} participants
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// State Explorer Detail View Component
function StateExplorerDetailView({
  channel,
  onBack,
  userAddress,
}: {
  channel: OnChainChannel;
  onBack: () => void;
  userAddress: string;
}) {
  const [filter, setFilter] = useState<
    "all" | "pending" | "verified" | "rejected"
  >("all");
  const [isBalancesExpanded, setIsBalancesExpanded] = useState(false);
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);
  const [isSubmitProofModalOpen, setIsSubmitProofModalOpen] = useState(false);
  const [participantBalances, setParticipantBalances] = useState<
    ParticipantBalance[]
  >([]);
  const [proofs, setProofs] = useState<ProofData[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(true);
  const [isLoadingProofs, setIsLoadingProofs] = useState(true);
  const [initialMerkleRoot, setInitialMerkleRoot] = useState<string>("N/A");
  const [currentMerkleRoot, setCurrentMerkleRoot] = useState<string>("N/A");
  const [stateTransitions, setStateTransitions] = useState<StateTransition[]>([]);
  const [isLoadingTransitions, setIsLoadingTransitions] = useState(false);
  const [isTransitionsExpanded, setIsTransitionsExpanded] = useState(false);
  const [isDownloadingProofs, setIsDownloadingProofs] = useState(false);
  const publicClient = usePublicClient();
  const VISIBLE_PARTICIPANTS_COLLAPSED = 3;

  // Get token info (decimals, symbol)
  const isETH =
    channel.targetAddress === ETH_TOKEN_ADDRESS ||
    channel.targetAddress === "0x0000000000000000000000000000000000000001" ||
    channel.targetAddress === "0x0000000000000000000000000000000000000000";

  const { data: tokenDecimals } = useContractReads({
    contracts: channel.participants.map(() => ({
      address: channel.targetAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
    })),
    enabled:
      !isETH &&
      channel.targetAddress !== "0x0000000000000000000000000000000000000000",
  });

  const { data: tokenSymbol } = useContractReads({
    contracts: channel.participants.map(() => ({
      address: channel.targetAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "symbol",
    })),
    enabled:
      !isETH &&
      channel.targetAddress !== "0x0000000000000000000000000000000000000000",
  });

  const decimals = isETH ? 18 : Number(tokenDecimals?.[0]?.result) || 18;
  const symbol = isETH ? "ETH" : String(tokenSymbol?.[0]?.result || "TOKEN");

  // Get initial deposits from contract
  const { data: initialDeposits } = useContractReads({
    contracts: channel.participants.map((participant) => ({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: "getParticipantDeposit",
      args: [BigInt(channel.id), participant as `0x${string}`],
    })),
    enabled: channel.participants.length > 0,
  });

  // Fetch current balances and Merkle roots from latest verified proof
  const fetchCurrentBalances = useCallback(async () => {
    if (!publicClient || !initialDeposits || channel.participants.length === 0)
      return;

    setIsLoadingBalances(true);
    try {
      // Get latest verified proof from Firebase
      const verifiedProofsData = await getData(
        `channels/${channel.id}/verifiedProofs`
      );

      let latestProofBalances: any = null;
      let latestAnalysis: any = null;

      if (verifiedProofsData) {
        // Find the latest verified proof (highest sequenceNumber)
        const verifiedProofsArray = Object.entries(verifiedProofsData).map(
          ([key, value]: [string, any]) => ({
            key,
            ...value,
          })
        );

        const latestProof = verifiedProofsArray.reduce(
          (latest: any, current: any) => {
            if (
              !latest ||
              (current.sequenceNumber &&
                current.sequenceNumber > latest.sequenceNumber)
            ) {
              return current;
            }
            return latest;
          },
          null
        );

        // If we have a latest proof with zipFile, parse it
        if (latestProof?.zipFile?.content) {
          try {
            const { parseProofFromBase64Zip, analyzeProof } = await import(
              "@/lib/proofAnalyzer"
            );
            const parsed = await parseProofFromBase64Zip(
              latestProof.zipFile.content
            );

            if (parsed.instance && parsed.snapshot) {
              const analysis = analyzeProof(
                parsed.instance,
                parsed.snapshot,
                decimals
              );
              latestProofBalances = analysis.balances;
              latestAnalysis = analysis;
              
              // Set current Merkle root from the latest proof
              setCurrentMerkleRoot(analysis.merkleRoots.resulting);
            }
          } catch (parseError) {
            console.error("Error parsing latest verified proof:", parseError);
          }
        }
      }

      // Set initial Merkle root (from first verified proof or use initial deposits state)
      if (verifiedProofsData) {
        // Find the first verified proof (lowest sequenceNumber)
        const verifiedProofsArray = Object.entries(verifiedProofsData).map(
          ([key, value]: [string, any]) => ({
            key,
            ...value,
          })
        );

        const firstProof = verifiedProofsArray.reduce(
          (earliest: any, current: any) => {
            if (
              !earliest ||
              (current.sequenceNumber &&
                current.sequenceNumber < earliest.sequenceNumber)
            ) {
              return current;
            }
            return earliest;
          },
          null
        );

        if (firstProof?.zipFile?.content) {
          try {
            const { parseProofFromBase64Zip, analyzeProof } = await import(
              "@/lib/proofAnalyzer"
            );
            const parsed = await parseProofFromBase64Zip(
              firstProof.zipFile.content
            );
            
            if (parsed.instance && parsed.snapshot) {
              const analysis = analyzeProof(
                parsed.instance,
                parsed.snapshot,
                decimals
              );
              setInitialMerkleRoot(analysis.merkleRoots.initial);
            }
          } catch (parseError) {
            console.error("Error parsing first proof:", parseError);
          }
        }
      }

      const balances: ParticipantBalance[] = channel.participants.map(
        (participant, idx) => {
          const initialDeposit =
            (initialDeposits?.[idx]?.result as bigint) || BigInt(0);
          const initialDepositFormatted = formatUnits(initialDeposit, decimals);

          // Get current balance from latest verified proof, if available
          let currentBalance = initialDepositFormatted;
          if (latestProofBalances && latestProofBalances[idx]) {
            currentBalance = latestProofBalances[idx].balanceFormatted;
          }

          return {
            address: participant,
            initialDeposit: initialDepositFormatted,
            currentBalance: currentBalance,
            symbol: symbol,
            decimals: decimals,
          };
        }
      );

      setParticipantBalances(balances);
    } catch (error) {
      console.error("Error fetching current balances:", error);
      // Fallback to initial deposits only
      const balances: ParticipantBalance[] = channel.participants.map(
        (participant, idx) => {
          const initialDeposit =
            (initialDeposits?.[idx]?.result as bigint) || BigInt(0);
          return {
            address: participant,
            initialDeposit: formatUnits(initialDeposit, decimals),
            currentBalance: formatUnits(initialDeposit, decimals),
            symbol: symbol,
            decimals: decimals,
          };
        }
      );
      setParticipantBalances(balances);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [
    initialDeposits,
    channel.id,
    channel.participants,
    publicClient,
    decimals,
    symbol,
  ]);

  // Fetch state transitions from verified proofs
  const fetchStateTransitions = useCallback(async () => {
    setIsLoadingTransitions(true);
    try {
      const verifiedProofsData = await getData(
        `channels/${channel.id}/verifiedProofs`
      );

      if (!verifiedProofsData) {
        setStateTransitions([]);
        return;
      }

      const { parseProofFromBase64Zip, analyzeProof } = await import(
        "@/lib/proofAnalyzer"
      );

      // Convert to array and sort by sequence number
      const verifiedProofsArray = Object.entries(verifiedProofsData)
        .map(([key, value]: [string, any]) => ({
          key,
          ...value,
        }))
        .sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber);

      const transitions: StateTransition[] = [];
      let previousBalances: any[] = [];

      for (const proof of verifiedProofsArray) {
        if (!proof.zipFile?.content) continue;

        try {
          const parsed = await parseProofFromBase64Zip(proof.zipFile.content);

          if (parsed.instance && parsed.snapshot) {
            const analysis = analyzeProof(
              parsed.instance,
              parsed.snapshot,
              decimals
            );

            // Calculate balance changes
            const balanceChanges = analysis.balances.map((bal: any, idx: number) => {
              const beforeBalance = previousBalances[idx]?.balanceFormatted || 
                participantBalances[idx]?.initialDeposit || "0.00";
              const afterBalance = bal.balanceFormatted;
              const change = (
                parseFloat(afterBalance) - parseFloat(beforeBalance)
              ).toFixed(2);

              return {
                address: channel.participants[idx],
                before: beforeBalance,
                after: afterBalance,
                change: parseFloat(change) >= 0 ? `+${change}` : change,
              };
            });

            transitions.push({
              sequenceNumber: proof.sequenceNumber || 0,
              proofId: proof.proofId || proof.key,
              timestamp: proof.timestamp || proof.submittedAt || Date.now(),
              submitter: proof.submitter || "Unknown",
              merkleRoots: analysis.merkleRoots,
              balanceChanges,
            });

            // Update previous balances for next iteration
            previousBalances = analysis.balances;
          }
        } catch (parseError) {
          console.error(
            `Error parsing proof ${proof.key}:`,
            parseError
          );
        }
      }

      setStateTransitions(transitions);
    } catch (error) {
      console.error("Error fetching state transitions:", error);
    } finally {
      setIsLoadingTransitions(false);
    }
  }, [channel.id, channel.participants, decimals, participantBalances]);

  // Fetch current balances on mount and when dependencies change
  useEffect(() => {
    if (initialDeposits && channel.participants.length > 0) {
      fetchCurrentBalances();
    }
  }, [fetchCurrentBalances, initialDeposits, channel.participants.length]);

  // Fetch state transitions when verified proofs are available
  useEffect(() => {
    if (channel.id && participantBalances.length > 0) {
      fetchStateTransitions();
    }
  }, [fetchStateTransitions, channel.id, participantBalances.length]);

  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [selectedProofForApproval, setSelectedProofForApproval] = useState<
    string | null
  >(null);

  // Handle proof verification
  const handleVerifyProof = async (proof: ProofData) => {
    if (!channel.isLeader || !proof.key || !proof.sequenceNumber) {
      return;
    }

    setIsVerifying(proof.key as string);

    try {
      // Get all submitted proofs
      const submittedProofs = await getData<any>(
        `channels/${channel.id}/submittedProofs`
      );
      if (!submittedProofs) {
        throw new Error("No submitted proofs found");
      }

      const submittedList = Array.isArray(submittedProofs)
        ? submittedProofs.map((p: any, idx: number) => ({
            ...p,
            key: idx.toString(),
          }))
        : Object.entries(submittedProofs).map(
            ([key, value]: [string, any]) => ({ ...value, key })
          );

      // Find the proof to verify and others with same sequenceNumber
      const proofToVerify = submittedList.find((p: any) => p.key === proof.key);
      const sameSequenceProofs = submittedList.filter(
        (p: any) => p.sequenceNumber === proof.sequenceNumber
      );

      if (!proofToVerify) {
        throw new Error("Proof not found in submitted proofs");
      }

      // Move verified proof to verifiedProofs
      const verifiedProof = {
        ...proofToVerify,
        status: "verified",
        verifiedAt: new Date().toISOString(),
        verifiedBy: userAddress,
      };
      await pushData(`channels/${channel.id}/verifiedProofs`, verifiedProof);

      // Move other proofs with same sequenceNumber to rejectedProofs
      const rejectedProofs = sameSequenceProofs
        .filter((p: any) => p.key !== proof.key)
        .map((p: any) => ({
          ...p,
          status: "rejected",
          rejectedAt: new Date().toISOString(),
          rejectedBy: userAddress,
          reason: "Another proof was verified for this sequence",
        }));

      for (const rejectedProof of rejectedProofs) {
        await pushData(`channels/${channel.id}/rejectedProofs`, rejectedProof);
      }

      // Remove all proofs from submittedProofs
      // Firebase Realtime Database stores as object with auto-generated keys
      // So we need to delete each key individually
      for (const proofToRemove of sameSequenceProofs) {
        if (proofToRemove.key) {
          await deleteData(
            `channels/${channel.id}/submittedProofs/${proofToRemove.key}`
          );
        }
      }

      // Refresh proofs list and balances
      const fetchProofs = async () => {
        try {
          const [verifiedProofs, submittedProofs, rejectedProofs] =
            await Promise.all([
              getData<any>(`channels/${channel.id}/verifiedProofs`),
              getData<any>(`channels/${channel.id}/submittedProofs`),
              getData<any>(`channels/${channel.id}/rejectedProofs`),
            ]);

          const allProofs: ProofData[] = [];

          // Add verified proofs
          if (verifiedProofs) {
            const verifiedList = Array.isArray(verifiedProofs)
              ? verifiedProofs
              : Object.entries(verifiedProofs).map(
                  ([key, value]: [string, any]) => ({ ...value, key })
                );
            verifiedList.forEach((proof: any, idx: number) => {
              allProofs.push({
                ...proof,
                id: proof.id || `verified-${idx}`,
                key:
                  proof.key ||
                  (Array.isArray(verifiedProofs)
                    ? undefined
                    : Object.keys(verifiedProofs)[idx]),
                status: "verified" as const,
              });
            });
          }

          // Add submitted proofs (pending)
          if (submittedProofs) {
            const submittedList = Array.isArray(submittedProofs)
              ? submittedProofs
              : Object.entries(submittedProofs).map(
                  ([key, value]: [string, any]) => ({ ...value, key })
                );
            submittedList.forEach((proof: any, idx: number) => {
              allProofs.push({
                ...proof,
                id: proof.id || `submitted-${idx}`,
                key:
                  proof.key ||
                  (Array.isArray(submittedProofs)
                    ? undefined
                    : Object.keys(submittedProofs)[idx]),
                status: "pending" as const,
              });
            });
          }

          // Add rejected proofs
          if (rejectedProofs) {
            const rejectedList = Array.isArray(rejectedProofs)
              ? rejectedProofs
              : Object.entries(rejectedProofs).map(
                  ([key, value]: [string, any]) => ({ ...value, key })
                );
            rejectedList.forEach((proof: any, idx: number) => {
              allProofs.push({
                ...proof,
                id: proof.id || `rejected-${idx}`,
                key:
                  proof.key ||
                  (Array.isArray(rejectedProofs)
                    ? undefined
                    : Object.keys(rejectedProofs)[idx]),
                status: "rejected" as const,
              });
            });
          }

          setProofs(allProofs);
        } catch (error) {
          console.error("Error refreshing proofs:", error);
        }
      };

      await fetchProofs();

      // Refresh balances to reflect the latest verified proof
      await fetchCurrentBalances();
    } catch (error) {
      console.error("Error verifying proof:", error);
      alert(
        `Failed to verify proof: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsVerifying(null);
    }
  };

  // Download all verified proofs
  const handleDownloadAllVerifiedProofs = async () => {
    setIsDownloadingProofs(true);
    try {
      // Get all verified proofs from Firebase
      const verifiedProofsData = await getData(
        `channels/${channel.id}/verifiedProofs`
      );

      if (!verifiedProofsData) {
        alert("No verified proofs found for this channel.");
        return;
      }

      // Convert to array and sort by sequence number
      const verifiedProofsArray = Object.entries(verifiedProofsData)
        .map(([key, value]: [string, any]) => ({
          key,
          ...value,
        }))
        .sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber);

      if (verifiedProofsArray.length === 0) {
        alert("No verified proofs found for this channel.");
        return;
      }

      // Create a new ZIP file to contain all proof ZIPs
      const masterZip = new JSZip();

      // Add each verified proof ZIP to the master ZIP
      for (const proof of verifiedProofsArray) {
        if (!proof.zipFile?.content) {
          console.warn(`Proof ${proof.key} has no zipFile content, skipping...`);
          continue;
        }

        try {
          // Decode base64 content
          const base64Content = proof.zipFile.content;
          const binaryString = atob(base64Content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Create a folder for each proof
          const proofFolderName = `proof_${proof.sequenceNumber || proof.key || 'unknown'}`;
          const proofZip = await JSZip.loadAsync(bytes);

          // Add all files from the proof ZIP to the master ZIP under a folder
          const files = Object.keys(proofZip.files);
          for (const fileName of files) {
            const file = proofZip.files[fileName];
            if (!file.dir) {
              const content = await file.async('uint8array');
              masterZip.file(`${proofFolderName}/${fileName}`, content);
            }
          }

          // Also add proof metadata
          const metadata = {
            proofId: proof.proofId || proof.key,
            sequenceNumber: proof.sequenceNumber || 0,
            timestamp: proof.timestamp || proof.submittedAt || Date.now(),
            submitter: proof.submitter || "Unknown",
            verifiedAt: proof.verifiedAt || "Unknown",
            verifiedBy: proof.verifiedBy || "Unknown",
          };
          masterZip.file(
            `${proofFolderName}/proof_metadata.json`,
            JSON.stringify(metadata, null, 2)
          );
        } catch (error) {
          console.error(`Error processing proof ${proof.key}:`, error);
        }
      }

      // Generate the master ZIP file
      const masterZipBlob = await masterZip.generateAsync({ type: "blob" });

      // Download the file
      const url = URL.createObjectURL(masterZipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `channel-${channel.id}-all-verified-proofs.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`Successfully downloaded ${verifiedProofsArray.length} verified proof(s)!`);
    } catch (error) {
      console.error("Error downloading verified proofs:", error);
      alert(
        `Failed to download verified proofs: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsDownloadingProofs(false);
    }
  };

  // Fetch proofs from Firebase - extracted to useCallback for reusability
  const fetchProofs = useCallback(async () => {
    setIsLoadingProofs(true);
    try {
      const [verifiedProofs, submittedProofs, rejectedProofs] =
        await Promise.all([
          getData<any>(`channels/${channel.id}/verifiedProofs`),
          getData<any>(`channels/${channel.id}/submittedProofs`),
          getData<any>(`channels/${channel.id}/rejectedProofs`),
        ]);

      const allProofs: ProofData[] = [];

      // Add verified proofs
      if (verifiedProofs) {
        const verifiedList = Array.isArray(verifiedProofs)
          ? verifiedProofs
          : Object.entries(verifiedProofs).map(
              ([key, value]: [string, any]) => ({ ...value, key })
            );

        verifiedList.forEach((proof: any, idx: number) => {
          const proofKey =
            proof.key ||
            (Array.isArray(verifiedProofs)
              ? undefined
              : Object.keys(verifiedProofs)[idx]);
          allProofs.push({
            ...proof,
            id: proof.proofId || proof.id || `verified-${idx}`, // Use proofId as id
            key: proofKey,
            status: "verified" as const,
          });
        });
      }

      // Add submitted proofs (pending)
      if (submittedProofs) {
        const submittedList = Array.isArray(submittedProofs)
          ? submittedProofs
          : Object.entries(submittedProofs).map(
              ([key, value]: [string, any]) => ({ ...value, key })
            );

        submittedList.forEach((proof: any, idx: number) => {
          // Only add if not already added (check by proofId and key)
          const existingProof = allProofs.find(
            (p) =>
              p.proofId === proof.proofId &&
              p.key === (proof.key || Object.keys(submittedProofs)[idx])
          );

          if (!existingProof) {
            const proofKey =
              proof.key ||
              (Array.isArray(submittedProofs)
                ? undefined
                : Object.keys(submittedProofs)[idx]);
            allProofs.push({
              ...proof,
              id: proof.proofId || proof.id || `submitted-${idx}`, // Use proofId as id
              key: proofKey,
              status: "pending" as const,
            });
          }
        });
      }

      // Add rejected proofs
      if (rejectedProofs) {
        const rejectedList = Array.isArray(rejectedProofs)
          ? rejectedProofs
          : Object.entries(rejectedProofs).map(
              ([key, value]: [string, any]) => ({ ...value, key })
            );

        rejectedList.forEach((proof: any, idx: number) => {
          const proofKey =
            proof.key ||
            (Array.isArray(rejectedProofs)
              ? undefined
              : Object.keys(rejectedProofs)[idx]);
          allProofs.push({
            ...proof,
            id: proof.proofId || proof.id || `rejected-${idx}`, // Use proofId as id
            key: proofKey,
            status: "rejected" as const,
          });
        });
      }

      setProofs(allProofs);
    } catch (error) {
      console.error("Error fetching proofs:", error);
      setProofs([]);
    } finally {
      setIsLoadingProofs(false);
    }
  }, [channel.id]);

  // Initial fetch on mount
  useEffect(() => {
    fetchProofs();
  }, [fetchProofs]);

  const filteredProofs = proofs.filter((proof) => {
    if (filter === "all") return true;
    return proof.status === filter;
  });

  const stats = {
    total: proofs.length,
    verified: proofs.filter((p) => p.status === "verified").length,
    pending: proofs.filter((p) => p.status === "pending").length,
    rejected: proofs.filter((p) => p.status === "rejected").length,
  };

  const channelStateLabel =
    ChannelState[channel.state as keyof typeof ChannelState] || "unknown";

  return (
    <>
      <div className="p-4 pb-20">
        <div className="max-w-7xl w-full mx-auto">
          {/* Header Section with Back Button */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-4 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Back Button */}
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-[#4fc3f7]/10 rounded transition-colors text-gray-400 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="bg-[#4fc3f7] p-2 rounded">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-white font-mono">
                      Channel #{channel.id}
                    </h2>
                    {channel.isLeader && (
                      <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded font-medium">
                        LEADER
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        channelStateLabel === "active"
                          ? "bg-green-500/20 text-green-400"
                          : channelStateLabel === "pending"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {channelStateLabel.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              {/* Action Buttons */}
              <div className="flex flex-col items-end gap-3">
                {/* First row: Submit Proof and Create Transaction */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsSubmitProofModalOpen(true);
                    }}
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 bg-[#4fc3f7] hover:bg-[#029bee] text-white rounded transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/30 font-medium cursor-pointer pointer-events-auto"
                  >
                    <Upload className="w-4 h-4" />
                    Submit Proof
                  </button>
                  <button
                    onClick={() => setIsBundleModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-all hover:shadow-lg hover:shadow-green-500/30 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Create Transaction
                  </button>
                </div>
                {/* Second row: Download Verified Proofs */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadAllVerifiedProofs}
                    disabled={isDownloadingProofs || stats.verified === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition-all hover:shadow-lg hover:shadow-purple-500/30 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloadingProofs ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download Verified Proofs ({stats.verified})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {channel.participantCount} participants
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                Public Key: {channel.hasPublicKey ? "Set" : "Not set"}
              </span>
              <span className="flex items-center gap-1">
                <Coins className="w-4 h-4" />
                Target: {channel.targetAddress.slice(0, 6)}...
                {channel.targetAddress.slice(-4)}
              </span>
            </div>
          </div>

          {/* Compact Participant Balances Section - Collapsible */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20 mb-4 overflow-hidden">
            {/* Header with Toggle */}
            <button
              onClick={() => setIsBalancesExpanded(!isBalancesExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-[#4fc3f7]/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#4fc3f7] p-1.5 rounded">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white">
                    Participant Balances
                  </h3>
                  <p className="text-xs text-gray-400">
                    {channel.participantCount} participants
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Quick Summary Stats */}
                <div className="hidden md:flex items-center gap-4 text-xs">
                  {isLoadingBalances ? (
                    <span className="text-gray-400">Loading...</span>
                  ) : (
                    <span className="text-gray-400">
                      Total:{" "}
                      <span className="text-white font-medium">
                        {participantBalances
                          .reduce(
                            (sum, p) =>
                              sum + parseFloat(p.currentBalance || "0"),
                            0
                          )
                          .toFixed(2)}{" "}
                        {symbol}
                      </span>
                    </span>
                  )}
                </div>
                {/* Expand/Collapse Icon */}
                <div className="text-[#4fc3f7]">
                  {isBalancesExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </button>

            {/* Expandable Content */}
            <div
              className={`transition-all duration-300 ease-in-out ${
                isBalancesExpanded
                  ? "max-h-[600px] opacity-100"
                  : "max-h-0 opacity-0"
              } overflow-hidden`}
            >
              <div className="px-4 pb-4 space-y-6">
                {/* Initial Deposits Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-2">
                      <div className="w-1 h-1 bg-[#4fc3f7] rounded-full" />
                      Initial Deposits (Channel Creation)
                    </h4>
                    {initialMerkleRoot !== "N/A" && (
                      <div className="flex items-center gap-2 bg-[#0a1930]/70 border border-[#4fc3f7]/20 px-3 py-1 rounded">
                        <Hash className="w-3 h-3 text-[#4fc3f7]" />
                        <span className="text-[10px] text-gray-400">
                          Initial Root:
                        </span>
                        <span className="font-mono text-[10px] text-[#4fc3f7]">
                          {initialMerkleRoot.slice(0, 8)}...{initialMerkleRoot.slice(-6)}
                        </span>
                      </div>
                    )}
                  </div>
                  {isLoadingBalances ? (
                    <div className="text-center py-4">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {participantBalances.map((participant, index) => (
                        <div
                          key={participant.address}
                          className={`bg-[#0a1930]/50 border p-3 hover:border-[#4fc3f7]/50 transition-all rounded ${
                            participant.address.toLowerCase() ===
                            userAddress?.toLowerCase()
                              ? "border-[#4fc3f7]/50 bg-[#4fc3f7]/5"
                              : "border-[#4fc3f7]/20"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-[#4fc3f7] px-1.5 py-0.5 rounded text-white font-bold text-[10px]">
                              #{index + 1}
                            </span>
                            <span className="font-mono text-xs text-[#4fc3f7] truncate flex-1">
                              {participant.address.slice(0, 6)}...
                              {participant.address.slice(-4)}
                            </span>
                            {participant.address.toLowerCase() ===
                              userAddress?.toLowerCase() && (
                              <span className="text-[9px] text-[#4fc3f7] bg-[#4fc3f7]/20 px-1 rounded">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 bg-[#1a2347]/50 px-2 py-1 rounded text-xs">
                            <Coins className="w-3 h-3 text-[#4fc3f7]" />
                            <span className="font-medium text-white">
                              {parseFloat(participant.initialDeposit).toFixed(
                                2
                              )}
                            </span>
                            <span className="text-gray-400">
                              {participant.symbol}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current State Balances Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-2">
                      <div className="w-1 h-1 bg-green-500 rounded-full" />
                      Current State Balances (Latest Approved State)
                    </h4>
                    {currentMerkleRoot !== "N/A" && (
                      <div className="flex items-center gap-2 bg-[#0a1930]/70 border border-green-500/20 px-3 py-1 rounded">
                        <Hash className="w-3 h-3 text-green-400" />
                        <span className="text-[10px] text-gray-400">
                          Current Root:
                        </span>
                        <span className="font-mono text-[10px] text-green-400">
                          {currentMerkleRoot.slice(0, 8)}...{currentMerkleRoot.slice(-6)}
                        </span>
                      </div>
                    )}
                  </div>
                  {isLoadingBalances ? (
                    <div className="text-center py-4">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {participantBalances.map((participant, index) => (
                        <div
                          key={participant.address}
                          className={`bg-[#0a1930]/50 border p-3 hover:border-green-500/50 transition-all rounded ${
                            participant.address.toLowerCase() ===
                            userAddress?.toLowerCase()
                              ? "border-green-500/50 bg-green-500/5"
                              : "border-green-500/20"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-green-500 px-1.5 py-0.5 rounded text-white font-bold text-[10px]">
                              #{index + 1}
                            </span>
                            <span className="font-mono text-xs text-green-400 truncate flex-1">
                              {participant.address.slice(0, 6)}...
                              {participant.address.slice(-4)}
                            </span>
                            {participant.address.toLowerCase() ===
                              userAddress?.toLowerCase() && (
                              <span className="text-[9px] text-green-400 bg-green-500/20 px-1 rounded">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 bg-[#1a2347]/50 px-2 py-1 rounded text-xs">
                            <Coins className="w-3 h-3 text-green-400" />
                            <span className="font-medium text-white">
                              {parseFloat(participant.currentBalance).toFixed(
                                2
                              )}
                            </span>
                            <span className="text-gray-400">
                              {participant.symbol}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Preview when collapsed - show first few participants inline */}
            {!isBalancesExpanded && (
              <div className="px-4 pb-3 flex flex-wrap gap-2 text-xs">
                {isLoadingBalances ? (
                  <span className="text-gray-400">Loading balances...</span>
                ) : (
                  <>
                    {participantBalances
                      .slice(0, 4)
                      .map((participant, index) => (
                        <div
                          key={participant.address}
                          className={`flex items-center gap-1.5 bg-[#0a1930]/50 border px-2 py-1 rounded ${
                            participant.address.toLowerCase() ===
                            userAddress?.toLowerCase()
                              ? "border-[#4fc3f7]/30"
                              : "border-[#4fc3f7]/10"
                          }`}
                        >
                          <span className="bg-[#4fc3f7]/80 px-1 rounded text-white font-bold text-[9px]">
                            #{index + 1}
                          </span>
                          <span className="font-mono text-[#4fc3f7]/80 text-[10px]">
                            {participant.address.slice(0, 4)}...
                            {participant.address.slice(-3)}
                          </span>
                          {participant.address.toLowerCase() ===
                            userAddress?.toLowerCase() && (
                            <span className="text-[8px] text-[#4fc3f7]">
                              (you)
                            </span>
                          )}
                        </div>
                      ))}
                    {participantBalances.length > 4 && (
                      <div className="flex items-center text-gray-400">
                        +{participantBalances.length - 4} more
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Main Content Area - Dashboard Style Border */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20 mb-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Total Proofs */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">
                    Total Proofs
                  </span>
                  <div className="bg-[#4fc3f7] p-2 rounded">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {stats.total}
                </div>
              </div>

              {/* Verified */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">
                    Verified
                  </span>
                  <div className="bg-green-500 p-2 rounded">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-green-400">
                  {stats.verified}
                </div>
              </div>

              {/* Pending */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">
                    Pending
                  </span>
                  <div className="bg-yellow-500 p-2 rounded">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-yellow-400">
                  {stats.pending}
                </div>
              </div>

              {/* Rejected */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">
                    Rejected
                  </span>
                  <div className="bg-red-500 p-2 rounded">
                    <XCircle className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-red-400">
                  {stats.rejected}
                </div>
              </div>
            </div>

            {/* Filter and Refresh */}
            <div className="mb-6 flex items-center justify-between">
              <Select
                value={filter}
                onValueChange={(value: any) => setFilter(value)}
              >
                <SelectTrigger className="w-48 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2347] border-[#4fc3f7]/30 text-white">
                  <SelectItem value="all">All Proofs</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh Button */}
              <button
                onClick={fetchProofs}
                disabled={isLoadingProofs}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4fc3f7] to-[#2196f3] text-white rounded-lg hover:from-[#2196f3] hover:to-[#1976d2] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoadingProofs ? "animate-spin" : ""}`}
                />
                <span>
                  {isLoadingProofs ? "Refreshing..." : "Refresh Proofs"}
                </span>
              </button>
            </div>

            {/* State Transition Timeline */}
            {stateTransitions.length > 0 && (
              <div className="mb-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/50 shadow-lg overflow-hidden">
                {/* Collapsible Header */}
                <button
                  onClick={() => setIsTransitionsExpanded(!isTransitionsExpanded)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#4fc3f7]/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-[#4fc3f7] p-1.5 rounded">
                      <Layers className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-white">
                        State Transition History
                      </h3>
                      <p className="text-xs text-gray-400">
                        {stateTransitions.length} state{stateTransitions.length > 1 ? 's' : ''} recorded
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Quick Summary */}
                    <div className="hidden md:flex items-center gap-2 text-xs">
                      <span className="bg-[#4fc3f7]/20 text-[#4fc3f7] px-2 py-0.5 rounded font-medium">
                        {stateTransitions.length} STATES
                      </span>
                      {stateTransitions.length > 0 && (
                        <span className="text-gray-400">
                          Latest: #{stateTransitions[stateTransitions.length - 1]?.sequenceNumber}
                        </span>
                      )}
                    </div>
                    {/* Expand/Collapse Icon */}
                    <div className="text-[#4fc3f7]">
                      {isTransitionsExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expandable Content */}
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isTransitionsExpanded
                      ? "max-h-[600px] opacity-100"
                      : "max-h-0 opacity-0"
                  } overflow-hidden`}
                >
                  <div className="px-4 pb-4">
                    <p className="text-gray-400 text-sm mb-4">
                      Track how participant balances have evolved through each approved state transition
                    </p>

                    {isLoadingTransitions ? (
                      <div className="text-center py-8">
                        <LoadingSpinner size="md" />
                        <p className="text-gray-400 text-sm mt-4">Loading state history...</p>
                      </div>
                    ) : (
                      <div 
                        className={`space-y-4 ${
                          stateTransitions.length > 3 ? 'max-h-[450px] overflow-y-auto pr-2 scrollbar-thin' : ''
                        }`}
                      >
                        {stateTransitions.map((transition, idx) => (
                          <div
                            key={transition.proofId}
                            className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded-lg p-4 hover:border-[#4fc3f7]/50 transition-all"
                          >
                            {/* Transition Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="bg-[#4fc3f7]/20 px-3 py-1 rounded">
                                  <span className="text-[#4fc3f7] font-bold text-sm">
                                    #{transition.sequenceNumber}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-white font-medium text-sm">
                                    {transition.proofId}
                                  </div>
                                  <div className="text-gray-400 text-xs">
                                    {new Date(transition.timestamp).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-gray-400 text-xs">Submitter</div>
                                <div className="text-white font-mono text-xs">
                                  {transition.submitter.slice(0, 6)}...{transition.submitter.slice(-4)}
                                </div>
                              </div>
                            </div>

                            {/* Merkle Roots */}
                            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-[#1a2347]/50 rounded">
                              <div>
                                <div className="text-gray-400 text-[10px] mb-1 flex items-center gap-1">
                                  <Hash className="w-3 h-3" />
                                  Initial Root
                                </div>
                                <div className="text-[#4fc3f7] font-mono text-[10px]">
                                  {transition.merkleRoots.initial.slice(0, 10)}...
                                  {transition.merkleRoots.initial.slice(-8)}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-400 text-[10px] mb-1 flex items-center gap-1">
                                  <Hash className="w-3 h-3" />
                                  Resulting Root
                                </div>
                                <div className="text-green-400 font-mono text-[10px]">
                                  {transition.merkleRoots.resulting.slice(0, 10)}...
                                  {transition.merkleRoots.resulting.slice(-8)}
                                </div>
                              </div>
                            </div>

                            {/* Balance Changes */}
                            <div>
                              <div className="text-gray-400 text-xs mb-2 font-semibold">
                                Balance Changes
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {transition.balanceChanges.map((change, changeIdx) => {
                                  const hasChange = parseFloat(change.change) !== 0;
                                  const isIncrease = parseFloat(change.change) > 0;
                                  
                                  return (
                                    <div
                                      key={change.address}
                                      className={`p-2 rounded text-xs ${
                                        hasChange
                                          ? isIncrease
                                            ? "bg-green-500/10 border border-green-500/30"
                                            : "bg-red-500/10 border border-red-500/30"
                                          : "bg-[#1a2347]/30 border border-[#4fc3f7]/10"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 mb-1">
                                        <span className="bg-[#4fc3f7]/20 px-1 rounded text-[#4fc3f7] font-bold text-[9px]">
                                          #{changeIdx + 1}
                                        </span>
                                        <span className="text-gray-300 font-mono text-[10px]">
                                          {change.address.slice(0, 6)}...{change.address.slice(-4)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <span className="text-gray-400 text-[10px]">
                                            {change.before} →{" "}
                                          </span>
                                          <span className="text-white font-medium text-[10px]">
                                            {change.after}
                                          </span>
                                        </div>
                                        {hasChange && (
                                          <span
                                            className={`font-bold text-[10px] ${
                                              isIncrease ? "text-green-400" : "text-red-400"
                                            }`}
                                          >
                                            {change.change} {symbol}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Scroll indicator when there are more than 3 transitions */}
                    {stateTransitions.length > 3 && (
                      <div className="mt-3 text-center text-xs text-gray-500">
                        <span className="bg-[#1a2347]/50 px-3 py-1 rounded">
                          Scroll to see all {stateTransitions.length} state transitions
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview when collapsed */}
                {!isTransitionsExpanded && (
                  <div className="px-4 pb-3 flex flex-wrap gap-2 text-xs">
                    {stateTransitions.slice(-3).map((transition) => (
                      <div
                        key={transition.proofId}
                        className="flex items-center gap-1.5 bg-[#0a1930]/50 border border-[#4fc3f7]/10 px-2 py-1 rounded"
                      >
                        <span className="bg-[#4fc3f7]/20 px-1 rounded text-[#4fc3f7] font-bold text-[9px]">
                          #{transition.sequenceNumber}
                        </span>
                        <span className="text-gray-400 text-[10px]">
                          {new Date(transition.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {stateTransitions.length > 3 && (
                      <div className="flex items-center text-gray-400">
                        +{stateTransitions.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Pending Proofs Approval Section (Leader Only) */}
            {channel.isLeader &&
              proofs.filter((p) => p.status === "pending").length > 0 && (
                <div className="mb-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-amber-500/50 p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-semibold text-white">
                      Pending Proofs Approval
                    </h3>
                    <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded font-medium">
                      LEADER ACTION REQUIRED
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Select one proof to approve. All other proofs in the same
                    sequence will be automatically rejected.
                  </p>

                  <div className="space-y-3 mb-4">
                    {proofs
                      .filter((p) => p.status === "pending")
                      .map((proof) => (
                        <label
                          key={proof.key || proof.id}
                          className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedProofForApproval === proof.key
                              ? "bg-amber-500/10 border-amber-500/50"
                              : "bg-[#0a1930]/50 border-[#4fc3f7]/30 hover:border-amber-500/30"
                          }`}
                        >
                          <input
                            type="radio"
                            name="proofApproval"
                            value={proof.key as string}
                            checked={selectedProofForApproval === proof.key}
                            onChange={(e) =>
                              setSelectedProofForApproval(e.target.value)
                            }
                            className="w-4 h-4 text-amber-500 focus:ring-amber-500 focus:ring-2"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-medium">
                                {proof.id || proof.proofId || proof.key}
                              </span>
                              <span className="text-xs text-gray-400">
                                Sequence #{proof.sequenceNumber}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-400">
                                  Submitted:{" "}
                                </span>
                                <span className="text-white">
                                  {proof.timestamp
                                    ? new Date(proof.timestamp).toLocaleString()
                                    : "N/A"}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">
                                  Submitter:{" "}
                                </span>
                                <span className="text-white font-mono text-xs">
                                  {proof.submitter
                                    ? `${proof.submitter.slice(
                                        0,
                                        6
                                      )}...${proof.submitter.slice(-4)}`
                                    : "Unknown"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                  </div>

                  <button
                    onClick={async () => {
                      if (!selectedProofForApproval) return;
                      const proofToApprove = proofs.find(
                        (p) => p.key === selectedProofForApproval
                      );
                      if (proofToApprove) {
                        await handleVerifyProof(proofToApprove);
                        setSelectedProofForApproval(null);
                      }
                    }}
                    disabled={!selectedProofForApproval || isVerifying !== null}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Approve Selected Proof
                      </>
                    )}
                  </button>
                </div>
              )}

            {/* Proof Cards Grid */}
            {isLoadingProofs ? (
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/50 p-12 text-center">
                <LoadingSpinner size="lg" />
                <p className="text-gray-400 mt-4">Loading proofs...</p>
              </div>
            ) : filteredProofs.length === 0 ? (
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/50 p-12 text-center">
                <Activity className="h-12 w-12 text-[#4fc3f7] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  {proofs.length === 0
                    ? "No Proofs Submitted"
                    : "No Proofs Match Filter"}
                </h3>
                <p className="text-gray-400">
                  {proofs.length === 0
                    ? "This channel has been initialized but no proofs have been submitted yet."
                    : "No proofs match the selected filter"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProofs.map((proof) => (
                  <ProofCard
                    key={proof.id || proof.key}
                    proof={proof}
                    isLeader={channel.isLeader}
                    onVerify={handleVerifyProof}
                    isVerifying={isVerifying === proof.key}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Bundle Modal */}
      <TransactionBundleModal
        isOpen={isBundleModalOpen}
        onClose={() => setIsBundleModalOpen(false)}
        defaultChannelId={channel.id.toString()}
      />

      {/* Submit Proof Modal */}
      <SubmitProofModal
        isOpen={isSubmitProofModalOpen}
        onClose={() => setIsSubmitProofModalOpen(false)}
        channelId={channel.id}
        onUploadSuccess={fetchProofs}
      />
    </>
  );
}

// Main Page Component
export default function StateExplorerPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const searchParams = useSearchParams();
  const [selectedChannel, setSelectedChannel] = useState<OnChainChannel | null>(
    null
  );
  // Cache key for localStorage
  const getCacheKey = (addr: string) =>
    `state-explorer-channels-${addr.toLowerCase()}`;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Load cached channels
  const loadCachedChannels = (addr: string): OnChainChannel[] | null => {
    try {
      const cacheKey = getCacheKey(addr);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        if (now - timestamp < CACHE_DURATION) {
          console.log("State Explorer: Loading channels from cache");
          return data;
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn("State Explorer: Failed to load cache", error);
    }
    return null;
  };

  const [channels, setChannels] = useState<OnChainChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false); // Track if cache was loaded

  // Check cache immediately when address or connection status changes (before render)
  useLayoutEffect(() => {
    if (address && isConnected) {
      const cachedChannels = loadCachedChannels(address);
      if (cachedChannels && cachedChannels.length > 0) {
        setChannels(cachedChannels);
        setIsLoading(false);
        setCacheLoaded(true); // Mark that cache was loaded
        return; // Early return to prevent useEffect from fetching
      }
    }
    // If no cache or not connected, set loading state appropriately
    if (!isConnected || !address) {
      setIsLoading(false);
      setCacheLoaded(false);
    } else {
      setCacheLoaded(false); // No cache found
    }
  }, [address, isConnected]);

  // Save channels to cache
  const saveChannelsToCache = (
    addr: string,
    channelsData: OnChainChannel[]
  ) => {
    try {
      const cacheKey = getCacheKey(addr);
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: channelsData,
          timestamp: Date.now(),
        })
      );
      console.log("State Explorer: Saved channels to cache");
    } catch (error) {
      console.warn("State Explorer: Failed to save cache", error);
    }
  };

  // Fetch user's channels from blockchain
  const fetchChannels = async (forceRefresh = false) => {
    if (!address || !publicClient) {
      console.log("State Explorer: Missing address or publicClient", {
        address,
        publicClient: !!publicClient,
      });
      return;
    }

    // Try to load from cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedChannels = loadCachedChannels(address);
      if (cachedChannels && cachedChannels.length > 0) {
        setChannels(cachedChannels);
        setIsLoading(false);
        // Still fetch in background to update cache
        fetchChannels(true).catch(console.error);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get the next channel ID to know how many channels exist
      const nextChannelId = (await publicClient.readContract({
        address: ROLLUP_BRIDGE_CORE_ADDRESS,
        abi: ROLLUP_BRIDGE_CORE_ABI,
        functionName: "nextChannelId",
      })) as bigint;

      const totalChannels = Number(nextChannelId);
      console.log(
        `State Explorer: Checking ${
          totalChannels - 1
        } channels for user ${address}`
      );
      const userChannels: OnChainChannel[] = [];

      // Check each channel if user is a participant
      for (let i = 1; i < totalChannels; i++) {
        try {
          // First check if channel exists by getting the leader
          const leader = (await publicClient.readContract({
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: "getChannelLeader",
            args: [BigInt(i)],
          })) as string;

          // Skip if channel doesn't exist (zero address)
          if (
            !leader ||
            leader === "0x0000000000000000000000000000000000000000"
          ) {
            continue;
          }

          // Get participants to check if user is a participant
          const participants = (await publicClient.readContract({
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: "getChannelParticipants",
            args: [BigInt(i)],
          })) as string[];

          // Check if user is a participant (case-insensitive comparison)
          const isParticipant = participants.some(
            (p) => p.toLowerCase() === address.toLowerCase()
          );

          // Also check if user is the leader
          const isLeader = leader.toLowerCase() === address.toLowerCase();

          console.log(
            `State Explorer: Channel ${i} - Leader: ${leader}, Participants: ${participants.length}, IsParticipant: ${isParticipant}, IsLeader: ${isLeader}`
          );

          if (isParticipant || isLeader) {
            console.log(`State Explorer: Adding channel ${i} to user channels`);
            // Fetch remaining channel details
            // getChannelInfo returns: [targetAddress, state, participantCount, initialRoot]
            const [channelInfo, publicKey, targetAddress] = await Promise.all([
              publicClient.readContract({
                address: ROLLUP_BRIDGE_CORE_ADDRESS,
                abi: ROLLUP_BRIDGE_CORE_ABI,
                functionName: "getChannelInfo",
                args: [BigInt(i)],
              }) as Promise<
                readonly [`0x${string}`, number, bigint, `0x${string}`]
              >,
              publicClient.readContract({
                address: ROLLUP_BRIDGE_CORE_ADDRESS,
                abi: ROLLUP_BRIDGE_CORE_ABI,
                functionName: "getChannelPublicKey",
                args: [BigInt(i)],
              }) as Promise<[bigint, bigint]>,
              publicClient.readContract({
                address: ROLLUP_BRIDGE_CORE_ADDRESS,
                abi: ROLLUP_BRIDGE_CORE_ABI,
                functionName: "getChannelTargetContract",
                args: [BigInt(i)],
              }) as Promise<string>,
            ]);

            // channelInfo structure: [targetAddress, state, participantCount, initialRoot]
            const state = channelInfo[1];
            const participantCount = Number(channelInfo[2]);

            userChannels.push({
              id: i,
              state: state,
              participantCount: participantCount,
              participants: participants,
              leader: leader,
              isLeader: isLeader,
              targetAddress: targetAddress,
              hasPublicKey:
                publicKey[0] !== BigInt(0) || publicKey[1] !== BigInt(0),
            });
          }
        } catch (err) {
          console.warn(`Error fetching channel ${i}:`, err);
          // Continue to next channel
        }
      }

      console.log(
        `State Explorer: Found ${userChannels.length} channels for user`
      );
      setChannels(userChannels);
      // Save to cache
      saveChannelsToCache(address, userChannels);
    } catch (err) {
      console.error("State Explorer: Failed to fetch channels:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch channels");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch channels on mount and when address changes
  useEffect(() => {
    if (isConnected && address && publicClient) {
      // If cache was already loaded in useLayoutEffect, skip fetching
      if (cacheLoaded) {
        // Cache was loaded, optionally update in background (but don't show loading)
        // Only update if cache is getting old (more than 2 minutes)
        const cacheKey = getCacheKey(address);
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            const now = Date.now();
            // Only update in background if cache is older than 2 minutes
            if (now - timestamp > 2 * 60 * 1000) {
              fetchChannels(true).catch(console.error);
            }
          }
        } catch (error) {
          // Ignore cache read errors
        }
        return; // Don't fetch again
      }

      // No cache was loaded, fetch fresh data
      fetchChannels(false);
    } else if (!isConnected) {
      setChannels([]);
      setIsLoading(false);
      setCacheLoaded(false);
    }
  }, [isConnected, address, publicClient, cacheLoaded]);

  // Auto-select channel from URL query parameter
  useEffect(() => {
    const channelIdParam = searchParams.get("channelId");
    if (channelIdParam && channels.length > 0 && !selectedChannel) {
      const channelIdNum = parseInt(channelIdParam, 10);
      const channel = channels.find((c) => c.id === channelIdNum);
      if (channel) {
        setSelectedChannel(channel);
      }
    }
  }, [searchParams, channels, selectedChannel]);

  const handleSelectChannel = (channel: OnChainChannel) => {
    setSelectedChannel(channel);
  };

  const handleBack = () => {
    setSelectedChannel(null);
  };

  return (
    <Layout>
      {selectedChannel ? (
        <StateExplorerDetailView
          channel={selectedChannel}
          onBack={handleBack}
          userAddress={address || ""}
        />
      ) : (
        <ChannelSelectionView
          channels={channels}
          onSelectChannel={handleSelectChannel}
          isLoading={isLoading}
          onRefresh={() => fetchChannels(true)}
          error={error}
        />
      )}
    </Layout>
  );
}
