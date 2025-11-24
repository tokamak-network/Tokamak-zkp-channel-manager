import { Address } from 'wagmi';

// Modular Contract addresses - Updated for new architecture
export const ROLLUP_BRIDGE_CORE_ADDRESS: Address = '0x0c6f8a867e892307e9aaa426432fff6089fb39b2' as Address;
export const ROLLUP_BRIDGE_DEPOSIT_MANAGER_ADDRESS: Address = '0xf2369733a84f8484ed5ac149c2a097de2e4be862' as Address;
export const ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS: Address = '0xcb606c745047f92601f18ae80698d86618be8ab5' as Address;
export const ROLLUP_BRIDGE_WITHDRAW_MANAGER_ADDRESS: Address = '0xf50c422d24e81d1531585c0753f29435b2746c18' as Address;
export const ROLLUP_BRIDGE_ADMIN_MANAGER_ADDRESS: Address = '0x863b2fb8dbffed99c8aa1fb044ce1b79070c2128' as Address;

// Legacy address for backwards compatibility
export const ROLLUP_BRIDGE_ADDRESS: Address = ROLLUP_BRIDGE_CORE_ADDRESS;
export const VERIFIER_ADDRESS: Address = '0x708fbfE3acC1F65948304015f1789a05383a674b' as Address; 
export const ZECFROST_ADDRESS: Address = '0x0829fa48016a19efd87b3d24efb8e07ec5cc2482' as Address; 

// ETH token address constant from contract
export const ETH_TOKEN_ADDRESS: Address = '0x0000000000000000000000000000000000000001';

// RollupBridge Core ABI - Main view functions and state management
export const ROLLUP_BRIDGE_CORE_ABI = [
  // Channel Management - Core Functions
  {
    inputs: [
      {
        components: [
          { name: 'allowedTokens', type: 'address[]' },
          { name: 'participants', type: 'address[]' },
          { name: 'timeout', type: 'uint256' },
          { name: 'pkx', type: 'uint256' },
          { name: 'pky', type: 'uint256' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'openChannel',
    outputs: [{ name: 'channelId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  // View Functions
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelState',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }, { name: 'participant', type: 'address' }],
    name: 'isChannelParticipant',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }, { name: 'token', type: 'address' }],
    name: 'isTokenAllowedInChannel',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelLeader',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelParticipants',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelAllowedTokens',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelTreeSize',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }, { name: 'participant', type: 'address' }, { name: 'token', type: 'address' }],
    name: 'getParticipantTokenDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }, { name: 'participant', type: 'address' }, { name: 'token', type: 'address' }],
    name: 'getL2MptKey',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }, { name: 'token', type: 'address' }],
    name: 'getChannelTotalDeposits',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelPublicKey',
    outputs: [{ name: 'pkx', type: 'uint256' }, { name: 'pky', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelTimeout',
    outputs: [{ name: 'openTimestamp', type: 'uint256' }, { name: 'timeout', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getTotalChannels',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: false, name: 'allowedTokens', type: 'address[]' }
    ],
    name: 'ChannelOpened',
    type: 'event'
  }
] as const;

// Deposit Manager ABI
export const ROLLUP_BRIDGE_DEPOSIT_MANAGER_ABI = [
  {
    inputs: [{ name: '_channelId', type: 'uint256' }, { name: '_mptKey', type: 'bytes32' }],
    name: 'depositETH',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: '_channelId', type: 'uint256' },
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_mptKey', type: 'bytes32' }
    ],
    name: 'depositToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' }
    ],
    name: 'Deposited',
    type: 'event'
  }
] as const;

// Proof Manager ABI
export const ROLLUP_BRIDGE_PROOF_MANAGER_ABI = [
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      {
        name: 'proof',
        type: 'tuple',
        components: [
          { name: 'pA', type: 'uint256[4]' },
          { name: 'pB', type: 'uint256[8]' },
          { name: 'pC', type: 'uint256[4]' },
          { name: 'merkleRoot', type: 'bytes32' }
        ]
      }
    ],
    name: 'initializeChannelState',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: false, name: 'currentStateRoot', type: 'bytes32' }
    ],
    name: 'StateInitialized',
    type: 'event'
  }
] as const;

// Legacy/Combined ABI for backwards compatibility
export const ROLLUP_BRIDGE_ABI = [
  // Channel Management
  {
    inputs: [
      {
        components: [
          { name: 'allowedTokens', type: 'address[]' },
          { name: 'participants', type: 'address[]' },
          { name: 'timeout', type: 'uint256' },
          { name: 'pkx', type: 'uint256' },
          { name: 'pky', type: 'uint256' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'openChannel',
    outputs: [{ name: 'channelId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },

  // Deposits
  {
    inputs: [
      { name: '_channelId', type: 'uint256' },
      { name: '_mptKey', type: 'bytes32' }
    ],
    name: 'depositETH',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: '_channelId', type: 'uint256' },
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_mptKey', type: 'bytes32' }
    ],
    name: 'depositToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },

  // Channel State Management
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      {
        name: 'proof',
        type: 'tuple',
        components: [
          { name: 'pA', type: 'uint256[4]' },
          { name: 'pB', type: 'uint256[8]' },
          { name: 'pC', type: 'uint256[4]' },
          { name: 'merkleRoot', type: 'bytes32' }
        ]
      }
    ],
    name: 'initializeChannelState',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },

  // Proof Submission
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      {
        components: [
          { name: 'aggregatedProofHash', type: 'bytes32' },
          { name: 'finalStateRoot', type: 'bytes32' },
          { name: 'proofPart1', type: 'uint128[]' },
          { name: 'proofPart2', type: 'uint256[]' },
          { name: 'publicInputs', type: 'uint256[]' },
          { name: 'smax', type: 'uint256' },
          { name: 'initialMPTLeaves', type: 'bytes[]' },
          { name: 'finalMPTLeaves', type: 'bytes[]' },
          { name: 'participantRoots', type: 'bytes32[]' }
        ],
        name: 'proofData',
        type: 'tuple'
      }
    ],
    name: 'submitAggregatedProof',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },

  // Debug Token Info
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'user', type: 'address' }
    ],
    name: 'debugTokenInfo',
    outputs: [
      { name: 'userBalance', type: 'uint256' },
      { name: 'userAllowance', type: 'uint256' },
      { name: 'contractBalance', type: 'uint256' },
      { name: 'isContract', type: 'bool' },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'decimals', type: 'uint8' }
    ],
    stateMutability: 'view',
    type: 'function'
  },

  // Signature Verification
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      {
        components: [
          { name: 'message', type: 'bytes32' },
          { name: 'rx', type: 'uint256' },
          { name: 'ry', type: 'uint256' },
          { name: 'z', type: 'uint256' }
        ],
        name: 'signature',
        type: 'tuple'
      }
    ],
    name: 'signAggregatedProof',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },

  // Channel Closure
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'closeChannel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },

  // Withdrawals
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      { name: 'claimedBalance', type: 'uint256' },
      { name: 'leafIndex', type: 'uint256' },
      { name: 'merkleProof', type: 'bytes32[]' }
    ],
    name: 'withdrawAfterClose',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },

  // View Functions
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelInfo',
    outputs: [
      { name: 'targetContract', type: 'address' },
      { name: 'state', type: 'uint8' },
      { name: 'participantCount', type: 'uint256' },
      { name: 'initialRoot', type: 'bytes32' },
      { name: 'finalRoot', type: 'bytes32' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelStats',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'allowedTokens', type: 'address[]' },
      { name: 'state', type: 'uint8' },
      { name: 'participantCount', type: 'uint256' },
      { name: 'leader', type: 'address' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelParticipants',
    outputs: [{ name: 'participants', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelTimeoutInfo',
    outputs: [
      { name: 'openTimestamp', type: 'uint256' },
      { name: 'timeout', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelDeposits',
    outputs: [
      { name: 'totalDeposits', type: 'uint256' },
      { name: 'targetContract', type: 'address' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      { name: 'participant', type: 'address' }
    ],
    name: 'getParticipantDeposit',
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      { name: 'participant', type: 'address' },
      { name: 'token', type: 'address' }
    ],
    name: 'getParticipantTokenDeposit',
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      { name: 'participant', type: 'address' },
      { name: 'token', type: 'address' }
    ],
    name: 'getL2MptKey',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      { name: 'token', type: 'address' }
    ],
    name: 'getL2MptKeysList',
    outputs: [
      { name: 'participants', type: 'address[]' },
      { name: 'l2MptKeys', type: 'uint256[]' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'isChannelExpired',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getRemainingTime',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'isChannelReadyToClose',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getTotalChannels',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'leader', type: 'address' }],
    name: 'isChannelLeader',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'targetContract', type: 'address' }],
    name: 'isAllowedTargetContract',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },

  // Additional view functions
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelTimestamps',
    outputs: [
      { name: 'openTimestamp', type: 'uint256' },
      { name: 'closeTimestamp', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'deleteChannel',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },

  // Constants
  {
    inputs: [],
    name: 'MIN_PARTICIPANTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'MAX_PARTICIPANTS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },

  // Admin Functions
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'targetContract', type: 'address' },
      { name: 'preprocessedPart1', type: 'uint128[]' },
      { name: 'preprocessedPart2', type: 'uint256[]' },
      { name: 'allowed', type: 'bool' }
    ],
    name: 'setAllowedTargetContract',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },

  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: true, name: 'targetContract', type: 'address' }
    ],
    name: 'ChannelOpened',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' }
    ],
    name: 'Deposited',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: false, name: 'currentStateRoot', type: 'bytes32' }
    ],
    name: 'StateInitialized',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: false, name: 'proofHash', type: 'bytes32' }
    ],
    name: 'ProofAggregated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: true, name: 'signer', type: 'address' }
    ],
    name: 'AggregatedProofSigned',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' }
    ],
    name: 'ChannelClosed',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' }
    ],
    name: 'Withdrawn',
    type: 'event'
  },
  // Additional view functions
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      { name: 'user', type: 'address' }
    ],
    name: 'hasWithdrawn',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      { name: 'participant', type: 'address' }
    ],
    name: 'getL2PublicKey',
    outputs: [{ name: 'l2PublicKey', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelParticipantRoots',
    outputs: [{ name: 'participantRoots', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelRoots',
    outputs: [
      { name: 'initialRoot', type: 'bytes32' },
      { name: 'finalRoot', type: 'bytes32' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Standard ERC20 ABI for token interactions
export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;