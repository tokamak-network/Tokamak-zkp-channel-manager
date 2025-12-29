/**
 * Database Helper Functions
 * Now using Local JSON Database (LowDB) instead of Firebase
 */

import {
  getData as localGetData,
  setData as localSetData,
  updateData as localUpdateData,
  pushData as localPushData,
  deleteData as localDeleteData,
  runTransaction as localRunTransaction,
} from "./local-db";
import type {
  Channel,
  StateSnapshot,
  UserBalance,
  Participant,
} from "./firebase-types";

// ============================================================================
// Channel Operations
// ============================================================================

/**
 * Get channel by ID
 */
export async function getChannel(channelId: string): Promise<Channel | null> {
  const channel = await localGetData<Channel>(`channels/${channelId}`);
  return channel;
}

/**
 * Get all active channels
 */
export async function getActiveChannels(): Promise<Channel[]> {
  const channelsData = await localGetData<{ [key: string]: Channel }>(
    "channels"
  );

  if (!channelsData) return [];

  const channels: Channel[] = [];
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
export async function getChannelParticipants(
  channelId: string
): Promise<Participant[]> {
  const participantsData = await localGetData<{ [key: string]: Participant }>(
    `channels/${channelId}/participants`
  );

  if (!participantsData) return [];

  const participants: Participant[] = [];
  for (const [key, participant] of Object.entries(participantsData)) {
    participants.push({ ...participant, address: key });
  }

  return participants;
}

// ============================================================================
// State Snapshot Operations
// ============================================================================

/**
 * Get channel state snapshots
 */
export async function getChannelSnapshots(
  channelId: string,
  limitCount: number = 10
): Promise<StateSnapshot[]> {
  const snapshotsData = await localGetData<{ [key: string]: StateSnapshot }>(
    `channels/${channelId}/stateSnapshots`
  );

  if (!snapshotsData) return [];

  const snapshots: StateSnapshot[] = [];
  for (const [key, snapshot] of Object.entries(snapshotsData)) {
    snapshots.push({ ...snapshot, snapshotId: key });
  }

  // Sort by sequenceNumber descending and limit
  return snapshots
    .sort((a, b) => (b.sequenceNumber || 0) - (a.sequenceNumber || 0))
    .slice(0, limitCount);
}

/**
 * Get latest state snapshot
 */
export async function getLatestSnapshot(
  channelId: string
): Promise<StateSnapshot | null> {
  const snapshots = await getChannelSnapshots(channelId, 1);
  return snapshots.length > 0 ? snapshots[0] : null;
}

// ============================================================================
// User Balance Operations
// ============================================================================

/**
 * Get user balances for a channel
 */
export async function getChannelUserBalances(
  channelId: string
): Promise<UserBalance[]> {
  const balancesData = await localGetData<{ [key: string]: UserBalance }>(
    `channels/${channelId}/userBalances`
  );

  if (!balancesData) return [];

  const balances: UserBalance[] = [];
  for (const [key, balance] of Object.entries(balancesData)) {
    balances.push({ ...balance, id: key });
  }

  return balances;
}

// ============================================================================
// Generic Write Operations
// ============================================================================

/**
 * Set data at a path
 */
export async function setData(path: string, data: any): Promise<void> {
  await localSetData(path, {
    ...data,
    _updatedAt: new Date().toISOString(),
  });
}

/**
 * Push new data with auto-generated key
 */
export async function pushData(path: string, data: any): Promise<string> {
  const key = await localPushData(path, {
    ...data,
    _createdAt: new Date().toISOString(),
  });
  return key;
}

/**
 * Update specific fields
 */
export async function updateData(path: string, data: any): Promise<void> {
  await localUpdateData(path, {
    ...data,
    _updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete data at path
 */
export async function deleteData(path: string): Promise<void> {
  await localDeleteData(path);
}

/**
 * Read data from path
 */
export async function getData<T = any>(path: string): Promise<T | null> {
  return await localGetData<T>(path);
}

/**
 * Run a transaction (atomic operation)
 */
export async function runTransaction<T>(
  path: string,
  updateFn: (currentValue: T | null) => T
): Promise<T> {
  return await localRunTransaction<T>(path, updateFn);
}

// ============================================================================
// Proof Operations
// ============================================================================

/**
 * Get current state number based on verified proofs
 * Returns the next state number (max sequenceNumber + 1)
 * Returns 0 if no verified proofs exist
 */
export async function getCurrentStateNumber(channelId: string): Promise<number> {
  try {
    const verifiedProofsData = await getData<any>(
      `channels/${channelId}/verifiedProofs`
    );

    if (!verifiedProofsData) {
      // No verified proofs, starting from state 0
      return 0;
    }

    // Convert to array and find the highest sequenceNumber
    const verifiedProofsArray = Object.entries(verifiedProofsData)
      .map(([key, value]: [string, any]) => ({
        key,
        ...value,
      }))
      .filter((proof: any) => proof.sequenceNumber !== undefined);

    if (verifiedProofsArray.length === 0) {
      // No verified proofs with sequenceNumber, starting from state 0
      return 0;
    }

    // Get the highest sequenceNumber (latest verified proof)
    const maxSequenceNumber = Math.max(
      ...verifiedProofsArray.map((proof: any) => proof.sequenceNumber || 0)
    );

    // Next state will be maxSequenceNumber + 1
    return maxSequenceNumber + 1;
  } catch (err) {
    console.warn("Failed to get current state number:", err);
    // Default to 0 if we can't determine
    return 0;
  }
}
