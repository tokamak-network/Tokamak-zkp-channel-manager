"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useContractWrite,
  usePrepareContractWrite,
  useContractRead,
  useWaitForTransaction,
  useNetwork,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ROLLUP_BRIDGE_CORE_ABI,
  ROLLUP_BRIDGE_CORE_ADDRESS,
  TON_TOKEN_ADDRESS,
  WTON_TOKEN_ADDRESS,
  USDT_TOKEN_ADDRESS,
} from "@/lib/contracts";
import { setData } from "@/lib/realtime-db-helpers";
import { Sidebar } from "@/components/Sidebar";
import { ClientOnly } from "@/components/ClientOnly";
import { MobileNavigation } from "@/components/MobileNavigation";
import { Footer } from "@/components/Footer";
import { AlertTriangle, Lightbulb, CheckCircle, Wand2 } from "lucide-react";

// Check if dev mode is enabled
const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

interface Participant {
  address: string;
}

export default function CreateChannelPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Check total channel count
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "nextChannelId",
    enabled: isConnected,
  });

  // Check if user is already a channel leader by checking each channel
  const channelCount = totalChannels ? Number(totalChannels) : 0;
  const [leaderChannelId, setLeaderChannelId] = useState<number | null>(null);

  // Use individual reads for channel leaders (up to 10 channels)
  const { data: leader0 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(0)],
    enabled: isConnected && channelCount > 0,
  });

  const { data: leader1 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(1)],
    enabled: isConnected && channelCount > 1,
  });

  const { data: leader2 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(2)],
    enabled: isConnected && channelCount > 2,
  });

  const { data: leader3 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(3)],
    enabled: isConnected && channelCount > 3,
  });

  const { data: leader4 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(4)],
    enabled: isConnected && channelCount > 4,
  });

  const { data: leader5 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(5)],
    enabled: isConnected && channelCount > 5,
  });

  const { data: leader6 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(6)],
    enabled: isConnected && channelCount > 6,
  });

  const { data: leader7 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(7)],
    enabled: isConnected && channelCount > 7,
  });

  const { data: leader8 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(8)],
    enabled: isConnected && channelCount > 8,
  });

  const { data: leader9 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelLeader",
    args: [BigInt(9)],
    enabled: isConnected && channelCount > 9,
  });

  // Check channel states (to exclude closed channels)
  const { data: state0 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(0)],
    enabled: isConnected && channelCount > 0,
  });

  const { data: state1 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(1)],
    enabled: isConnected && channelCount > 1,
  });

  const { data: state2 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(2)],
    enabled: isConnected && channelCount > 2,
  });

  const { data: state3 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(3)],
    enabled: isConnected && channelCount > 3,
  });

  const { data: state4 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(4)],
    enabled: isConnected && channelCount > 4,
  });

  const { data: state5 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(5)],
    enabled: isConnected && channelCount > 5,
  });

  const { data: state6 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(6)],
    enabled: isConnected && channelCount > 6,
  });

  const { data: state7 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(7)],
    enabled: isConnected && channelCount > 7,
  });

  const { data: state8 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(8)],
    enabled: isConnected && channelCount > 8,
  });

  const { data: state9 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelState",
    args: [BigInt(9)],
    enabled: isConnected && channelCount > 9,
  });

  // Check leadership across all channels
  useEffect(() => {
    if (!address) {
      setLeaderChannelId(null);
      return;
    }

    const channels = [
      {
        id: 0,
        leader: leader0 as string | undefined,
        state: state0 as number | undefined,
      },
      {
        id: 1,
        leader: leader1 as string | undefined,
        state: state1 as number | undefined,
      },
      {
        id: 2,
        leader: leader2 as string | undefined,
        state: state2 as number | undefined,
      },
      {
        id: 3,
        leader: leader3 as string | undefined,
        state: state3 as number | undefined,
      },
      {
        id: 4,
        leader: leader4 as string | undefined,
        state: state4 as number | undefined,
      },
      {
        id: 5,
        leader: leader5 as string | undefined,
        state: state5 as number | undefined,
      },
      {
        id: 6,
        leader: leader6 as string | undefined,
        state: state6 as number | undefined,
      },
      {
        id: 7,
        leader: leader7 as string | undefined,
        state: state7 as number | undefined,
      },
      {
        id: 8,
        leader: leader8 as string | undefined,
        state: state8 as number | undefined,
      },
      {
        id: 9,
        leader: leader9 as string | undefined,
        state: state9 as number | undefined,
      },
    ];

    for (const channel of channels) {
      if (channel.leader) {
        const state = Number(channel.state ?? 0);
        // Check if this address is the leader and channel is not closed (state 5)
        if (
          channel.leader.toLowerCase() === address.toLowerCase() &&
          state !== 5
        ) {
          setLeaderChannelId(channel.id);
          return;
        }
      }
    }
    setLeaderChannelId(null);
  }, [
    address,
    leader0,
    leader1,
    leader2,
    leader3,
    leader4,
    leader5,
    leader6,
    leader7,
    leader8,
    leader9,
    state0,
    state1,
    state2,
    state3,
    state4,
    state5,
    state6,
    state7,
    state8,
    state9,
  ]);

  // Anyone can create channels now - no authorization required
  const isAuthorized = true;

  // Check if user is already a channel leader (only if channel is not closed)
  const isAlreadyLeader = leaderChannelId !== null;

  // Form state
  const [allowedTokens, setAllowedTokens] = useState<string[]>([""]);
  const [participants, setParticipants] = useState<Participant[]>([
    { address: "" },
  ]);
  const [timeout, setTimeout] = useState(1); // in days
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [createdChannelId, setCreatedChannelId] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  // Dev mode: Auto-fill test data
  const fillTestData = () => {
    // Fill with test token (TON)
    setAllowedTokens([TON_TOKEN_ADDRESS]);

    // Fill with test participants (current user + test addresses)
    const testParticipants: Participant[] = [
      { address: address || "0x0000000000000000000000000000000000000001" },
      { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
      { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
    ];
    setParticipants(testParticipants);

    // Set timeout to 7 days
    setTimeout(7);
  };

  // Add/Remove participants
  const addParticipant = () => {
    const filledTokens = allowedTokens.filter((token) => token !== "");
    const maxParticipants = getMaxParticipants(filledTokens.length || 1); // Use 1 as minimum to show limits
    if (participants.length < maxParticipants) {
      setParticipants([...participants, { address: "" }]);
    }
  };

  const removeParticipant = (index: number) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  const updateParticipant = (index: number, value: string) => {
    const newParticipants = [...participants];
    newParticipants[index].address = value;
    setParticipants(newParticipants);
  };

  // Add/Remove allowed tokens
  const addToken = () => {
    if (allowedTokens.length < 3) {
      setAllowedTokens([...allowedTokens, ""]);
    }
  };

  const removeToken = (index: number) => {
    if (allowedTokens.length > 1) {
      setAllowedTokens(allowedTokens.filter((_, i) => i !== index));
    }
  };

  const updateToken = (index: number, value: string) => {
    const newTokens = [...allowedTokens];
    newTokens[index] = value;
    setAllowedTokens(newTokens);
  };

  // Validation
  const isValidEthereumAddress = (addr: string) =>
    /^0x[a-fA-F0-9]{40}$/.test(addr);
  const isValidHex = (hex: string) => /^0x[a-fA-F0-9]+$/.test(hex);

  // Helper function to get token symbol from address
  const getTokenSymbol = (address: string): string => {
    switch (address.toLowerCase()) {
      case TON_TOKEN_ADDRESS.toLowerCase():
        return "TON";
      case WTON_TOKEN_ADDRESS.toLowerCase():
        return "WTON";
      case USDT_TOKEN_ADDRESS.toLowerCase():
        return "USDT";
      default:
        return "Token";
    }
  };

  const getMaxParticipants = (tokenCount: number) => {
    // Maximum participants based on Merkle tree constraints (max 128 leaves total)
    // Each participant needs one leaf per token
    if (tokenCount === 0) return 128;
    return Math.floor(128 / tokenCount);
  };

  // Form validation with debug info
  const getFormValidationStatus = () => {
    const filledTokens = allowedTokens.filter((token) => token !== "");
    const maxParticipants = getMaxParticipants(filledTokens.length);
    const uniqueTokens = new Set(filledTokens);
    const hasDuplicates = uniqueTokens.size !== filledTokens.length;

    const checks = {
      isAuthorized,
      notAlreadyLeader: !isAlreadyLeader,
      hasTokens: allowedTokens.length > 0,
      tokensUnder3: allowedTokens.length <= 3,
      noDuplicateTokens: !hasDuplicates,
      allTokensValid: allowedTokens.every(
        (token) =>
          token === "" ||
          token === TON_TOKEN_ADDRESS ||
          token === WTON_TOKEN_ADDRESS ||
          token === USDT_TOKEN_ADDRESS ||
          isValidEthereumAddress(token)
      ),
      hasFilledToken: filledTokens.length > 0,
      hasParticipants: participants.length >= 1,
      participantsUnderMax: participants.length <= maxParticipants,
      allParticipantsValid: participants.every((p) =>
        isValidEthereumAddress(p.address)
      ),
      validTimeout: timeout >= 1 && timeout <= 365,
    };

    return checks;
  };

  const isFormValid = () => {
    const checks = getFormValidationStatus();
    return Object.values(checks).every((v) => v === true);
  };

  // Debug: Log form validation on change
  const formValidationStatus = getFormValidationStatus();
  const failedChecks = Object.entries(formValidationStatus)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  // Prepare contract call
  const channelParams = isFormValid()
    ? {
        allowedTokens: allowedTokens
          .filter((token) => token !== "")
          .map((token) => token as `0x${string}`),
        participants: participants.map((p) => p.address as `0x${string}`),
        timeout: BigInt(timeout * 86400), // Convert days to seconds
      }
    : undefined;

  const contractConfig = channelParams ? {
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'openChannel',
    args: [channelParams],
    enabled: isFormValid() && isConnected,
  } : {
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'openChannel',
    enabled: false,
  };

  const {
    config,
    error: prepareError,
    isError: isPrepareError,
  } = usePrepareContractWrite(contractConfig as any);

  // Debug log for prepare errors
  if (isPrepareError && prepareError) {
    console.log("Contract prepare error:", prepareError.message);
  }

  const {
    write: createChannel,
    isLoading: isCreating,
    data: txData,
    error: writeError,
  } = useContractWrite({
    ...config,
    onSuccess(data) {
      setTxHash(data.hash);
    },
    onError(error) {
      console.error("Contract write error:", error);
      setTxHash("");
    },
  });

  // Save channel to Firebase Realtime Database
  const saveChannelToFirebase = async (channelId: string) => {
    try {
      const channelData = {
        channelId,
        contractAddress: ROLLUP_BRIDGE_CORE_ADDRESS,
        chainId: chain?.id || 11155111, // Use actual chain ID (default: Sepolia 11155111)
        participantAddresses: participants.map((p) => p.address),
        participantCount: participants.length,
        allowedTokens: allowedTokens.filter((token) => token !== ""),
        timeout: timeout * 86400, // in seconds
        leader: address,
        status: "pending", // Will become 'active' after DKG
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save channel data
      await setData(`channels/${channelId}`, channelData);

      // Save participants
      for (let i = 0; i < participants.length; i++) {
        const participantData = {
          address: participants[i].address,
          participantIndex: i,
          l1Address: participants[i].address,
          status: "active",
          isLeader:
            participants[i].address.toLowerCase() === address?.toLowerCase(),
          joinedAt: new Date().toISOString(),
        };
        await setData(
          `channels/${channelId}/participants/${participants[i].address}`,
          participantData
        );
      }

      console.log("✅ Channel saved to Firebase:", channelId);
    } catch (error) {
      console.error("❌ Failed to save channel to Firebase:", error);
      // Don't throw - channel is created on-chain, Firebase save is secondary
    }
  };

  // Wait for transaction confirmation
  const { isLoading: isConfirming } = useWaitForTransaction({
    hash: txData?.hash,
    enabled: !!txData?.hash,
    async onSuccess(data) {
      // Extract channel ID from transaction or use total channels + 1
      const newChannelId = totalChannels ? String(Number(totalChannels)) : "0";
      setCreatedChannelId(newChannelId);

      // Save to Firebase Realtime Database
      await saveChannelToFirebase(newChannelId);

      setShowSuccessPopup(true);
      setTxHash("");
    },
    onError(error) {
      setTxHash("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createChannel && isFormValid()) {
      createChannel();
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center space-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Connect Your Wallet
          </h1>
          <p className="text-gray-300 mb-6">
            You need to connect your wallet to create a channel
          </p>
          <ClientOnly>
            <ConnectButton />
          </ClientOnly>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-background">
      {/* Sidebar */}
      <ClientOnly>
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>

      {/* Mobile Navigation Menu */}
      <MobileNavigation
        showMobileMenu={showMobileMenu}
        setShowMobileMenu={setShowMobileMenu}
      />

      {/* Main Content Area */}
      <div className="ml-0 lg:ml-72 transition-all duration-300 flex flex-col min-h-screen">
        {/* Main Content */}
        <main className="flex-1 px-4 py-8 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 mb-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Create Multi-Token Channel</h2>
              <p className="text-gray-300">
                Set up a channel supporting multiple tokens for zero-knowledge proof operations with multiple participants.
              </p>
            </div>

            {/* Warning for users already leading a channel */}
            <ClientOnly>
              {isAlreadyLeader && (
                <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/50">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-yellow-300">Channel Creation Restricted</h3>
                  </div>
                  <p className="text-yellow-200/90 mb-3">
                    You are already leading an active channel. You can only lead one channel at a time.
                  </p>
                  <p className="text-sm text-yellow-300/80">
                    Please close your current channel before creating a new one. You can manage your existing channel from the sidebar menu.
                  </p>
                </div>
              )}
            </ClientOnly>


            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Allowed Tokens */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-gray-300">
                    Allowed Tokens ({allowedTokens.length}/3)
                  </label>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={fillTestData}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors"
                    >
                      <Wand2 className="w-4 h-4" />
                      Fill Test Data
                    </button>
                  )}
                </div>
              </div>

              {/* Warning for users already leading a channel */}
              <ClientOnly>
                {isAlreadyLeader && (
                  <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <h3 className="text-lg font-semibold text-red-300">
                        Channel Creation Blocked
                      </h3>
                    </div>
                    <p className="text-red-200/90 mb-3">
                      <strong>
                        You are already the leader of Channel #{leaderChannelId}
                        .
                      </strong>{" "}
                      Each address can only lead one channel at a time.
                    </p>
                    <p className="text-sm text-red-300/80 mb-4">
                      To create a new channel, you must first close Channel #
                      {leaderChannelId}, or use a different wallet address.
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/close-channel?channelId=${leaderChannelId}`
                          )
                        }
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                      >
                        Close Channel #{leaderChannelId}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/manage-channel?channelId=${leaderChannelId}`
                          )
                        }
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium transition-colors"
                      >
                        Manage Channel #{leaderChannelId}
                      </button>
                    </div>
                  </div>
                )}
              </ClientOnly>

              {/* Info message about leader bond requirement */}
              <ClientOnly>
                {!isAlreadyLeader && address && (
                  <div className="mb-6 p-4 bg-amber-900/20 border border-amber-500/50">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <h3 className="text-lg font-semibold text-amber-300">
                        Leader Bond Required
                      </h3>
                    </div>
                    <p className="text-amber-200/90 mb-3">
                      Creating a channel requires a 0.001 ETH leader bond
                      deposit. This bond will be returned when the channel is
                      successfully closed.
                    </p>
                    <p className="text-sm text-amber-300/80">
                      If you fail to submit proof within 7 days after the
                      channel timeout, your bond may be slashed. Fill out the
                      form below to create your channel.
                    </p>
                  </div>
                )}
              </ClientOnly>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Allowed Tokens */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-gray-300">
                      Allowed Tokens ({allowedTokens.length}/3)
                    </label>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={addToken}
                        disabled={allowedTokens.length >= 3}
                        className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors duration-200"
                      >
                        Add Token
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {allowedTokens.map((token, index) => (
                      <div
                        key={index}
                        className="border border-[#4fc3f7]/30 bg-[#0a1930]/50 p-4"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white">
                              Token {index + 1}
                            </h4>
                            {token && getTokenSymbol(token) !== "Token" && (
                              <span className="px-2 py-1 text-xs bg-green-600/20 border border-green-500/50 text-green-300 rounded">
                                {getTokenSymbol(token)}
                              </span>
                            )}
                          </div>
                          {allowedTokens.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeToken(index)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col gap-3">
                          <input
                            type="text"
                            value={token}
                            onChange={(e) => updateToken(index, e.target.value)}
                            placeholder="Enter token address or use quick select buttons below"
                            className="w-full px-3 py-2 text-sm border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                          />
                          {token &&
                            token !== TON_TOKEN_ADDRESS &&
                            token !== WTON_TOKEN_ADDRESS &&
                            token !== USDT_TOKEN_ADDRESS &&
                            !isValidEthereumAddress(token) && (
                              <p className="text-red-400 text-xs mt-1">
                                Invalid token address
                              </p>
                            )}
                          {token &&
                            allowedTokens.filter((t) => t === token).length >
                              1 && (
                              <p className="text-red-400 text-xs mt-1">
                                Duplicate token address - each token can only be
                                used once
                              </p>
                            )}

                          {/* Quick select buttons */}
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                updateToken(index, TON_TOKEN_ADDRESS)
                              }
                              className="px-2 py-1 text-xs bg-green-600/20 border border-green-500/50 text-green-300 hover:bg-green-600/40 transition-colors"
                            >
                              TON
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateToken(index, WTON_TOKEN_ADDRESS)
                              }
                              className="px-2 py-1 text-xs bg-amber-600/20 border border-amber-500/50 text-amber-300 hover:bg-amber-600/40 transition-colors"
                            >
                              WTON
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateToken(index, USDT_TOKEN_ADDRESS)
                              }
                              className="px-2 py-1 text-xs bg-purple-600/20 border border-purple-500/50 text-purple-300 hover:bg-purple-600/40 transition-colors"
                            >
                              USDT
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-gray-400 mt-2">
                    You can select up to 3 different tokens for your channel.
                    Participants will be able to deposit any of these tokens.
                  </p>

                  {/* Information for supported tokens */}
                  <div className="mt-3 p-4 bg-blue-900/20 border border-blue-500/50">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-blue-400" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-blue-300 mb-2">
                          Supported Tokens
                        </h4>
                        <p className="text-blue-200/90 text-sm mb-3">
                          Currently supported: TON (18 decimals), WTON, and USDT
                          tokens. Use the quick select buttons above for easy
                          selection.
                        </p>
                        <div className="space-y-1 text-xs text-blue-200/80">
                          <p>• TON: {TON_TOKEN_ADDRESS}</p>
                          <p>• WTON: {WTON_TOKEN_ADDRESS}</p>
                          <p>• USDT: {USDT_TOKEN_ADDRESS}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Whitelisted Participants */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-gray-300">
                      Whitelisted Participants ({participants.length}/
                      {getMaxParticipants(
                        allowedTokens.filter((token) => token !== "").length ||
                          1
                      )}
                      )
                    </label>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={addParticipant}
                        disabled={
                          participants.length >=
                          getMaxParticipants(
                            allowedTokens.filter((token) => token !== "")
                              .length || 1
                          )
                        }
                        className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors duration-200"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {participants.map((participant, index) => (
                      <div
                        key={index}
                        className="border border-[#4fc3f7]/30 bg-[#0a1930]/50 p-4"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium text-white">
                            Whitelisted Participant {index + 1}
                          </h4>
                          {participants.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeParticipant(index)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            L1 Address
                          </label>
                          <input
                            type="text"
                            value={participant.address}
                            onChange={(e) =>
                              updateParticipant(index, e.target.value)
                            }
                            placeholder="0x..."
                            className="w-full px-3 py-2 text-sm border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                          />
                          {participant.address &&
                            !isValidEthereumAddress(participant.address) && (
                              <p className="text-red-400 text-xs mt-1">
                                Invalid address
                              </p>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-gray-400 mt-2">
                    Minimum 1 whitelisted participant, maximum{" "}
                    {getMaxParticipants(
                      allowedTokens.filter((token) => token !== "").length || 1
                    )}{" "}
                    whitelisted participants.
                  </p>

                  <div className="mt-3 p-4 bg-blue-900/20 border border-blue-500/50">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-blue-400" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-blue-300 mb-2">
                          L2 MPT Keys
                        </h4>
                        <p className="text-blue-200/90 text-sm">
                          L2 MPT keys are no longer provided during channel
                          creation. Whitelisted participants will provide their
                          L2 MPT keys when making deposits for each token type.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeout */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Channel Timeout (days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={timeout}
                    onChange={(e) => setTimeout(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] focus:border-[#4fc3f7]"
                  />
                  <p className="text-sm text-gray-400 mt-1">
                    Channel timeout period (1 day to 365 days)
                  </p>
                </div>

                {/* DKG Management Information */}
                <div className="p-4 bg-blue-900/20 border border-blue-500/50">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-blue-400" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-300 mb-2">
                        Distributed Key Generation (DKG)
                      </h4>
                      <p className="text-blue-200/90 text-sm mb-3">
                        The group public key will be set later through the DKG
                        Management process after channel creation. This ensures
                        proper key generation ceremony between all participants.
                      </p>
                      <p className="text-xs text-blue-200/80">
                        After creating the channel, use the "DKG Management"
                        page to coordinate the key generation ceremony with all
                        participants.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Validation Debug (only shown when there are issues) */}
                {failedChecks.length > 0 && (
                  <div className="p-4 bg-yellow-900/20 border border-yellow-500/50">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-300 mb-2">
                          Form Validation Issues
                        </h4>
                        <ul className="text-yellow-200/90 text-sm space-y-1">
                          {failedChecks.includes("hasFilledToken") && (
                            <li>• Please select at least one token</li>
                          )}
                          {failedChecks.includes("allTokensValid") && (
                            <li>• One or more token addresses are invalid</li>
                          )}
                          {failedChecks.includes("noDuplicateTokens") && (
                            <li>• Duplicate tokens are not allowed</li>
                          )}
                          {failedChecks.includes("hasParticipants") && (
                            <li>• Please add at least one participant</li>
                          )}
                          {failedChecks.includes("allParticipantsValid") && (
                            <li>
                              • One or more participant addresses are invalid
                              (must be 0x + 40 hex characters)
                            </li>
                          )}
                          {failedChecks.includes("participantsUnderMax") && (
                            <li>
                              • Too many participants for selected number of
                              tokens
                            </li>
                          )}
                          {failedChecks.includes("validTimeout") && (
                            <li>• Timeout must be between 1 and 365 days</li>
                          )}
                          {failedChecks.includes("notAlreadyLeader") && (
                            <li>• You are already leading a channel</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-sm text-gray-400 mt-2">
                  Minimum 1 whitelisted participant, maximum {getMaxParticipants(allowedTokens.filter(token => token !== '').length || 1)} whitelisted participants.
                </p>
                
              </div>

              {/* Timeout */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Channel Timeout (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={timeout}
                  onChange={(e) => setTimeout(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] focus:border-[#4fc3f7]"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Channel timeout period (1 day to 365 days)
                </p>
              </div>


              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={!isFormValid() || isCreating || isConfirming}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#4fc3f7] to-[#029bee] text-white font-medium hover:from-[#029bee] hover:to-[#4fc3f7] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] transition-all duration-200"
                >
                  {isCreating 
                    ? 'Submitting Transaction...' 
                    : isConfirming
                    ? 'Waiting for Confirmation...'
                    : isAlreadyLeader 
                    ? 'Already Leading a Channel' 
                    : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>

          {/* Info Panel */}
          <div className="bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 p-8">
            <h3 className="font-semibold text-[#4fc3f7] mb-4">Channel Requirements & Workflow</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Maximum participants: 128 total leaves (participants × tokens ≤ 128)</li>
              <li>• 1 token = 128 max participants, 2 tokens = 64 max, 3 tokens = 42 max</li>
              <li>• Minimum 1 whitelisted participant required</li>
              <li>• Timeout must be between 1 hour and 365 days</li>
            </ul>
          </div>
        </div>
        </main>

        {/* Footer */}
        <Footer className="mt-auto" />
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-xl shadow-[#4fc3f7]/30 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#4fc3f7]/30">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-green-500/20 border border-green-500/50 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Channel Created Successfully!
                  </h2>
                  <p className="text-sm text-gray-300">
                    Channel ID: {createdChannelId}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Next Steps
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div className="flex items-start gap-3 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/20">
                  <span className="text-[#4fc3f7] font-bold text-lg">1.</span>
                  <div>
                    <p className="font-medium text-white mb-1">
                      Coordinate DKG Ceremony
                    </p>
                    <p>
                      Use the DKG Management page to coordinate the distributed
                      key generation ceremony with all participants.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/20">
                  <span className="text-[#4fc3f7] font-bold text-lg">2.</span>
                  <div>
                    <p className="font-medium text-white mb-1">
                      Wait for Participants to Deposit
                    </p>
                    <p>
                      All whitelisted participants need to deposit their tokens
                      into the channel.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/20">
                  <span className="text-[#4fc3f7] font-bold text-lg">3.</span>
                  <div>
                    <p className="font-medium text-white mb-1">
                      Initialize Channel State
                    </p>
                    <p>
                      As the channel leader, you'll need to initialize the
                      channel state once DKG and deposits are complete.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/20">
                  <span className="text-[#4fc3f7] font-bold text-lg">4.</span>
                  <div>
                    <p className="font-medium text-white mb-1">
                      Proof Operations & Close
                    </p>
                    <p>
                      Submit aggregated proofs, collect signatures, close the
                      channel, and allow whitelisted participants to withdraw.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50">
                <p className="text-sm text-gray-300">
                  <span className="font-medium text-[#4fc3f7] inline-flex items-center gap-1">
                    <Lightbulb className="w-4 h-4" /> Tip:
                  </span>{" "}
                  You can manage your channel and monitor participant deposits
                  from the dashboard. Use the sidebar menu to access channel
                  leader functions.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#4fc3f7]/30 flex gap-3">
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="flex-1 px-4 py-2 text-gray-300 bg-[#0a1930] border border-[#4fc3f7]/30 hover:bg-[#1a2347] hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSuccessPopup(false);
                  router.push("/");
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#4fc3f7] to-[#029bee] text-white hover:from-[#029bee] hover:to-[#4fc3f7] transition-colors font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
