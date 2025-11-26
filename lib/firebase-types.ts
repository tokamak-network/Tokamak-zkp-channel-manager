/**
 * Firebase Realtime Database Type Definitions
 * Based on the schema defined in docs/FIREBASE_SCHEMA.md
 */

// For Realtime Database, we use ISO string timestamps instead of Firestore Timestamp
type Timestamp = string; // ISO 8601 format: "2025-11-26T15:00:00.000Z"

// ============================================================================
// Common Types
// ============================================================================

export interface Point {
  x: string; // bigint as string
  y: string; // bigint as string
}

export interface Groth16Proof {
  A: Point;
  B: {
    x: [string, string];
    y: [string, string];
  };
  C: Point;
}

export interface ContractFunction {
  contractAddressL1: string;
  functionSelector: string; // 4 bytes as hex string
}

export interface UserBalanceSlot {
  contractAddressL1: string;
  slot: number;
}

export interface ECDSASignature {
  v: string;
  r: string;
  s: string;
}

export interface StorageEntry {
  key: string;
  value: string;
}

// ============================================================================
// Channel Types
// ============================================================================

export type ChannelStatus = "pending" | "active" | "closed" | "disputed";

export interface Channel {
  // Identifiers
  channelId: string;
  contractAddress: string;
  chainId: number; // Chain ID (e.g., 11155111 for Sepolia, 1 for Mainnet)

  // Channel Configuration
  participantAddresses: string[]; // L1 addresses
  participantCount: number;
  threshold: number; // t (minimum signers)
  merkleTreeDepth: number;

  // DKG Information
  dkgSessionId: string;
  dkgVerifyShares: Point[];
  groupPublicKey: Point;

  // State Information
  currentMerkleRoot: string;
  initialMerkleRoot: string;
  initialMerkleRootProof: Groth16Proof;

  // Channel Status
  status: ChannelStatus;
  leader: string; // Address of channel leader

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;

  // L1 Bridge Data
  mptKeyList: string[];
  l2AddressList: string[];
  callableFunctions: ContractFunction[];

  // Preprocessing Data
  preprocessedInputs: {
    callableFunction: ContractFunction;
    partialPublicInput: string[];
    permutationCommitments: [Point, Point];
  }[];
}

// ============================================================================
// State Snapshot Types
// ============================================================================

export interface StateSnapshot {
  // Identifiers
  snapshotId: string;
  channelId: string;
  sequenceNumber: number;

  // Merkle Tree State
  merkleRoot: string;
  previousMerkleRoot: string;
  merkleTreeDepth: number;

  // Transaction References
  transactionIds: string[];
  zkProofIds: string[];

  // State Data
  userBalances: {
    merkleTreeLeafIndex: number;
    userAddressL1: string;
    userPubKeyL2: Point;
    userBalanceSlot: UserBalanceSlot;
    amount: string;
    storageKeyL2MPT: string;
  }[];

  // Block Information
  l1BlockNumber?: number;
  l1BlockHash?: string;
  l2BlockNumber: number;

  // Validation Status
  isVerified: boolean;
  verifiedBy: string[];

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// Participant Types
// ============================================================================

export type ParticipantStatus = "active" | "inactive" | "slashed";

export interface Participant {
  // Identifiers
  address: string;
  participantIndex: number;

  // Keys
  l1Address: string;
  l2PublicKey: Point;

  // DKG Data
  dkgCommitments: Point[]; // length = threshold
  dkgProofOfKnowledge: {
    R: Point;
    mu: string;
  };
  dkgVerifyShare: Point;

  // Status
  status: ParticipantStatus;
  isLeader: boolean;

  // Activity
  lastSeen: Timestamp;
  transactionCount: number;

  // Metadata
  joinedAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Transaction Types
// ============================================================================

export type TransactionType = "deposit" | "transfer" | "contract_call" | "withdrawal";
export type TransactionStatus = "pending" | "success" | "reverted" | "failed";

export interface Transaction {
  // Identifiers
  txId: string;
  channelId: string;
  txHash?: string;

  // Transaction Type
  type: TransactionType;

  // Transaction Data
  txNonce: string;
  sender: string;
  senderPubKey: Point;
  toContractAddress: string;
  callData: string; // hex string

  // Function Call Info
  functionSelector?: string;

  // State Transition
  prevMerkleRoot: string;
  nextMerkleRoot: string;

  // ZKP Reference
  zkProofId: string;

  // Execution Result
  executionStatus: TransactionStatus;
  gasUsed?: string;
  errorMessage?: string;

  // Storage Changes
  contractStorageOut: StorageEntry[];
  contractStorageIn: StorageEntry[];

  // Metadata
  createdAt: Timestamp;
  executedAt?: Timestamp;
  sequenceNumber: number;

  // Signatures
  signature?: ECDSASignature;
}

// ============================================================================
// ZK Proof Types
// ============================================================================

export type ProofType = "groth16" | "tokamak_zkp" | "merkle_tree_root" | "aggregated";

export interface ZKProofInstance {
  prevMTroot: string;
  nextMTroot: string;
  senderPubKey: Point;
  contractAddress: string;
  functionSelector: string;
  txBatchHash: string;
}

export interface ZKProof {
  // Identifiers
  proofId: string;
  channelId: string;
  transactionId: string;
  index: number;

  // Proof Type
  type: ProofType;

  // Proof Data
  proof: Groth16Proof | string; // Groth16 or raw bytes as hex

  // Public Instance
  instance: ZKProofInstance;

  // Verification Status
  isVerified: boolean;
  verifiedAt?: Timestamp;
  verificationResult?: boolean;

  // Preprocessing Reference
  preprocessData?: {
    callableFunction: ContractFunction;
    partialPublicInput: string[];
  };

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  proofSize: number;
}

// ============================================================================
// DKG Session Types
// ============================================================================

export type DKGRound = "initializing" | "round1" | "round2" | "round3" | "completed" | "failed";

export interface DKGCommitment {
  commitments: Point[]; // length = t
  proofOfKnowledge: {
    R: Point;
    mu: string;
  };
}

export interface DKGSession {
  // Identifiers
  sessionId: string;
  // Note: channelId is implicit from the document path (channels/{channelId}/dkgSessions/{sessionId})

  // Configuration
  n: number;
  t: number;

  // Participants
  participantAddresses: string[];
  participantIndices: { [address: string]: number };

  // Round Status
  currentRound: number;
  status: DKGRound;

  // Round 1 Data
  round1Commitments: {
    [participantAddress: string]: DKGCommitment;
  };

  // Round 2 Data
  round2SecretShares: {
    [senderAddress: string]: {
      [receiverAddress: string]: string; // Encrypted share
    };
  };

  // Round 3 Data
  round3Complaints: {
    [complainantAddress: string]: {
      accusedAddress: string;
      reason: string;
    }[];
  };

  // Final Results
  verifyShares: {
    [participantAddress: string]: Point;
  };
  groupPublicKey?: Point;

  // Timing
  startedAt: Timestamp;
  completedAt?: Timestamp;
  timeout: number;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// DKG Message Types
// ============================================================================

export type DKGMessageType = "commitment" | "secret_share" | "complaint" | "response";

export interface DKGMessage {
  // Identifiers
  messageId: string;
  sessionId: string;

  // Message Info
  round: number;
  messageType: DKGMessageType;

  // Sender/Receiver
  from: string;
  to?: string;

  // Message Payload
  payload: any;

  // Encryption
  encrypted: boolean;
  encryptionPublicKey?: string;

  // Status
  processed: boolean;
  processedAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  sequenceNumber: number;
}

// ============================================================================
// Deposit Types
// ============================================================================

export type DepositStatus = "pending" | "confirmed" | "included" | "failed";

export interface Deposit {
  // Identifiers
  depositId: string;
  channelId: string;
  l1TxHash: string;

  // Deposit Info
  userAddressL1: string;
  userPubKeyL2: Point;
  toContractAddress: string;

  // Token Information
  tokenContract: string;
  tokenSymbol: string;
  amount: string;

  // Storage Slot Info
  balanceSlot: UserBalanceSlot;
  storageKeyL2MPT: string;

  // Status
  status: DepositStatus;
  l1BlockNumber: number;
  l1Confirmations: number;

  // Signature
  signature: ECDSASignature;

  // Metadata
  createdAt: Timestamp;
  confirmedAt?: Timestamp;
  includedInSnapshot?: string;
}

// ============================================================================
// User Balance Types
// ============================================================================

export interface UserBalance {
  // Identifiers
  id: string; // Composite: {userAddress}_{tokenContract} (channelId is implicit from path)
  userAddressL1: string;
  userPubKeyL2: Point;

  // Balance Info
  tokenContract: string;
  tokenSymbol: string;
  amount: string;

  // Merkle Tree Position
  merkleTreeLeafIndex: number;
  merklePatriciaTrieKey: string;

  // Balance Slot
  userBalanceSlot: UserBalanceSlot;

  // Transaction History
  lastTransactionId?: string;
  transactionCount: number;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSnapshotId: string;
}

// ============================================================================
// Aggregated Proof Types
// ============================================================================

export interface FrostSignature {
  R: Point;
  z: string;
  // Additional fields TBD
}

export interface AggregatedProof {
  // Identifiers
  aggregatedProofId: string;
  channelId: string;

  // Aggregation Info
  zkProofIds: string[];
  transactionIds: string[];
  fromSequenceNumber: number;
  toSequenceNumber: number;

  // Aggregated ZKP
  aggregatedZKP: {
    callableFunction: ContractFunction;
    proof: any; // TBD
  }[];

  // FROST Signature
  frostSignature?: FrostSignature;

  // State Range
  initialMerkleRoot: string;
  finalMerkleRoot: string;

  // Participants
  signers: string[];
  signatureCount: number;

  // Verification
  isVerified: boolean;
  verifiedAt?: Timestamp;

  // L1 Submission
  submittedToL1: boolean;
  l1TxHash?: string;
  l1BlockNumber?: number;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// Helper Types for API Requests
// ============================================================================

export interface CreateChannelRequest {
  contractAddress: string;
  chainId: number; // Chain ID (e.g., 11155111 for Sepolia, 1 for Mainnet)
  participantAddresses: string[];
  threshold: number;
  merkleTreeDepth: number;
}

export interface CreateTransactionRequest {
  channelId: string;
  type: TransactionType;
  txNonce: string;
  sender: string;
  senderPubKey: Point;
  toContractAddress: string;
  callData: string;
  functionSelector?: string;
  signature?: ECDSASignature;
}

export interface CreateDepositRequest {
  channelId: string;
  userAddressL1: string;
  userPubKeyL2: Point;
  tokenContract: string;
  tokenSymbol: string;
  amount: string;
  balanceSlot: UserBalanceSlot;
  storageKeyL2MPT: string;
  l1TxHash: string;
  signature: ECDSASignature;
}

export interface CreateZKProofRequest {
  channelId: string;
  transactionId: string;
  type: ProofType;
  proof: Groth16Proof | string;
  instance: ZKProofInstance;
  preprocessData?: {
    callableFunction: ContractFunction;
    partialPublicInput: string[];
  };
}

// ============================================================================
// Query Response Types
// ============================================================================

export interface ChannelWithParticipants extends Channel {
  participants: Participant[];
}

export interface TransactionWithProof extends Transaction {
  zkProof?: ZKProof;
}

export interface SnapshotWithTransactions extends StateSnapshot {
  transactions: Transaction[];
  zkProofs: ZKProof[];
}

// ============================================================================
// Timestamp Helper Types (for Realtime Database)
// ============================================================================

/**
 * Helper function to create ISO timestamp string
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Helper function to parse ISO timestamp string to Date
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}
