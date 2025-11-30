import { Address } from 'wagmi';

// Modular Contract addresses - Updated for new architecture
export const ROLLUP_BRIDGE_CORE_ADDRESS: Address = '0x3e47aeefffec5e4bce34426ed6c8914937a65435' as Address;
export const ROLLUP_BRIDGE_DEPOSIT_MANAGER_ADDRESS: Address = '0xD5E8B17058809B9491F99D35B67A089A2618f5fB' as Address;
export const ROLLUP_BRIDGE_PROOF_MANAGER_ADDRESS: Address = '0xF0396B7547C7447FBb14A127D3751425893322fc' as Address;
export const ROLLUP_BRIDGE_WITHDRAW_MANAGER_ADDRESS: Address = '0xAf833c7109DB3BfDAc54a98EA7b123CFDE51d777' as Address;
export const ROLLUP_BRIDGE_ADMIN_MANAGER_ADDRESS: Address = '0x1c38A6739bDb55f357fcd1aF258E0359ed77c662' as Address;

// Legacy address for backwards compatibility
export const ROLLUP_BRIDGE_ADDRESS: Address = ROLLUP_BRIDGE_CORE_ADDRESS;
// Legacy verifier for backwards compatibility
export const VERIFIER_ADDRESS: Address = '0xF43C2a14A8e5Ab3FC8740ea4AABc45010ED9fb52' as Address;

// Groth16 Verifiers for different tree sizes
export const GROTH16_VERIFIER_16_ADDRESS: Address = '0x27f453C0f7eAC419A390edaae6b0ABA64D6490c9' as Address;
export const GROTH16_VERIFIER_32_ADDRESS: Address = '0xCF85A85856237C8B1E9FE43e117ca8245c2AbE6A' as Address;
export const GROTH16_VERIFIER_64_ADDRESS: Address = '0x9192Ab6CCe1FF89393153BD54CE95F7aEE0Cf831' as Address;
export const GROTH16_VERIFIER_128_ADDRESS: Address = '0xdb70a38547f6Bcc655786b2cf19D0f34e7B3ebED' as Address; 
export const ZECFROST_ADDRESS: Address = '0x910eEE98A93d54AD52694cBf2B45B1534C8c8D10' as Address; 

// Supported token addresses on Sepolia testnet
export const TON_TOKEN_ADDRESS: Address = '0xa30fe40285B8f5c0457DbC3B7C8A280373c40044' as Address; // TON token (18 decimals)
export const WTON_TOKEN_ADDRESS: Address = '0x79E0d92670106c85E9067b56B8F674340dCa0Bbd' as Address; // WTON token
export const USDT_TOKEN_ADDRESS: Address = '0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A' as Address; // USDT token
export const ETH_TOKEN_ADDRESS: Address = '0x0000000000000000000000000000000000000001' as Address; // ETH placeholder

// Token utilities are in ./tokenUtils.ts to avoid circular dependency

/**
 * Get the appropriate Groth16 verifier address based on tree size
 * @param treeSize - The merkle tree size (16, 32, 64, or 128)
 * @returns The corresponding verifier contract address
 */
export function getGroth16VerifierAddress(treeSize: number): Address {
  switch (treeSize) {
    case 16:
      return GROTH16_VERIFIER_16_ADDRESS;
    case 32:
      return GROTH16_VERIFIER_32_ADDRESS;
    case 64:
      return GROTH16_VERIFIER_64_ADDRESS;
    case 128:
      return GROTH16_VERIFIER_128_ADDRESS;
    default:
      throw new Error(`Unsupported tree size: ${treeSize}. Supported sizes are 16, 32, 64, 128.`);
  }
}

// RollupBridge Core ABI - Main view functions and state management
export const ROLLUP_BRIDGE_CORE_ABI = [
  // Channel Management - Core Functions
  {
    inputs: [
      {
        components: [
          { name: 'allowedTokens', type: 'address[]' },
          { name: 'participants', type: 'address[]' },
          { name: 'timeout', type: 'uint256' }
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
  {
    inputs: [
      { name: 'channelId', type: 'uint256' },
      { name: 'pkx', type: 'uint256' },
      { name: 'pky', type: 'uint256' }
    ],
    name: 'setChannelPublicKey',
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'isChannelPublicKeySet',
    outputs: [{ name: '', type: 'bool' }],
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
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getLeaderBond',
    outputs: [{ name: 'bond', type: 'uint256' }, { name: 'slashed', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'nextChannelId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'getChannelInfo',
    outputs: [
      { name: 'allowedTokens', type: 'address[]' },
      { name: 'state', type: 'uint8' },
      { name: 'participantCount', type: 'uint256' },
      { name: 'initialRoot', type: 'bytes32' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }, { name: 'participant', type: 'address' }],
    name: 'hasUserWithdrawn',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }],
    name: 'isSignatureVerified',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'channelId', type: 'uint256' }, { name: 'participant', type: 'address' }, { name: 'token', type: 'address' }],
    name: 'getWithdrawableAmount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getTreasuryAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getTotalSlashedBonds',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
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
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: false, name: 'pkx', type: 'uint256' },
      { indexed: false, name: 'pky', type: 'uint256' },
      { indexed: false, name: 'signerAddr', type: 'address' }
    ],
    name: 'ChannelPublicKeySet',
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
    inputs: [
      { name: 'channelId', type: 'uint256' },
      {
        name: 'proofData',
        type: 'tuple',
        components: [
          { name: 'proofPart1', type: 'uint128[]' },
          { name: 'proofPart2', type: 'uint256[]' },
          { name: 'publicInputs', type: 'uint256[]' },
          { name: 'smax', type: 'uint256' },
          {
            name: 'functions',
            type: 'tuple[]',
            components: [
              { name: 'functionSignature', type: 'bytes32' },
              { name: 'preprocessedPart1', type: 'uint128[]' },
              { name: 'preprocessedPart2', type: 'uint256[]' }
            ]
          },
          { name: 'finalBalances', type: 'uint256[][]' }
        ]
      },
      {
        name: 'signature',
        type: 'tuple',
        components: [
          { name: 'message', type: 'bytes32' },
          { name: 'rx', type: 'uint256' },
          { name: 'ry', type: 'uint256' },
          { name: 'z', type: 'uint256' }
        ]
      }
    ],
    name: 'submitProofAndSignature',
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
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'channelId', type: 'uint256' },
      { indexed: true, name: 'signer', type: 'address' }
    ],
    name: 'AggregatedProofSigned',
    type: 'event'
  }
] as const;

// Withdraw Manager ABI
export const ROLLUP_BRIDGE_WITHDRAW_MANAGER_ABI = [
  {
    inputs: [
      { name: 'channelId', type: 'uint256' }
    ],
    name: 'closeAndFinalizeChannel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
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
      { indexed: true, name: 'participant', type: 'address' },
      { indexed: false, name: 'token', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' }
    ],
    name: 'WithdrawCompleted',
    type: 'event'
  }
] as const;

// Legacy/Combined ABI for backwards compatibility - merging all the individual ABIs
export const ROLLUP_BRIDGE_ABI = [
  // Core functions
  ...ROLLUP_BRIDGE_CORE_ABI,
  // Deposit functions  
  ...ROLLUP_BRIDGE_DEPOSIT_MANAGER_ABI,
  // Proof functions
  ...ROLLUP_BRIDGE_PROOF_MANAGER_ABI,
  // Withdraw functions
  ...ROLLUP_BRIDGE_WITHDRAW_MANAGER_ABI,
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