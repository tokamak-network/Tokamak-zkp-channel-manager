import { Address } from 'wagmi';

// Channel States (matching contract enum)
export enum ChannelState {
  None = 0,
  Initialized = 1,
  Open = 2,
  Closing = 3,
  Closed = 4
}

// Channel State Labels
export const ChannelStateLabels = {
  [ChannelState.None]: 'None',
  [ChannelState.Initialized]: 'Initialized',
  [ChannelState.Open]: 'Open',
  [ChannelState.Closing]: 'Closing',
  [ChannelState.Closed]: 'Closed'
} as const;

// Helper function to get channel state label
export function getChannelStateLabel(state: ChannelState): string {
  return ChannelStateLabels[state] || 'Unknown';
}

// User struct from contract
export interface User {
  l1Address: Address;
  l2PublicKey: Address;
}

// Channel Parameters for opening a channel
export interface ChannelParams {
  targetContract: Address;
  participants: Address[];
  l2PublicKeys: Address[];
  preprocessedPart1: bigint[];
  preprocessedPart2: bigint[];
  timeout: bigint;
  pkx: bigint;
  pky: bigint;
}

// Proof Data for submission
export interface ProofData {
  aggregatedProofHash: `0x${string}`;
  finalStateRoot: `0x${string}`;
  proofPart1: bigint[];
  proofPart2: bigint[];
  publicInputs: bigint[];
  smax: bigint;
  initialMPTLeaves: `0x${string}`[];
  finalMPTLeaves: `0x${string}`[];
  participantRoots: `0x${string}`[];
}

// Signature data for threshold signatures
export interface Signature {
  message: `0x${string}`;
  rx: bigint;
  ry: bigint;
  z: bigint;
}

// Channel information from contract
export interface ChannelInfo {
  targetContract: Address;
  state: ChannelState;
  participantCount: bigint;
  initialRoot: `0x${string}`;
  finalRoot: `0x${string}`;
}

// Detailed channel statistics
export interface ChannelStats {
  id: bigint;
  targetContract: Address;
  state: ChannelState;
  participantCount: bigint;
  totalDeposits: bigint;
  leader: Address;
}

// Channel timeout information
export interface ChannelTimeoutInfo {
  openTimestamp: bigint;
  timeout: bigint;
  deadline: bigint;
}

// Channel deposit information
export interface ChannelDeposits {
  totalDeposits: bigint;
  targetContract: Address;
}

// Extended channel data combining multiple contract calls
export interface ExtendedChannelData {
  id: bigint;
  targetContract: Address;
  state: ChannelState;
  stateLabel: string;
  participants: Address[];
  participantCount: bigint;
  totalDeposits: bigint;
  userDeposit: bigint;
  leader: Address;
  isUserLeader: boolean;
  isUserParticipant: boolean;
  openTimestamp: bigint;
  timeout: bigint;
  deadline: bigint;
  remainingTime: bigint;
  isExpired: boolean;
  isReadyToClose: boolean;
  initialRoot: `0x${string}` | null;
  finalRoot: `0x${string}` | null;
}

// Transaction status for UI feedback
export interface TransactionStatus {
  type: 'idle' | 'preparing' | 'pending' | 'success' | 'error';
  message?: string;
  hash?: `0x${string}`;
  error?: Error;
}

// Form data for creating a new channel
export interface CreateChannelFormData {
  targetContract: string;
  participants: string[];
  pkx: string;
  pky: string;
  enableFrostSignatures: boolean;
}

// Form data for deposits
export interface DepositFormData {
  channelId: string;
  amount: string;
  token: 'ETH' | 'ERC20';
  tokenAddress?: string;
}

// Form data for withdrawals
export interface WithdrawalFormData {
  channelId: string;
  claimedBalance: string;
  leafIndex: string;
  merkleProof: string[];
}

// UI State for channel management
export interface ChannelUIState {
  selectedChannel: bigint | null;
  showCreateModal: boolean;
  showDepositModal: boolean;
  showWithdrawModal: boolean;
  showProofModal: boolean;
  filter: 'all' | 'my-channels' | 'participating' | 'expired';
  sortBy: 'newest' | 'oldest' | 'deposits' | 'participants';
}

// Network configuration
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  rollupBridgeAddress: Address;
  verifierAddress?: Address;
  zecFrostAddress?: Address;
}

// Error types specific to RollupBridge operations
export type RollupBridgeError = 
  | 'NotAuthorized'
  | 'ChannelLimitReached'
  | 'InvalidParticipantNumber'
  | 'MismatchedArrays'
  | 'InvalidTimeout'
  | 'DuplicateParticipant'
  | 'InvalidChannelState'
  | 'NotParticipant'
  | 'InvalidAmount'
  | 'TokenMismatch'
  | 'InvalidProof'
  | 'NotLeader'
  | 'SignatureNotVerified'
  | 'AlreadyWithdrawn'
  | 'ChannelNotClosed'
  | 'InvalidMerkleProof';

// Event data types for contract events
export interface ChannelOpenedEvent {
  channelId: bigint;
  targetContract: Address;
}

export interface DepositedEvent {
  channelId: bigint;
  user: Address;
  token: Address;
  amount: bigint;
}

export interface StateInitializedEvent {
  channelId: bigint;
  currentStateRoot: `0x${string}`;
}

export interface ProofAggregatedEvent {
  channelId: bigint;
  proofHash: `0x${string}`;
}

export interface ChannelClosedEvent {
  channelId: bigint;
}

export interface WithdrawnEvent {
  channelId: bigint;
  user: Address;
  token: Address;
  amount: bigint;
}