/**
 * Local JSON Database using LowDB
 * Data is stored in a JSON file for easy inspection and debugging
 */

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import fs from "fs";

// Database schema matching Firebase structure
export interface DatabaseSchema {
  channels: {
    [channelId: string]: ChannelData;
  };
  _metadata: {
    createdAt: string;
    lastUpdatedAt: string;
    version: string;
  };
}

export interface ChannelData {
  // Channel metadata
  channelId: string;
  leader: string;
  participants: string[];
  targetAddress: string;
  status: string;
  createdAt: string;
  updatedAt: string;

  // Initialization data
  initializationTxHash?: string;

  // State snapshots
  stateSnapshots?: {
    [snapshotId: string]: StateSnapshotData;
  };

  // User balances
  userBalances?: {
    [balanceId: string]: UserBalanceData;
  };

  // Proofs
  submittedProofs?: {
    [proofKey: string]: ProofData;
  };
  verifiedProofs?: {
    [proofKey: string]: ProofData;
  };
  rejectedProofs?: {
    [proofKey: string]: ProofData;
  };

  // Sequence counters for proof numbering
  sequenceCounters?: {
    [proofNumber: string]: number;
  };
}

export interface StateSnapshotData {
  snapshotId: string;
  channelId: string;
  sequenceNumber: number;
  merkleRoot: string;
  previousMerkleRoot?: string;
  userBalances?: any[];
  createdAt: string;
  createdBy: string;
  isVerified?: boolean;
}

export interface UserBalanceData {
  id: string;
  userAddressL1: string;
  tokenContract: string;
  tokenSymbol: string;
  amount: string;
  merkleTreeLeafIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProofData {
  key?: string;
  submitter: string;
  submittedAt: string;
  status: "pending" | "verified" | "rejected";
  sequenceNumber?: string;
  proofNumber?: number;
  subNumber?: number;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  zipFile?: {
    name: string;
    size: number;
    content: string; // base64 encoded
    uploadedAt: string;
  };
  _createdAt?: string;
  _updatedAt?: string;
}

// Database file path - stored in project data directory
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "local-db.json");

// Default database structure
const defaultData: DatabaseSchema = {
  channels: {},
  _metadata: {
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    version: "1.0.0",
  },
};

// Singleton database instance
let db: Low<DatabaseSchema> | null = null;

/**
 * Initialize and get the database instance
 */
export async function getDatabase(): Promise<Low<DatabaseSchema>> {
  if (db) {
    return db;
  }

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Created data directory: ${DATA_DIR}`);
  }

  // Initialize LowDB with JSON file adapter
  const adapter = new JSONFile<DatabaseSchema>(DB_FILE);
  db = new Low<DatabaseSchema>(adapter, defaultData);

  // Read existing data or initialize with defaults
  await db.read();

  // If database is empty, initialize with defaults
  if (!db.data) {
    db.data = defaultData;
    await db.write();
    console.log(`🗃️ Initialized new database at: ${DB_FILE}`);
  } else {
    console.log(`📂 Loaded existing database from: ${DB_FILE}`);
  }

  return db;
}

/**
 * Save changes to the database
 */
export async function saveDatabase(): Promise<void> {
  if (!db) {
    throw new Error("Database not initialized");
  }

  if (db.data) {
    db.data._metadata.lastUpdatedAt = new Date().toISOString();
  }

  await db.write();
}

/**
 * Get data at a specific path (Firebase-like path syntax)
 * Example: "channels/1/submittedProofs"
 */
export async function getData<T = any>(path: string): Promise<T | null> {
  const database = await getDatabase();

  // Always read from disk to get the latest data
  // This ensures we don't use stale cached data when the file has been updated
  // by another process or request
  await database.read();

  if (!database.data) {
    return null;
  }

  const parts = path.split("/").filter((p) => p);
  let current: any = database.data;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return null;
    }
    current = current[part];
  }

  return current ?? null;
}

/**
 * Set data at a specific path (Firebase-like path syntax)
 * Creates intermediate objects if they don't exist
 */
export async function setData(path: string, data: any): Promise<void> {
  const database = await getDatabase();

  if (!database.data) {
    database.data = defaultData;
  }

  const parts = path.split("/").filter((p) => p);
  let current: any = database.data;

  // Navigate to parent
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  // Set the value
  const lastPart = parts[parts.length - 1];
  current[lastPart] = {
    ...data,
    _updatedAt: new Date().toISOString(),
  };

  await saveDatabase();
}

/**
 * Update specific fields at a path (merge with existing data)
 */
export async function updateData(path: string, data: any): Promise<void> {
  const database = await getDatabase();

  if (!database.data) {
    database.data = defaultData;
  }

  const parts = path.split("/").filter((p) => p);
  let current: any = database.data;

  // Navigate to parent
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  // Merge the value
  const lastPart = parts[parts.length - 1];
  current[lastPart] = {
    ...(current[lastPart] || {}),
    ...data,
    _updatedAt: new Date().toISOString(),
  };

  await saveDatabase();
}

/**
 * Push new data with auto-generated key (Firebase-like push)
 */
export async function pushData(path: string, data: any): Promise<string> {
  const database = await getDatabase();

  if (!database.data) {
    database.data = defaultData;
  }

  const parts = path.split("/").filter((p) => p);
  let current: any = database.data;

  // Navigate to the collection
  for (const part of parts) {
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  // Generate a unique key (similar to Firebase push keys)
  const key = generatePushKey();

  current[key] = {
    ...data,
    _createdAt: new Date().toISOString(),
  };

  await saveDatabase();

  return key;
}

/**
 * Delete data at a specific path
 */
export async function deleteData(path: string): Promise<void> {
  const database = await getDatabase();

  if (!database.data) {
    return;
  }

  const parts = path.split("/").filter((p) => p);
  let current: any = database.data;

  // Navigate to parent
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      return; // Path doesn't exist, nothing to delete
    }
    current = current[part];
  }

  // Delete the value
  const lastPart = parts[parts.length - 1];
  delete current[lastPart];

  await saveDatabase();
}

/**
 * Run a transaction (atomic read-modify-write)
 * Similar to Firebase runTransaction
 */
export async function runTransaction<T>(
  path: string,
  updateFn: (currentValue: T | null) => T
): Promise<T> {
  const database = await getDatabase();

  // Get current value
  const currentValue = await getData<T>(path);

  // Apply update function
  const newValue = updateFn(currentValue);

  // Set the new value
  await setData(path, newValue);

  return newValue;
}

/**
 * Generate a Firebase-like push key
 * Based on timestamp + random characters
 */
function generatePushKey(): string {
  const PUSH_CHARS =
    "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
  const timestamp = Date.now();
  let key = "";

  // First 8 chars from timestamp
  let ts = timestamp;
  for (let i = 0; i < 8; i++) {
    key = PUSH_CHARS.charAt(ts % 64) + key;
    ts = Math.floor(ts / 64);
  }

  // Last 12 chars are random
  for (let i = 0; i < 12; i++) {
    key += PUSH_CHARS.charAt(Math.floor(Math.random() * 64));
  }

  return key;
}

/**
 * Get database file path (for reference/debugging)
 */
export function getDatabasePath(): string {
  return DB_FILE;
}

/**
 * Check if database file exists
 */
export function databaseExists(): boolean {
  return fs.existsSync(DB_FILE);
}

/**
 * Reset database to default state (for testing)
 */
export async function resetDatabase(): Promise<void> {
  const database = await getDatabase();
  database.data = {
    ...defaultData,
    _metadata: {
      ...defaultData._metadata,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
  await saveDatabase();
  console.log("🔄 Database reset to default state");
}

