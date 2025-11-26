/**
 * Firebase Helper Functions
 * Utility functions for common Firestore operations
 */

import { db } from "./firebase";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  CollectionReference,
  DocumentReference,
} from "firebase/firestore";
import type {
  Channel,
  StateSnapshot,
  Transaction,
  ZKProof,
  Deposit,
  UserBalance,
  DKGSession,
  Participant,
} from "./firebase-types";

// ============================================================================
// Collection References
// ============================================================================

export const channelsRef = collection(db, "channels") as CollectionReference<Channel>;

// Helper functions to get subcollection references (all under channelId)
export function getTransactionsRef(channelId: string) {
  return collection(db, `channels/${channelId}/transactions`) as CollectionReference<Transaction>;
}

export function getZKProofsRef(channelId: string) {
  return collection(db, `channels/${channelId}/zkProofs`) as CollectionReference<ZKProof>;
}

export function getDepositsRef(channelId: string) {
  return collection(db, `channels/${channelId}/deposits`) as CollectionReference<Deposit>;
}

export function getUserBalancesRef(channelId: string) {
  return collection(db, `channels/${channelId}/userBalances`) as CollectionReference<UserBalance>;
}

export function getAggregatedProofsRef(channelId: string) {
  return collection(db, `channels/${channelId}/aggregatedProofs`);
}

export function getDKGSessionsRef(channelId: string) {
  return collection(db, `channels/${channelId}/dkgSessions`) as CollectionReference<DKGSession>;
}

export function getDKGMessagesRef(channelId: string, sessionId: string) {
  return collection(db, `channels/${channelId}/dkgSessions/${sessionId}/messages`);
}

// ============================================================================
// Channel Operations
// ============================================================================

/**
 * Get channel by ID
 */
export async function getChannel(channelId: string): Promise<Channel | null> {
  const docRef = doc(channelsRef, channelId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

/**
 * Get all active channels
 */
export async function getActiveChannels(): Promise<Channel[]> {
  const q = query(
    channelsRef,
    where("status", "==", "active"),
    orderBy("lastActivityAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get channel participants
 */
export async function getChannelParticipants(channelId: string): Promise<Participant[]> {
  const participantsRef = collection(db, `channels/${channelId}/participants`);
  const snapshot = await getDocs(participantsRef);
  return snapshot.docs.map((doc) => doc.data() as Participant);
}

/**
 * Get channel state snapshots
 */
export async function getChannelSnapshots(
  channelId: string,
  limitCount: number = 10
): Promise<StateSnapshot[]> {
  const snapshotsRef = collection(db, `channels/${channelId}/stateSnapshots`);
  const q = query(snapshotsRef, orderBy("sequenceNumber", "desc"), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as StateSnapshot);
}

/**
 * Get latest state snapshot
 */
export async function getLatestSnapshot(channelId: string): Promise<StateSnapshot | null> {
  const snapshots = await getChannelSnapshots(channelId, 1);
  return snapshots.length > 0 ? snapshots[0] : null;
}

// ============================================================================
// Transaction Operations
// ============================================================================

/**
 * Get transactions for a channel
 */
export async function getChannelTransactions(
  channelId: string,
  status?: string,
  limitCount: number = 100
): Promise<Transaction[]> {
  const transactionsRef = getTransactionsRef(channelId);
  let q = query(transactionsRef);

  if (status) {
    q = query(q, where("executionStatus", "==", status));
  }

  q = query(q, orderBy("sequenceNumber", "asc"), limit(limitCount));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get transaction by ID
 */
export async function getTransaction(channelId: string, txId: string): Promise<Transaction | null> {
  const transactionsRef = getTransactionsRef(channelId);
  const docRef = doc(transactionsRef, txId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

/**
 * Get pending transactions
 */
export async function getPendingTransactions(channelId: string): Promise<Transaction[]> {
  const transactionsRef = getTransactionsRef(channelId);
  const q = query(
    transactionsRef,
    where("executionStatus", "==", "pending"),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

// ============================================================================
// ZK Proof Operations
// ============================================================================

/**
 * Get ZK proof by ID
 */
export async function getZKProof(channelId: string, proofId: string): Promise<ZKProof | null> {
  const zkProofsRef = getZKProofsRef(channelId);
  const docRef = doc(zkProofsRef, proofId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

/**
 * Get unverified proofs for a channel
 */
export async function getUnverifiedProofs(channelId: string): Promise<ZKProof[]> {
  const zkProofsRef = getZKProofsRef(channelId);
  const q = query(
    zkProofsRef,
    where("isVerified", "==", false),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Verify a ZK proof
 */
export async function verifyZKProof(
  channelId: string,
  proofId: string,
  verificationResult: boolean
): Promise<void> {
  const zkProofsRef = getZKProofsRef(channelId);
  const docRef = doc(zkProofsRef, proofId);
  await updateDoc(docRef, {
    isVerified: true,
    verificationResult,
    verifiedAt: serverTimestamp(),
  });
}

// ============================================================================
// Deposit Operations
// ============================================================================

/**
 * Get deposits for a channel
 */
export async function getChannelDeposits(
  channelId: string,
  status?: string
): Promise<Deposit[]> {
  const depositsRef = getDepositsRef(channelId);
  let q = query(depositsRef);

  if (status) {
    q = query(q, where("status", "==", status));
  }

  q = query(q, orderBy("createdAt", "desc"));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get pending deposits
 */
export async function getPendingDeposits(channelId: string): Promise<Deposit[]> {
  return getChannelDeposits(channelId, "pending");
}

/**
 * Update deposit status
 */
export async function updateDepositStatus(
  channelId: string,
  depositId: string,
  status: string,
  snapshotId?: string
): Promise<void> {
  const depositsRef = getDepositsRef(channelId);
  const docRef = doc(depositsRef, depositId);
  const updateData: any = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (status === "confirmed") {
    updateData.confirmedAt = serverTimestamp();
  }

  if (snapshotId) {
    updateData.includedInSnapshot = snapshotId;
  }

  await updateDoc(docRef, updateData);
}

// ============================================================================
// User Balance Operations
// ============================================================================

/**
 * Get user balances for a specific channel
 */
export async function getChannelUserBalances(channelId: string): Promise<UserBalance[]> {
  const userBalancesRef = getUserBalancesRef(channelId);
  const snapshot = await getDocs(userBalancesRef);
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get user balances across all channels (Collection Group Query)
 */
export async function getUserBalancesAllChannels(userAddress: string): Promise<UserBalance[]> {
  const q = query(
    collectionGroup(db, "userBalances"),
    where("userAddressL1", "==", userAddress)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as UserBalance);
}

/**
 * Get user balance for specific channel and token
 */
export async function getUserBalance(
  channelId: string,
  userAddress: string,
  tokenContract: string
): Promise<UserBalance | null> {
  const userBalancesRef = getUserBalancesRef(channelId);
  const balanceId = `${userAddress}_${tokenContract}`;
  const docRef = doc(userBalancesRef, balanceId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

/**
 * Update user balance
 */
export async function updateUserBalance(
  channelId: string,
  userAddress: string,
  tokenContract: string,
  newAmount: string,
  txId: string,
  snapshotId: string
): Promise<void> {
  const userBalancesRef = getUserBalancesRef(channelId);
  const balanceId = `${userAddress}_${tokenContract}`;
  const docRef = doc(userBalancesRef, balanceId);

  const currentDoc = await getDoc(docRef);
  const currentCount = currentDoc.exists() ? currentDoc.data()?.transactionCount || 0 : 0;

  await updateDoc(docRef, {
    amount: newAmount,
    lastTransactionId: txId,
    transactionCount: currentCount + 1,
    lastSnapshotId: snapshotId,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================================
// DKG Session Operations
// ============================================================================

/**
 * Get DKG session by ID
 */
export async function getDKGSession(channelId: string, sessionId: string): Promise<DKGSession | null> {
  const dkgSessionsRef = getDKGSessionsRef(channelId);
  const docRef = doc(dkgSessionsRef, sessionId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

/**
 * Get DKG sessions for a channel
 */
export async function getChannelDKGSessions(channelId: string): Promise<DKGSession[]> {
  const dkgSessionsRef = getDKGSessionsRef(channelId);
  const q = query(dkgSessionsRef, orderBy("startedAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get active DKG sessions for a channel
 */
export async function getActiveDKGSessions(channelId: string): Promise<DKGSession[]> {
  const dkgSessionsRef = getDKGSessionsRef(channelId);
  const q = query(
    dkgSessionsRef,
    where("status", "in", ["initializing", "round1", "round2", "round3"]),
    orderBy("startedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Get all active DKG sessions across all channels (Collection Group Query)
 */
export async function getAllActiveDKGSessions(): Promise<DKGSession[]> {
  const q = query(
    collectionGroup(db, "dkgSessions"),
    where("status", "in", ["initializing", "round1", "round2", "round3"]),
    orderBy("startedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as DKGSession);
}

/**
 * Update DKG session status
 */
export async function updateDKGSessionStatus(
  channelId: string,
  sessionId: string,
  status: string,
  currentRound?: number
): Promise<void> {
  const dkgSessionsRef = getDKGSessionsRef(channelId);
  const docRef = doc(dkgSessionsRef, sessionId);
  const updateData: any = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (currentRound !== undefined) {
    updateData.currentRound = currentRound;
  }

  if (status === "completed") {
    updateData.completedAt = serverTimestamp();
  }

  await updateDoc(docRef, updateData);
}

/**
 * Get DKG messages for a session
 */
export async function getDKGMessages(
  channelId: string,
  sessionId: string,
  round?: number
): Promise<any[]> {
  const messagesRef = getDKGMessagesRef(channelId, sessionId);
  let q = query(messagesRef);

  if (round !== undefined) {
    q = query(q, where("round", "==", round));
  }

  q = query(q, orderBy("sequenceNumber", "asc"));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Create a new channel with participants
 */
export async function createChannelWithParticipants(
  channelData: Partial<Channel>,
  participantAddresses: string[]
): Promise<string> {
  const channelRef = doc(channelsRef);
  const channelId = channelRef.id;

  const channel: Partial<Channel> = {
    ...channelData,
    channelId,
    participantCount: participantAddresses.length,
    participantAddresses,
    status: "pending",
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    lastActivityAt: serverTimestamp() as Timestamp,
  };

  await setDoc(channelRef, channel);

  // Create participants subcollection
  const participantsPromises = participantAddresses.map((address, index) => {
    const participantRef = doc(db, `channels/${channelId}/participants/${address}`);
    return setDoc(participantRef, {
      address,
      participantIndex: index,
      l1Address: address,
      status: "active",
      isLeader: index === 0,
      transactionCount: 0,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await Promise.all(participantsPromises);

  return channelId;
}

/**
 * Delete a channel and all its subcollections
 * WARNING: This is a destructive operation
 */
export async function deleteChannel(channelId: string): Promise<void> {
  // Note: In production, use Firebase Admin SDK or Cloud Functions
  // to recursively delete all subcollections
  // This is a simplified version for client-side (should be done server-side)
  
  const channelRef = doc(channelsRef, channelId);
  
  // TODO: Implement recursive deletion of all subcollections
  // - stateSnapshots
  // - participants
  // - transactions
  // - zkProofs
  // - deposits
  // - userBalances
  // - aggregatedProofs
  // - dkgSessions (and their messages)
  
  await updateDoc(channelRef, {
    status: "closed",
    updatedAt: serverTimestamp(),
  });
  
  console.warn("Full deletion of subcollections should be done via Cloud Functions");
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Firestore Timestamp to Date
 */
export function timestampToDate(timestamp: Timestamp): Date {
  return timestamp.toDate();
}

/**
 * Convert Date to Firestore Timestamp
 */
export function dateToTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/**
 * Get current server timestamp
 */
export function getCurrentTimestamp() {
  return serverTimestamp();
}

