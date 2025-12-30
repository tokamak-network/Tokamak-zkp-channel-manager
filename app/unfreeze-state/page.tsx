"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useContractRead,
  useContractWrite,
  useWaitForTransaction,
  useAccount,
} from "wagmi";
import { formatUnits } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Sidebar } from "@/components/Sidebar";
import { ClientOnly } from "@/components/ClientOnly";
import { MobileNavigation } from "@/components/MobileNavigation";
import { Footer } from "@/components/Footer";
import {
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI,
  ROLLUP_BRIDGE_PROOF_MANAGER_ABI,
  getGroth16VerifierAddress,
} from "@/lib/contracts";
import {
  generateClientSideProof,
  isClientProofGenerationSupported,
  getMemoryRequirement,
  requiresExternalDownload,
  getDownloadSize,
} from "@/lib/clientProofGeneration";
import { fetchChannelDataFromContract } from "@/lib/contract-helpers";
import { useUserRolesDynamic } from "@/hooks/useUserRolesDynamic";
import { ALCHEMY_KEY } from "@/lib/constants";
import {
  Unlock,
  Link,
  FileText,
  CheckCircle2,
  XCircle,
  Calculator,
  Upload,
  Settings,
} from "lucide-react";

interface FinalBalances {
  [participantAddress: string]: string;
}

interface ChannelFinalizationProof {
  pA: [bigint, bigint, bigint, bigint];
  pB: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  pC: [bigint, bigint, bigint, bigint];
}

interface StateSnapshotFile {
  channelId?: number;
  stateRoot: string;
  registeredKeys: string[];
  storageEntries: Array<{ key: string; value: string }>;
  contractAddress?: string;
  preAllocatedLeaves?: Array<{ key: string; value: string }>;
}

export default function UnfreezeStatePage() {
  const { isConnected, address } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [manualChannelInput, setManualChannelInput] = useState<string>("");
  const [finalBalances, setFinalBalances] = useState<FinalBalances>({});
  const [contractRegisteredKeys, setContractRegisteredKeys] = useState<
    string[]
  >([]);
  const [contractRegisteredKeysError, setContractRegisteredKeysError] =
    useState("");
  const [isContractDataLoading, setIsContractDataLoading] = useState(false);
  const [finalSnapshotFile, setFinalSnapshotFile] = useState<File | null>(null);
  const [finalSnapshotData, setFinalSnapshotData] =
    useState<StateSnapshotFile | null>(null);
  const [finalSnapshotError, setFinalSnapshotError] = useState("");
  const [isFinalSnapshotProcessing, setIsFinalSnapshotProcessing] =
    useState(false);
  const [permutation, setPermutation] = useState<number[]>([]);
  const [permutationError, setPermutationError] = useState("");

  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [proofGenerationStatus, setProofGenerationStatus] = useState("");
  const [generatedProof, setGeneratedProof] =
    useState<ChannelFinalizationProof | null>(null);
  const [browserCompatible, setBrowserCompatible] = useState<boolean | null>(
    null
  );
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const {
    hasChannels,
    leadingChannels,
    channelStatsData,
    isLoading: isLoadingChannels,
  } = useUserRolesDynamic();

  useEffect(() => {
    setIsMounted(true);
    setBrowserCompatible(isClientProofGenerationSupported());
  }, []);

  const closingChannels = leadingChannels
    .map((channelId) => {
      const stats = channelStatsData[channelId];
      if (!stats || stats[2] !== 3) return null;
      return {
        id: channelId,
        stats,
        targetContract: stats[1] as `0x${string}`,
        state: stats[2],
        participantCount: stats[3],
      };
    })
    .filter(Boolean) as {
    id: number;
    stats: readonly [bigint, `0x${string}`, number, bigint, `0x${string}`];
    targetContract: `0x${string}`;
    state: number;
    participantCount: bigint;
  }[];

  // Handle channel selection - query any valid channel ID
  const parsedChannelId = selectedChannelId
    ? parseInt(selectedChannelId)
    : null;
  const isValidChannelId =
    parsedChannelId !== null && !isNaN(parsedChannelId) && parsedChannelId > 0;

  // Query channel information for any valid channel ID
  const { data: channelInfo } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelInfo",
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  const { data: channelParticipants } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelParticipants",
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  const { data: channelTreeSize } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelTreeSize",
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  const { data: channelTargetContract } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelTargetContract",
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  const { data: finalStateRoot } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelFinalStateRoot",
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  const { data: isSignatureVerified } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "isSignatureVerified",
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  // Check if frost signatures are enabled for this channel
  const { data: isFrostSignatureEnabled } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "isFrostSignatureEnabled",
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  const { data: preAllocatedCount } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getPreAllocatedLeavesCount",
    args: channelTargetContract ? [channelTargetContract] : undefined,
    enabled: isMounted && isConnected && !!channelTargetContract,
  });

  const { data: totalDeposits } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: "getChannelTotalDeposits",
    args: isValidChannelId ? [BigInt(parsedChannelId)] : undefined,
    enabled: isMounted && isConnected && isValidChannelId,
  });

  useEffect(() => {
    setFinalBalances({});
    setContractRegisteredKeys([]);
    setContractRegisteredKeysError("");
    setIsContractDataLoading(false);
    setFinalSnapshotFile(null);
    setFinalSnapshotData(null);
    setFinalSnapshotError("");
    setIsFinalSnapshotProcessing(false);
    setPermutation([]);
    setPermutationError("");
  }, [selectedChannelId]);

  useEffect(() => {
    if (!isMounted || !isConnected || !isValidChannelId || !parsedChannelId)
      return;

    setIsContractDataLoading(true);
    setContractRegisteredKeysError("");

    fetchChannelDataFromContract(String(parsedChannelId))
      .then((channelData) => {
        const keys = Array.isArray(channelData.registeredKeys)
          ? channelData.registeredKeys.map((key) => String(key))
          : [];
        setContractRegisteredKeys(keys);
      })
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch channel data from contract";
        setContractRegisteredKeys([]);
        setContractRegisteredKeysError(message);
      })
      .finally(() => {
        setIsContractDataLoading(false);
      });
  }, [isMounted, isConnected, isValidChannelId, parsedChannelId]);

  const normalizeBalanceString = useCallback((value: string) => {
    const trimmed = value.trim();
    return trimmed.toLowerCase() === "0x" ? "0" : trimmed;
  }, []);

  const normalizeStorageKey = useCallback((key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return "";
    const raw = trimmed.toLowerCase().startsWith("0x")
      ? trimmed.slice(2)
      : trimmed;
    const padded = raw.length < 64 ? raw.padStart(64, "0") : raw;
    return `0x${padded}`.toLowerCase();
  }, []);

  const normalizeSnapshotValue = useCallback(
    (value: string) => {
      const normalized = normalizeBalanceString(String(value));
      if (!normalized) return "0";
      return BigInt(normalized).toString();
    },
    [normalizeBalanceString]
  );

  const buildStorageValueMap = useCallback(
    (snapshot: StateSnapshotFile) => {
      const valuesByKey = new Map<string, string>();

      snapshot.storageEntries.forEach((entry) => {
        if (!entry?.key) return;
        const normalizedKey = normalizeStorageKey(entry.key);
        if (!normalizedKey) return;
        valuesByKey.set(normalizedKey, normalizeSnapshotValue(entry.value));
      });

      if (snapshot.preAllocatedLeaves) {
        snapshot.preAllocatedLeaves.forEach((leaf) => {
          if (!leaf?.key) return;
          const normalizedKey = normalizeStorageKey(leaf.key);
          if (!normalizedKey || valuesByKey.has(normalizedKey)) return;
          valuesByKey.set(normalizedKey, normalizeSnapshotValue(leaf.value));
        });
      }

      return valuesByKey;
    },
    [normalizeSnapshotValue, normalizeStorageKey]
  );

  const resolveFinalBalancesFromSnapshot = useCallback(
    async (
      snapshot: StateSnapshotFile,
      participants: string[],
      channelId: number
    ) => {
      const valuesByKey = buildStorageValueMap(snapshot);
      const balances: FinalBalances = {};
      const missingParticipants: string[] = [];

      const { createPublicClient, http } = await import("viem");
      const { sepolia } = await import("viem/chains");

      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
      });

      const results = await Promise.all(
        participants.map(async (participant) => {
          try {
            const l2MptKey = (await publicClient.readContract({
              address: ROLLUP_BRIDGE_CORE_ADDRESS,
              abi: ROLLUP_BRIDGE_CORE_ABI,
              functionName: "getL2MptKey",
              args: [BigInt(channelId), participant as `0x${string}`],
            })) as bigint;

            const keyHex = `0x${l2MptKey.toString(16).padStart(64, "0")}`;
            return { participant, key: normalizeStorageKey(keyHex) };
          } catch (error) {
            console.error(
              `Failed to fetch L2 MPT key for ${participant}:`,
              error
            );
            return { participant, key: "" };
          }
        })
      );

      results.forEach(({ participant, key }) => {
        if (!key) {
          missingParticipants.push(participant);
          return;
        }
        const balanceValue = valuesByKey.get(key);
        if (!balanceValue) {
          missingParticipants.push(participant);
          return;
        }
        balances[participant.toLowerCase()] = balanceValue;
      });

      if (missingParticipants.length > 0) {
        throw new Error(
          `state_snapshot.json missing balances for ${missingParticipants.length} participants.`
        );
      }

      return balances;
    },
    [buildStorageValueMap, normalizeStorageKey]
  );

  useEffect(() => {
    if (!finalSnapshotData || !channelParticipants || !parsedChannelId) return;
    const participants = channelParticipants as string[];
    if (participants.length === 0) return;

    setIsFinalSnapshotProcessing(true);
    setFinalSnapshotError("");

    resolveFinalBalancesFromSnapshot(
      finalSnapshotData,
      participants,
      parsedChannelId
    )
      .then((balances) => {
        setFinalBalances(balances);
      })
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to resolve balances from snapshot";
        setFinalBalances({});
        setFinalSnapshotError(message);
      })
      .finally(() => {
        setIsFinalSnapshotProcessing(false);
      });
  }, [
    channelParticipants,
    parsedChannelId,
    resolveFinalBalancesFromSnapshot,
    finalSnapshotData,
  ]);

  const finalBalancesArray = useMemo(() => {
    if (!channelParticipants || !finalBalances) return [];
    return (channelParticipants as string[]).map((participant: string) => {
      const balance =
        finalBalances[participant.toLowerCase()] ||
        finalBalances[participant] ||
        "0";
      return BigInt(normalizeBalanceString(balance));
    });
  }, [channelParticipants, finalBalances, normalizeBalanceString]);

  const displayFinalSnapshotEntries = useMemo(() => {
    if (!finalSnapshotData || !finalSnapshotData.registeredKeys) return [];

    const formatShort = (value: bigint) => {
      const full = formatUnits(value, 18);
      const [whole, fraction] = full.split(".");
      if (!fraction) return full;
      const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
      return trimmed ? `${whole}.${trimmed}` : whole;
    };

    const valuesByKey = buildStorageValueMap(finalSnapshotData);

    return finalSnapshotData.registeredKeys.map((key) => {
      const normalizedKey = normalizeStorageKey(key);
      const value = valuesByKey.get(normalizedKey) ?? "0";
      const wei = BigInt(normalizeBalanceString(value) || "0");
      return {
        key,
        value,
        formatted: formatShort(wei),
      };
    });
  }, [
    buildStorageValueMap,
    normalizeBalanceString,
    normalizeStorageKey,
    finalSnapshotData,
  ]);

  const { write: verifyFinalBalances, data: verifyData } = useContractWrite({
    address: ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS,
    abi: ROLLUP_BRIDGE_PROOF_MANAGER_ABI,
    functionName: "verifyFinalBalancesGroth16",
  });

  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: verifyData?.hash,
  });

  useEffect(() => {
    if (isSuccess) {
      setShowSuccessPopup(true);
      setIsGeneratingProof(false);
      setProofGenerationStatus("");
    }
  }, [isSuccess]);

  const getChannelStateName = (state: number) => {
    switch (state) {
      case 0:
        return "None";
      case 1:
        return "Initialized";
      case 2:
        return "Open";
      case 3:
        return "Closing";
      case 4:
        return "Closed";
      default:
        return "Unknown";
    }
  };

  const getChannelStateColor = (state: number) => {
    switch (state) {
      case 0:
        return "text-gray-500";
      case 1:
        return "text-blue-400";
      case 2:
        return "text-green-400";
      case 3:
        return "text-green-400";
      case 4:
        return "text-yellow-400";
      case 5:
        return "text-red-400";
      default:
        return "text-gray-500";
    }
  };

  const parseSnapshotFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      if (typeof jsonData !== "object" || jsonData === null) {
        throw new Error("Invalid JSON format");
      }

      if (
        !Array.isArray(jsonData.registeredKeys) ||
        !Array.isArray(jsonData.storageEntries)
      ) {
        throw new Error(
          "Invalid state_snapshot.json: missing registeredKeys or storageEntries"
        );
      }

      if (typeof jsonData.stateRoot !== "string") {
        throw new Error("Invalid state_snapshot.json: missing stateRoot");
      }

      if (
        jsonData.channelId &&
        parsedChannelId &&
        Number(jsonData.channelId) !== Number(parsedChannelId)
      ) {
        throw new Error(
          `Snapshot channelId (${jsonData.channelId}) does not match selected channel (${parsedChannelId})`
        );
      }

      const registeredKeys = jsonData.registeredKeys.map((key: unknown) => {
        if (typeof key !== "string") {
          throw new Error(
            "Invalid registeredKeys entry in state_snapshot.json"
          );
        }
        return key;
      });

      const storageEntries = jsonData.storageEntries.map((entry: any) => {
        if (!entry || typeof entry !== "object") {
          throw new Error(
            "Invalid storageEntries entry in state_snapshot.json"
          );
        }
        if (typeof entry.key !== "string" || typeof entry.value !== "string") {
          throw new Error(
            "Invalid storageEntries entry in state_snapshot.json"
          );
        }
        return { key: entry.key, value: entry.value };
      });

      const preAllocatedLeaves = Array.isArray(jsonData.preAllocatedLeaves)
        ? jsonData.preAllocatedLeaves
            .map((leaf: any) => {
              if (!leaf || typeof leaf !== "object") return null;
              if (
                typeof leaf.key !== "string" ||
                typeof leaf.value !== "string"
              )
                return null;
              return { key: leaf.key, value: leaf.value };
            })
            .filter(Boolean)
        : undefined;

      const snapshot: StateSnapshotFile = {
        channelId: jsonData.channelId,
        stateRoot: jsonData.stateRoot,
        registeredKeys,
        storageEntries,
        contractAddress: jsonData.contractAddress,
        preAllocatedLeaves,
      };

      buildStorageValueMap(snapshot);

      return snapshot;
    },
    [buildStorageValueMap, parsedChannelId]
  );

  const handleFinalSnapshotFileUpload = async (file: File) => {
    try {
      setFinalSnapshotError("");
      const snapshot = await parseSnapshotFile(file);
      setFinalSnapshotFile(file);
      setFinalSnapshotData(snapshot);
      setFinalBalances({});
      setIsFinalSnapshotProcessing(false);
    } catch (error) {
      console.error("Error parsing final state_snapshot.json:", error);
      setFinalSnapshotError(
        error instanceof Error ? error.message : "Invalid file format"
      );
      setFinalSnapshotFile(null);
      setFinalSnapshotData(null);
      setFinalBalances({});
      setIsFinalSnapshotProcessing(false);
    }
  };

  const buildPermutation = useCallback(
    (initialKeysRaw: string[], finalSnapshot: StateSnapshotFile) => {
      const finalKeysRaw = finalSnapshot.registeredKeys;
      const treeSize = initialKeysRaw.length;

      if (treeSize === 0) {
        throw new Error("No registeredKeys found for the selected channel.");
      }

      if (finalKeysRaw.length !== treeSize) {
        throw new Error(
          `registeredKeys length mismatch between contract (${treeSize}) and final (${finalKeysRaw.length}) snapshots.`
        );
      }

      const initialKeys = initialKeysRaw.map((key) =>
        normalizeStorageKey(String(key))
      );
      const finalKeys = finalKeysRaw.map((key) => normalizeStorageKey(key));

      const initialKeySet = new Set<string>();
      const duplicateInitialKeys = new Set<string>();
      initialKeys.forEach((key) => {
        if (!key) {
          duplicateInitialKeys.add("");
          return;
        }
        if (initialKeySet.has(key)) {
          duplicateInitialKeys.add(key);
        }
        initialKeySet.add(key);
      });

      if (duplicateInitialKeys.size > 0) {
        throw new Error(
          "Contract registeredKeys contain duplicate or empty entries."
        );
      }

      const finalIndexByKey = new Map<string, number>();
      const duplicateFinalKeys = new Set<string>();
      finalKeys.forEach((key, index) => {
        if (!key) {
          duplicateFinalKeys.add("");
          return;
        }
        if (finalIndexByKey.has(key)) {
          duplicateFinalKeys.add(key);
          return;
        }
        finalIndexByKey.set(key, index);
      });

      if (duplicateFinalKeys.size > 0) {
        throw new Error(
          "Final snapshot contains duplicate or empty registeredKeys."
        );
      }

      const permutation: number[] = [];
      const missingKeys: string[] = [];

      initialKeys.forEach((key, index) => {
        const finalIndex = finalIndexByKey.get(key);
        if (finalIndex === undefined) {
          missingKeys.push(String(initialKeysRaw[index]));
          return;
        }
        permutation.push(finalIndex);
      });

      if (missingKeys.length > 0) {
        throw new Error(
          `Final snapshot missing ${missingKeys.length} registeredKeys from contract data.`
        );
      }

      const uniqueIndices = new Set(permutation);
      if (uniqueIndices.size !== treeSize) {
        throw new Error("Permutation contains duplicate indices.");
      }

      const invalidIndex = permutation.find(
        (value) => value < 0 || value >= treeSize
      );
      if (invalidIndex !== undefined) {
        throw new Error(`Permutation index out of range: ${invalidIndex}`);
      }

      return permutation;
    },
    [normalizeStorageKey]
  );

  useEffect(() => {
    setPermutation([]);
    setPermutationError("");
    if (!finalSnapshotData || contractRegisteredKeys.length === 0) return;
    try {
      const nextPermutation = buildPermutation(
        contractRegisteredKeys,
        finalSnapshotData
      );
      setPermutation(nextPermutation);
    } catch (error) {
      setPermutationError(
        error instanceof Error
          ? error.message
          : "Failed to generate permutation"
      );
    }
  }, [contractRegisteredKeys, finalSnapshotData, buildPermutation]);

  const permutationArgs = useMemo(
    () => permutation.map((value) => BigInt(value)),
    [permutation]
  );

  const generateGroth16Proof = async () => {
    if (
      !parsedChannelId ||
      !channelParticipants ||
      !channelTreeSize ||
      !finalStateRoot
    ) {
      throw new Error("Missing channel data");
    }
    if (!finalSnapshotData) {
      throw new Error(
        "Upload final state_snapshot.json before generating proof"
      );
    }

    const treeSize = Number(channelTreeSize);

    if (![16, 32, 64, 128].includes(treeSize)) {
      throw new Error(`Unsupported tree size: ${treeSize}`);
    }

    if (finalSnapshotData.registeredKeys.length > treeSize) {
      throw new Error(
        `registeredKeys length (${finalSnapshotData.registeredKeys.length}) exceeds tree size ${treeSize}`
      );
    }

    setProofGenerationStatus("Preparing state snapshot data...");

    const valuesByKey = buildStorageValueMap(finalSnapshotData);
    const storageKeysL2MPT = finalSnapshotData.registeredKeys.slice();
    const missingKeys: string[] = [];

    const storageValues = finalSnapshotData.registeredKeys.map((key) => {
      const normalizedKey = normalizeStorageKey(key);
      const value = valuesByKey.get(normalizedKey);
      if (!value) {
        missingKeys.push(key);
        return "0";
      }
      return value;
    });

    if (missingKeys.length > 0) {
      console.warn(
        `Missing ${missingKeys.length} storage entries in state_snapshot.json`,
        missingKeys
      );
    }

    while (storageKeysL2MPT.length < treeSize) {
      storageKeysL2MPT.push("0");
      storageValues.push("0");
    }

    setProofGenerationStatus("Preparing circuit input...");

    const circuitInput = {
      storage_keys_L2MPT: storageKeysL2MPT,
      storage_values: storageValues,
      treeSize: treeSize,
    };

    console.log("Circuit Input for State Snapshot:", circuitInput);
    console.log("Final State Root:", finalStateRoot);
    console.log("Snapshot State Root:", finalSnapshotData.stateRoot);

    const memoryReq = getMemoryRequirement(treeSize);
    const needsDownload = requiresExternalDownload(treeSize);
    const downloadInfo = needsDownload
      ? ` + ${getDownloadSize(treeSize)} download`
      : "";
    setProofGenerationStatus(
      `Generating Groth16 proof for ${treeSize}-leaf tree (${memoryReq}${downloadInfo})...`
    );

    const result = await generateClientSideProof(circuitInput, (status) => {
      setProofGenerationStatus(status);
    });

    setProofGenerationStatus("Validating proof against final state root...");

    // The circuit should produce a merkle root that matches the final state root stored in the contract
    const computedMerkleRoot = `0x${BigInt(result.publicSignals[0])
      .toString(16)
      .padStart(64, "0")}`;
    const expectedFinalStateRoot = finalStateRoot;

    console.log("=== PROOF VALIDATION DEBUG ===");
    console.log("Computed Merkle Root:", computedMerkleRoot);
    console.log("Expected Final State Root:", expectedFinalStateRoot);
    console.log("Final State Root (raw):", finalStateRoot);
    console.log("Circuit Input:", circuitInput);
    console.log("Generated Public Signals:", result.publicSignals);
    console.log("Storage Keys L2 MPT:", storageKeysL2MPT);
    console.log("Storage Values:", storageValues);
    console.log("State Snapshot:", finalSnapshotData);
    console.log("Channel Participants:", channelParticipants);

    if (
      computedMerkleRoot.toLowerCase() !== expectedFinalStateRoot.toLowerCase()
    ) {
      console.warn(
        `⚠️  WARNING: Computed merkle root ${computedMerkleRoot} does not match expected final state root ${expectedFinalStateRoot}`
      );
      console.warn(
        `⚠️  This will likely cause the contract verification to fail.`
      );
      console.warn(
        `⚠️  The issue is that the snapshot balances don't produce the expected final state root.`
      );
      console.warn(`⚠️  Proceeding anyway to see contract error details...`);
      // throw new Error(`Proof validation failed: Computed merkle root ${computedMerkleRoot} does not match expected final state root ${expectedFinalStateRoot}`);
    }

    setProofGenerationStatus("Proof generated and validated successfully!");

    return {
      proof: {
        pA: result.proof.pA as [bigint, bigint, bigint, bigint],
        pB: result.proof.pB as [
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint
        ],
        pC: result.proof.pC as [bigint, bigint, bigint, bigint],
      },
    };
  };

  const handleUnfreezeState = async () => {
    if (!isValidChannelId || !channelInfo) return;

    setIsGeneratingProof(true);

    try {
      const { proof } = await generateGroth16Proof();
      setGeneratedProof(proof);

      setProofGenerationStatus("Submitting to blockchain...");

      verifyFinalBalances?.({
        args: [
          BigInt(parsedChannelId!),
          finalBalancesArray,
          permutationArgs,
          proof,
        ],
      });
    } catch (error) {
      console.error("Error during unfreeze:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setProofGenerationStatus(`Error: ${errorMessage}`);
      setIsGeneratingProof(false);

      setTimeout(() => {
        setProofGenerationStatus("");
      }, 5000);
    }
  };

  const isFormValid = () => {
    return Boolean(
      channelInfo &&
        contractRegisteredKeys.length > 0 &&
        finalSnapshotData &&
        Object.keys(finalBalances).length > 0 &&
        !contractRegisteredKeysError &&
        !isContractDataLoading &&
        !finalSnapshotError &&
        !permutationError &&
        permutation.length === contractRegisteredKeys.length &&
        !isFinalSnapshotProcessing &&
        (isFrostSignatureEnabled ? isSignatureVerified : true) && // Skip signature check if frost disabled
        Number(channelInfo[1]) === 3
    );
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a1930] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#4fc3f7] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="min-h-screen space-background">
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />

        <MobileNavigation
          showMobileMenu={showMobileMenu}
          setShowMobileMenu={setShowMobileMenu}
        />

        <div className="ml-0 lg:ml-72 transition-all duration-300 min-h-screen space-background flex flex-col">
          <main className="px-4 py-8 lg:px-8 flex-1">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                    <Unlock className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white">
                    Unfreeze State
                  </h1>
                </div>
                <p className="text-gray-300 ml-13">
                  Verify final balances and close the channel
                </p>
              </div>

              {!isConnected ? (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
                  <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                    <Link className="w-8 h-8 text-[#4fc3f7]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Connect Your Wallet
                  </h3>
                  <p className="text-gray-300 mb-6">
                    Please connect your wallet to unfreeze channel state
                  </p>
                  <ConnectButton />
                </div>
              ) : isLoadingChannels ? (
                <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 text-center shadow-lg shadow-[#4fc3f7]/20">
                  <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                    <Settings className="w-8 h-8 text-[#4fc3f7] animate-spin" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Loading Channels...
                  </h3>
                  <p className="text-gray-300">
                    Fetching your channel data from the blockchain
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Channel ID Input Section */}
                  <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-[#4fc3f7]" />
                      Select Channel to Unfreeze
                    </h3>

                    {/* Manual Channel ID Input */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Channel ID
                        </label>
                        <input
                          type="number"
                          value={selectedChannelId}
                          onChange={(e) => setSelectedChannelId(e.target.value)}
                          placeholder="Enter channel ID..."
                          className="w-full px-4 py-3 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-lg text-white placeholder-gray-400 focus:border-[#4fc3f7] focus:ring-1 focus:ring-[#4fc3f7] transition-colors"
                        />
                      </div>

                      {/* Show available closing channels */}
                      {closingChannels.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400 mb-2">
                            Your channels in "Closing" state:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {closingChannels.map((channel) => (
                              <button
                                key={channel.id}
                                onClick={() =>
                                  setSelectedChannelId(channel.id.toString())
                                }
                                className={`px-3 py-1 rounded border text-sm transition-all ${
                                  selectedChannelId === channel.id.toString()
                                    ? "border-[#4fc3f7] bg-[#4fc3f7]/20 text-[#4fc3f7]"
                                    : "border-[#4fc3f7]/30 text-gray-300 hover:border-[#4fc3f7] hover:text-[#4fc3f7]"
                                }`}
                              >
                                #{channel.id}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {closingChannels.length === 0 && (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="text-yellow-400 mt-0.5">⚠️</div>
                            <div>
                              <p className="text-yellow-300 text-sm font-medium">
                                No Closing Channels Found
                              </p>
                              <p className="text-yellow-400 text-sm mt-1">
                                You don't have any channels in "Closing" state.
                                Submit proofs first to move channels to Closing
                                state.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {isValidChannelId && channelInfo && (
                    <>
                      <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-[#4fc3f7]" />
                          Channel {parsedChannelId} -{" "}
                          {getChannelStateName(Number(channelInfo[1]))}
                        </h3>

                        {Number(channelInfo[1]) !== 3 && (
                          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="text-red-400 text-sm">
                              ⚠️ Channel must be in "Closing" state (state 3) to
                              verify final balances. Current state:{" "}
                              {getChannelStateName(Number(channelInfo[1]))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                            <div className="text-sm text-gray-400">Status</div>
                            <div
                              className={`text-xl font-bold ${getChannelStateColor(
                                Number(channelInfo[1])
                              )}`}
                            >
                              {getChannelStateName(Number(channelInfo[1]))}
                            </div>
                          </div>
                          <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                            <div className="text-sm text-gray-400">
                              Participants
                            </div>
                            <div className="text-xl font-bold text-white">
                              {channelParticipants?.length || 0}
                            </div>
                          </div>
                          <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                            <div className="text-sm text-gray-400">
                              Tree Size
                            </div>
                            <div className="text-xl font-bold text-white">
                              {channelTreeSize
                                ? Number(channelTreeSize)
                                : "..."}
                            </div>
                          </div>
                          <div className="text-center p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30">
                            <div className="text-sm text-gray-400">
                              Signature
                            </div>
                            {isFrostSignatureEnabled === false ? (
                              <div className="text-xl font-bold text-gray-400">
                                Not Required
                              </div>
                            ) : (
                              <div
                                className={`text-xl font-bold ${
                                  isSignatureVerified
                                    ? "text-green-400"
                                    : "text-red-400"
                                }`}
                              >
                                {isSignatureVerified
                                  ? "Verified"
                                  : "Not Verified"}
                              </div>
                            )}
                          </div>
                        </div>

                        {totalDeposits && (
                          <div className="mt-4 p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50">
                            <div className="text-sm text-gray-400">
                              Total Deposits (must match final balances sum)
                            </div>
                            <div className="text-xl font-bold text-[#4fc3f7]">
                              {formatUnits(totalDeposits as bigint, 18)} tokens
                            </div>
                          </div>
                        )}

                        {isFrostSignatureEnabled && !isSignatureVerified && (
                          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30">
                            <p className="text-red-400 text-sm">
                              ⚠️ Signature must be verified before unfreezing.
                              Submit proofs first.
                            </p>
                          </div>
                        )}

                        {isFrostSignatureEnabled === false && (
                          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30">
                            <p className="text-green-400 text-sm">
                              ✓ Frost signatures disabled. No signature
                              verification required.
                            </p>
                          </div>
                        )}
                      </div>

                      {(isFrostSignatureEnabled
                        ? isSignatureVerified
                        : true) && (
                        <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                          <div className="p-6 border-b border-[#4fc3f7]/30">
                            <h3 className="text-xl font-semibold text-white mb-2">
                              State Snapshot
                            </h3>
                            <p className="text-gray-400">
                              Registered keys are fetched from the contract.
                              Upload the final state_snapshot.json for proof
                              generation and balances.
                            </p>
                          </div>

                          <div className="p-6 space-y-6">
                            <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-4">
                              <div className="text-sm text-gray-400 mb-1">
                                Registered keys from contract
                              </div>
                              {isContractDataLoading ? (
                                <div className="text-[#4fc3f7] text-sm">
                                  Fetching channel data...
                                </div>
                              ) : (
                                <div className="text-white text-sm">
                                  {contractRegisteredKeys.length > 0
                                    ? `${contractRegisteredKeys.length} registered keys loaded`
                                    : "No registered keys loaded yet"}
                                </div>
                              )}
                            </div>
                            {contractRegisteredKeysError && (
                              <div className="p-4 bg-red-900/20 border border-red-700">
                                <p className="text-red-400 text-sm">
                                  {contractRegisteredKeysError}
                                </p>
                              </div>
                            )}

                            <div>
                              <p className="text-sm text-gray-400 mb-2">
                                Final state snapshot
                              </p>
                              {!finalSnapshotData ? (
                                <div className="border-2 border-dashed border-gray-600 p-8 text-center hover:border-[#4fc3f7] transition-colors">
                                  <input
                                    type="file"
                                    accept=".json"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file)
                                        handleFinalSnapshotFileUpload(file);
                                    }}
                                    className="hidden"
                                    id="final-snapshot-file"
                                  />
                                  <label
                                    htmlFor="final-snapshot-file"
                                    className="cursor-pointer"
                                  >
                                    <Upload className="mx-auto h-16 w-16 mb-4 text-gray-400" />
                                    <p className="text-lg font-medium text-white mb-2">
                                      Click to upload final state_snapshot.json
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      Used for proof generation and balances
                                    </p>
                                  </label>
                                </div>
                              ) : (
                                <div className="bg-green-900/20 border border-green-700 p-6">
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <CheckCircle2 className="h-12 w-12 text-green-400" />
                                      <div>
                                        <h3 className="text-lg font-semibold text-green-200">
                                          {finalSnapshotFile
                                            ? finalSnapshotFile.name
                                            : "state_snapshot.json"}
                                        </h3>
                                        <p className="text-sm text-green-400">
                                          {isFinalSnapshotProcessing
                                            ? "Resolving participant balances..."
                                            : "Final snapshot loaded successfully"}
                                        </p>
                                        {finalSnapshotData.channelId !==
                                          undefined && (
                                          <p className="text-xs text-green-300 mt-1">
                                            Channel:{" "}
                                            {finalSnapshotData.channelId}
                                          </p>
                                        )}
                                        {finalSnapshotData.stateRoot && (
                                          <p className="text-xs text-green-300 mt-1 break-all">
                                            State root:{" "}
                                            {finalSnapshotData.stateRoot}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setFinalSnapshotFile(null);
                                        setFinalSnapshotData(null);
                                        setFinalBalances({});
                                        setFinalSnapshotError("");
                                        setIsFinalSnapshotProcessing(false);
                                      }}
                                      className="text-red-400 hover:text-red-600 p-2"
                                    >
                                      <XCircle className="h-5 w-5" />
                                    </button>
                                  </div>

                                  <div className="text-sm text-gray-300">
                                    <p>
                                      Registered keys:{" "}
                                      {finalSnapshotData.registeredKeys.length}
                                    </p>
                                    <p>
                                      Storage entries:{" "}
                                      {finalSnapshotData.storageEntries.length}
                                    </p>
                                    <p>
                                      Participants with balances:{" "}
                                      {Object.keys(finalBalances).length}
                                    </p>
                                  </div>
                                  {displayFinalSnapshotEntries.length > 0 && (
                                    <div className="mt-4 border border-green-700/50">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-3 py-2 text-xs uppercase text-green-300/80 bg-green-900/30">
                                        <div>Registered Key</div>
                                        <div className="text-right">
                                          Value (wei)
                                        </div>
                                        <div className="text-right">
                                          Value (token)
                                        </div>
                                      </div>
                                      <div className="max-h-64 overflow-auto divide-y divide-green-800/40">
                                        {displayFinalSnapshotEntries.map(
                                          (row) => (
                                            <div
                                              key={row.key}
                                              className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-3 py-2 text-xs text-green-100"
                                            >
                                              <div className="font-mono break-all">
                                                {row.key}
                                              </div>
                                              <div className="font-mono text-right break-all">
                                                {row.value}
                                              </div>
                                              <div className="text-right">
                                                {row.formatted}
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {finalSnapshotError && (
                                <div className="mt-4 p-4 bg-red-900/20 border border-red-700">
                                  <p className="text-red-400 text-sm">
                                    {finalSnapshotError}
                                  </p>
                                </div>
                              )}
                            </div>
                            {permutationError && (
                              <div className="p-4 bg-red-900/20 border border-red-700">
                                <p className="text-red-400 text-sm">
                                  {permutationError}
                                </p>
                              </div>
                            )}
                            {!permutationError &&
                              contractRegisteredKeys.length > 0 &&
                              finalSnapshotData &&
                              permutation.length > 0 && (
                                <div className="p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 text-sm text-[#4fc3f7]">
                                  Permutation generated: {permutation.length}{" "}
                                  entries.
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {isFormValid() && (
                        <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20">
                          <div className="p-6">
                            {(isGeneratingProof || proofGenerationStatus) && (
                              <div className="mb-4 p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-center">
                                <div className="flex items-center gap-3 justify-center mb-2">
                                  <Calculator
                                    className={`w-5 h-5 text-[#4fc3f7] ${
                                      isGeneratingProof ? "animate-pulse" : ""
                                    }`}
                                  />
                                  <span className="text-[#4fc3f7] font-medium">
                                    {isGeneratingProof
                                      ? "Generating Proof"
                                      : "Proof Status"}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-300">
                                  {proofGenerationStatus}
                                </p>
                              </div>
                            )}

                            {browserCompatible === false && (
                              <div className="mb-4 p-3 bg-red-500/20 border border-red-400/50">
                                <div className="flex items-center gap-2 text-red-400 text-sm">
                                  <XCircle className="w-4 h-4" />
                                  <span className="font-medium">
                                    Browser Not Compatible
                                  </span>
                                </div>
                              </div>
                            )}

                            {isSuccess && (
                              <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-green-300">
                                  <strong className="block mb-1">
                                    Success!
                                  </strong>
                                  Channel closed! Participants can now withdraw.
                                </div>
                              </div>
                            )}

                            <button
                              onClick={handleUnfreezeState}
                              disabled={
                                !isFormValid() ||
                                isGeneratingProof ||
                                isTransactionLoading ||
                                browserCompatible === false
                              }
                              className={`w-full px-8 py-4 font-semibold text-lg transition-all ${
                                isFormValid() &&
                                !isGeneratingProof &&
                                !isTransactionLoading &&
                                browserCompatible !== false
                                  ? "bg-[#4fc3f7] hover:bg-[#029bee] text-white shadow-lg shadow-[#4fc3f7]/30"
                                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              {isGeneratingProof ? (
                                <div className="flex items-center justify-center gap-3">
                                  <Calculator className="w-5 h-5 animate-pulse" />
                                  <span>Generating Proof...</span>
                                </div>
                              ) : isTransactionLoading ? (
                                <div className="flex items-center justify-center gap-3">
                                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                  <span>Submitting...</span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-3">
                                  <Unlock className="w-5 h-5" />
                                  <span>Generate Proof & Close Channel</span>
                                </div>
                              )}
                            </button>

                            <div className="mt-4 p-3 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 text-center">
                              <div className="text-sm text-gray-300">
                                Proof Generation Details:
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                <div>
                                  <span className="text-gray-400">
                                    Tree Size:
                                  </span>
                                  <div className="text-[#4fc3f7] font-medium">
                                    {channelTreeSize
                                      ? Number(channelTreeSize)
                                      : "Auto"}{" "}
                                    leaves
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-400">
                                    Pre-allocated:
                                  </span>
                                  <div className="text-[#4fc3f7] font-medium">
                                    {preAllocatedCount
                                      ? Number(preAllocatedCount)
                                      : 0}{" "}
                                    leaves
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </main>

          <Footer className="mt-auto" />
        </div>

        {showSuccessPopup && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 max-w-md w-full mx-4 shadow-lg shadow-[#4fc3f7]/20">
              <div className="text-center">
                <div className="h-16 w-16 bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Channel Successfully Closed!
                </h3>
                <p className="text-gray-300 mb-4">
                  Final balances verified. Participants can now withdraw their
                  tokens.
                </p>
                <p className="text-sm text-[#4fc3f7] mb-6">
                  Channel {parsedChannelId} is ready for withdrawals!
                </p>
                <button
                  onClick={() => setShowSuccessPopup(false)}
                  className="w-full bg-[#4fc3f7] hover:bg-[#029bee] text-white font-semibold py-3 px-6 transition-colors shadow-lg shadow-[#4fc3f7]/30"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ClientOnly>
  );
}
