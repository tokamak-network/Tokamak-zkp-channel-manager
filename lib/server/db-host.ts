import { StateSnapshot } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS";
import { getData } from "../db-client";
import { parseProofFromBase64Zip } from "../proofAnalyzer";

export const getInitializationTxHash = async (
  channelId: string,
): Promise<string | null> => {
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

export const getLatestStateSnapshot = async (
  channelId: string
): Promise<StateSnapshot | null> => {
  try {
    // Get verified proofs data from lowDB
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

    // Get latest proof data
    const latestProof = verifiedProofsData[latestKey];
    const zipFilePath = latestProof?.zipFile?.filePath;

    if (!zipFilePath) {
      console.warn("No file path found for latest proof");
      return null;
    }

    // Use the get-proof-zip API to get the ZIP content, then extract state_snapshot.json
    const response = await fetch(`/api/get-proof-zip?channelId=${channelId}&proofId=${latestKey}&status=verifiedProofs&format=json`);
    
    if (!response.ok) {
      console.warn("Failed to fetch proof ZIP");
      return null;
    }

    const zipData = await response.json();
    if (!zipData.success || !zipData.content) {
      console.warn("No ZIP content received");
      return null;
    }

    // Parse the base64 ZIP content to extract state_snapshot.json
    const { snapshot } = await parseProofFromBase64Zip(zipData.content);
    return snapshot || null;
  } catch (err) {
    console.warn("Failed to get latest state snapshot:", err);
    return null;
  }
};