/**
 * Contract Helper Functions
 * Functions to fetch data from RollupBridgeCore contract
 */

import { readContract } from "@wagmi/core";
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from "./contracts";

/**
 * Fetch channel data from contract for Initialize Channel
 */
export async function fetchChannelDataFromContract(channelId: string) {
  try {
    // 1. Get channel info (includes initialRoot)
    const channelInfo = await readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: "getChannelInfo",
      args: [BigInt(channelId)],
    });

    // 2. Get participants
    const participants = await readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: "getChannelParticipants",
      args: [BigInt(channelId)],
    });

    // 3. Get allowed tokens
    const allowedTokens = await readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: "getChannelAllowedTokens",
      args: [BigInt(channelId)],
    });

    // 4. Get DKG public key
    const { pkx, pky } = await readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: "getChannelPublicKey",
      args: [BigInt(channelId)],
    });

    // 5. Get MPT keys for each participant and token
    const mptKeyList: string[] = [];
    for (const participant of participants as string[]) {
      for (const token of allowedTokens as string[]) {
        const mptKey = await readContract({
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: ROLLUP_BRIDGE_ABI,
          functionName: "getParticipantL2MptKey",
          args: [BigInt(channelId), participant as `0x${string}`, token as `0x${string}`],
        });
        if (mptKey && BigInt(mptKey as string) > 0n) {
          mptKeyList.push((mptKey as bigint).toString());
        }
      }
    }

    // 6. Get channel tree size (merkle tree depth)
    const treeSize = await readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: ROLLUP_BRIDGE_ABI,
      functionName: "getChannelTreeSize",
      args: [BigInt(channelId)],
    });

    return {
      // From contract
      initialMerkleRoot: channelInfo[3], // initialRoot from getChannelInfo
      mptKeyList,
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

