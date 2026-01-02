/**
 * Client-side Database Helper Functions
 * Uses the /api/db endpoint to interact with the local database
 * This can be used in both client and server components
 */

const API_BASE = "/api/db";

/**
 * Get data from a path
 */
export async function getData<T = any>(path: string): Promise<T | null> {
  try {
    const url = `${API_BASE}?path=${encodeURIComponent(path)}`;
    console.log("db-client getData: Fetching", url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("db-client getData: Response not ok", response.status, response.statusText);
      throw new Error(`Failed to get data: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log("db-client getData: Result for path", path, "=>", result.data ? "has data" : "null");
    return result.data ?? null;
  } catch (error) {
    console.error("getData error:", error);
    return null;
  }
}

/**
 * Set data at a path (replaces existing data)
 */
export async function setData(path: string, data: any): Promise<void> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, data, operation: "set" }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to set data: ${response.statusText}`);
  }
}

/**
 * Update data at a path (merges with existing data)
 */
export async function updateData(path: string, data: any): Promise<void> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, data, operation: "update" }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update data: ${response.statusText}`);
  }
}

/**
 * Push data with auto-generated key
 */
export async function pushData(path: string, data: any): Promise<string> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, data, operation: "push" }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to push data: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.key || "";
}

/**
 * Delete data at a path
 */
export async function deleteData(path: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}?path=${encodeURIComponent(path)}`,
    { method: "DELETE" }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to delete data: ${response.statusText}`);
  }
}

// ============================================================================
// Convenience Functions (matching realtime-db-helpers interface)
// ============================================================================

/**
 * Get channel by ID
 */
export async function getChannel(channelId: string): Promise<any | null> {
  return await getData(`channels/${channelId}`);
}

/**
 * Get all active channels
 */
export async function getActiveChannels(): Promise<any[]> {
  const channelsData = await getData<{ [key: string]: any }>("channels");
  
  if (!channelsData) return [];
  
  const channels: any[] = [];
  for (const [key, channel] of Object.entries(channelsData)) {
    if (key !== "_metadata" && channel.status === "active") {
      channels.push({ ...channel, channelId: key });
    }
  }
  
  return channels;
}

/**
 * Get channel participants
 */
export async function getChannelParticipants(channelId: string): Promise<any[]> {
  const participantsData = await getData<{ [key: string]: any }>(
    `channels/${channelId}/participants`
  );
  
  if (!participantsData) return [];
  
  const participants: any[] = [];
  for (const [key, participant] of Object.entries(participantsData)) {
    participants.push({ ...participant, address: key });
  }
  
  return participants;
}

/**
 * Get channel user balances
 */
export async function getChannelUserBalances(channelId: string): Promise<any[]> {
  const balancesData = await getData<{ [key: string]: any }>(
    `channels/${channelId}/userBalances`
  );
  
  if (!balancesData) return [];
  
  const balances: any[] = [];
  for (const [key, balance] of Object.entries(balancesData)) {
    balances.push({ ...balance, id: key });
  }
  
  return balances;
}

/**
 * Get latest snapshot for a channel
 */
export async function getLatestSnapshot(channelId: string): Promise<any | null> {
  const snapshotsData = await getData<{ [key: string]: any }>(
    `channels/${channelId}/stateSnapshots`
  );
  
  if (!snapshotsData) return null;
  
  const snapshots = Object.entries(snapshotsData)
    .map(([key, snapshot]) => ({ ...snapshot, snapshotId: key }))
    .sort((a, b) => (b.sequenceNumber || 0) - (a.sequenceNumber || 0));
  
  return snapshots[0] || null;
}

/**
 * Get current state number based on verified proofs
 */
export async function getCurrentStateNumber(channelId: string): Promise<number> {
  try {
    console.log("getCurrentStateNumber: Fetching for channelId:", channelId);
    
    const verifiedProofsData = await getData<any>(
      `channels/${channelId}/verifiedProofs`
    );
    
    console.log("getCurrentStateNumber: verifiedProofsData:", verifiedProofsData);
    
    if (!verifiedProofsData) {
      console.log("getCurrentStateNumber: No verified proofs, returning 0");
      return 0;
    }
    
    const verifiedProofsArray = Object.entries(verifiedProofsData)
      .map(([key, value]: [string, any]) => ({ key, ...value }))
      .filter((proof: any) => proof.sequenceNumber !== undefined);
    
    console.log("getCurrentStateNumber: verifiedProofsArray:", verifiedProofsArray);
    
    if (verifiedProofsArray.length === 0) {
      console.log("getCurrentStateNumber: No proofs with sequenceNumber, returning 0");
      return 0;
    }
    
    const maxSequenceNumber = Math.max(
      ...verifiedProofsArray.map((proof: any) => proof.sequenceNumber || 0)
    );
    
    console.log("getCurrentStateNumber: maxSequenceNumber:", maxSequenceNumber, "returning:", maxSequenceNumber + 1);
    return maxSequenceNumber + 1;
  } catch (err) {
    console.warn("Failed to get current state number:", err);
    return 0;
  }
}

// ============================================================================
// ZIP File Operations
// ============================================================================

/**
 * Get ZIP file content as base64
 * This handles both new format (file on disk) and legacy format (base64 in DB)
 */
export async function getProofZipContent(
  channelId: string,
  proofId: string,
  status: "submittedProofs" | "verifiedProofs" | "rejectedProofs" = "submittedProofs"
): Promise<{ content: string; fileName: string; size: number } | null> {
  try {
    const response = await fetch(
      `/api/get-proof-zip?channelId=${encodeURIComponent(channelId)}&proofId=${encodeURIComponent(proofId)}&status=${status}&format=base64`
    );
    
    if (!response.ok) {
      console.error("Failed to get ZIP file:", response.statusText);
      return null;
    }
    
    const result = await response.json();
    
    if (!result.success) {
      console.error("Failed to get ZIP file:", result.error);
      return null;
    }
    
    return {
      content: result.content,
      fileName: result.fileName,
      size: result.size,
    };
  } catch (error) {
    console.error("getProofZipContent error:", error);
    return null;
  }
}

/**
 * Download ZIP file directly
 */
export function getProofZipDownloadUrl(
  channelId: string,
  proofId: string,
  status: "submittedProofs" | "verifiedProofs" | "rejectedProofs" = "submittedProofs"
): string {
  return `/api/get-proof-zip?channelId=${encodeURIComponent(channelId)}&proofId=${encodeURIComponent(proofId)}&status=${status}&format=binary`;
}

