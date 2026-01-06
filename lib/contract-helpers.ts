/**
 * Contract Helper Functions
 * Functions to fetch data from RollupBridgeCore contract
 */

import { readContracts } from "@wagmi/core";
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from "./contracts";

/**
 * Fetch channel data from contract for Initialize Channel
 */
export async function fetchChannelDataFromContract(channelId: string) {
  try {
    // 1. Get channel info (includes initialRoot)
    const [
      channelInfoResult,
      participantsResult,
      allowedTokensResult,
      publicKeyResult,
      treeSizeResult,
    ] = await readContracts({
      contracts: [
        {
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: "getChannelInfo",
          args: [BigInt(channelId)],
        },
        {
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: "getChannelParticipants",
          args: [BigInt(channelId)],
        },
        {
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: "getChannelTargetContract",
          args: [BigInt(channelId)],
        },
        {
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: "getChannelPublicKey",
          args: [BigInt(channelId)],
        },
        {
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: "getChannelTreeSize",
          args: [BigInt(channelId)],
        },
      ],
    });

    const channelInfo = channelInfoResult?.result as readonly [
      `0x${string}`,
      number,
      bigint,
      `0x${string}`
    ];
    const participants = participantsResult?.result as string[];
    const allowedTokens = allowedTokensResult?.result as `0x${string}`;
    const [pkx, pky] = (publicKeyResult?.result as [bigint, bigint]) || [
      0n,
      0n,
    ];
    const treeSize = treeSizeResult?.result as bigint;

    // Get preallocated keys
    const preAllocatedKeysResult = await readContracts({
      contracts: [
        {
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: "getPreAllocatedKeys",
          args: [allowedTokens],
        },
      ],
    });
    const preAllocatedKeys =
      (preAllocatedKeysResult?.[0]?.result as string[]) || [];

    // Get MPT keys for each participant
    const mptKeyResults = await readContracts({
      contracts: (participants || []).map((participant) => ({
        address: ROLLUP_BRIDGE_ADDRESS,
        abi: ROLLUP_BRIDGE_ABI,
        functionName: "getL2MptKey",
        args: [BigInt(channelId), participant as `0x${string}`],
      })),
    });
    const mptKeyList: string[] = [];
    mptKeyResults.forEach((result) => {
      if (result?.status !== "success" || result.result === undefined) return;
      const mptKey = result.result as bigint;
      if (mptKey > 0n) {
        mptKeyList.push(mptKey.toString(16));
      }
    });

    const registeredKeys = [...preAllocatedKeys, ...mptKeyList];

    return {
      // From contract
      initialMerkleRoot: channelInfo[3], // initialRoot from getChannelInfo
      registeredKeys,
      groupPublicKey: {
        x: (pkx as bigint).toString(),
        y: (pky as bigint).toString(),
      },
      merkleTreeDepth: Math.log2(Number(treeSize)),
      participantAddresses: participants as string[],
      
      // Note: These need to be provided separately or derived
      // initialMerkleRootProof: Groth16Proof - from Initialize transaction event
      // l2AddressList: string[] - from client-side L2 address generation
      // currentMerkleRoot: Same as initialMerkleRoot initially
    };
  } catch (error) {
    console.error("Error fetching channel data from contract:", error);
    throw error;
  }
}

/**
 * Fetch Initial Groth16 Proof from Initialize transaction receipt
 */
export async function fetchInitializeProofFromTransaction(txHash: string) {
  // This would parse the transaction receipt to extract the proof
  // The proof is typically emitted in an event like "ChannelInitialized"
  
  // Example structure:
  // event ChannelInitialized(
  //   uint256 indexed channelId,
  //   bytes32 initialRoot,
  //   Groth16Proof proof
  // );
  
  // For now, return a placeholder
  // TODO: Implement event parsing
  return {
    A: { x: "0", y: "0" },
    B: { x: ["0", "0"], y: ["0", "0"] },
    C: { x: "0", y: "0" },
  };
}
