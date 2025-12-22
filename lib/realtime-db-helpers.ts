/**
 * Firebase Realtime Database Helper Functions
 */

import { realtimeDb } from "./firebase";
import { ref, get, set, push, update, remove, query, orderByChild, limitToLast } from "firebase/database";
import type { Channel, StateSnapshot, UserBalance, Participant } from "./firebase-types";

// ============================================================================
// Channel Operations
// ============================================================================

/**
 * Get channel by ID
 */
export async function getChannel(channelId: string): Promise<Channel | null> {
  const channelRef = ref(realtimeDb, `channels/${channelId}`);
  const snapshot = await get(channelRef);
  return snapshot.exists() ? snapshot.val() : null;
}

/**
 * Get all active channels
 */
export async function getActiveChannels(): Promise<Channel[]> {
  const channelsRef = ref(realtimeDb, 'channels');
  const snapshot = await get(channelsRef);
  
  if (!snapshot.exists()) return [];
  
  const channels: Channel[] = [];
  snapshot.forEach((child) => {
    const channel = child.val();
    if (channel.status === 'active') {
      channels.push({ ...channel, channelId: child.key });
    }
  });
  
  return channels;
}

/**
 * Get channel participants
 */
export async function getChannelParticipants(channelId: string): Promise<Participant[]> {
  const participantsRef = ref(realtimeDb, `channels/${channelId}/participants`);
  const snapshot = await get(participantsRef);
  
  if (!snapshot.exists()) return [];
  
  const participants: Participant[] = [];
  snapshot.forEach((child) => {
    participants.push({ ...child.val(), address: child.key });
  });
  
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
  const snapshotsRef = ref(realtimeDb, `channels/${channelId}/stateSnapshots`);
  const snapshot = await get(snapshotsRef);
  
  if (!snapshot.exists()) return [];
  
  const snapshots: StateSnapshot[] = [];
  snapshot.forEach((child) => {
    snapshots.push({ ...child.val(), snapshotId: child.key });
  });
  
  // Sort by sequenceNumber descending and limit
  return snapshots
    .sort((a, b) => (b.sequenceNumber || 0) - (a.sequenceNumber || 0))
    .slice(0, limitCount);
}

/**
 * Get latest state snapshot
 */
export async function getLatestSnapshot(channelId: string): Promise<StateSnapshot | null> {
  const snapshots = await getChannelSnapshots(channelId, 1);
  return snapshots.length > 0 ? snapshots[0] : null;
}

// ============================================================================
// User Balance Operations
// ============================================================================

/**
 * Get user balances for a channel
 */
export async function getChannelUserBalances(channelId: string): Promise<UserBalance[]> {
  const balancesRef = ref(realtimeDb, `channels/${channelId}/userBalances`);
  const snapshot = await get(balancesRef);
  
  if (!snapshot.exists()) return [];
  
  const balances: UserBalance[] = [];
  snapshot.forEach((child) => {
    balances.push({ ...child.val(), id: child.key });
  });
  
  return balances;
}

// ============================================================================
// Generic Write Operations
// ============================================================================

/**
 * Set data at a path
 */
export async function setData(path: string, data: any): Promise<void> {
  const dataRef = ref(realtimeDb, path);
  await set(dataRef, {
    ...data,
    _updatedAt: new Date().toISOString(),
  });
}

/**
 * Push new data with auto-generated key
 */
export async function pushData(path: string, data: any): Promise<string> {
  const dataRef = ref(realtimeDb, path);
  const newRef = push(dataRef);
  await set(newRef, {
    ...data,
    _createdAt: new Date().toISOString(),
  });
  return newRef.key || '';
}

/**
 * Update specific fields
 */
export async function updateData(path: string, data: any): Promise<void> {
  const dataRef = ref(realtimeDb, path);
  await update(dataRef, {
    ...data,
    _updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete data at path
 */
export async function deleteData(path: string): Promise<void> {
  const dataRef = ref(realtimeDb, path);
  await remove(dataRef);
}

/**
 * Read data from path
 */
export async function getData<T = any>(path: string): Promise<T | null> {
  const dataRef = ref(realtimeDb, path);
  const snapshot = await get(dataRef);
  return snapshot.exists() ? snapshot.val() : null;
}

