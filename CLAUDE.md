# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tokamak Channel Manager App is a Next.js-based web application for managing Tokamak Private App Channels - private, autonomous layer-2 channels running on Ethereum. The app enables users to manage the complete channel lifecycle: opening channels, making deposits, exchanging off-chain transactions, generating zero-knowledge proofs, withdrawing funds, and closing channels.

## Development Commands

### Basic Commands
```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Clean build artifacts
npm run clean
```

### Setup Commands
```bash
# Install Tokamak-zk-EVM submodule (required for ZK proof generation)
./install-tokamak-zk-evm.sh

# Setup environment variables
cp env.example .env.local
# Then edit .env.local with your Firebase, Alchemy API keys
```

### Backend Development
```bash
# Navigate to backend directory for DKG server
cd backend

# Build DKG server (requires Rust)
cd ../frost-dkg
cargo build --release -p fserver

# Start DKG server
./target/release/fserver server --bind 0.0.0.0:9000

# Or use Docker
cd backend
docker-compose up -d
```

## Architecture Overview

### Core Application Structure
- **Next.js 15** app with App Router (`app/` directory)
- **TypeScript** with strict type checking
- **Tailwind CSS** for styling
- **shadcn/ui** components with Radix UI primitives
- **Wagmi/Viem** for Ethereum interactions
- **Firebase** for real-time database (temporary, being phased out)

### Key Directories
- **`app/`** - Next.js App Router pages and API routes
- **`components/`** - React components (UI components, modals, cards)
- **`lib/`** - Core utilities and business logic
- **`hooks/`** - Custom React hooks for data fetching and state management
- **`contexts/`** - React Context providers
- **`backend/`** - Rust-based DKG server deployment configs
- **`frost-dkg/`** - FROST Distributed Key Generation implementation (git submodule)
- **`proof-generation/`** - Circuit compilation and ZK proof generation utilities
- **`contracts/`** - Smart contract interfaces and ABIs
- **`Tokamak-Zk-EVM/`** - Core ZK-EVM implementation (git submodule)

### Critical Components

#### Channel Management
- **Channel lifecycle**: Create → Deposit → Initialize → Operate → Prove → Withdraw → Close
- **Smart contracts**: RollupBridge contract on Ethereum for channel state management
- **State management**: Merkle trees for off-chain state tracking

#### Zero-Knowledge Proofs
- **Circuit compilation**: Custom circuits for different tree sizes (16, 32, 64, 128 leaves)
- **Proof generation**: Browser-based proof generation using WASM
- **Verification**: On-chain verification via smart contracts

#### Distributed Key Generation (DKG)
- **FROST protocol**: 3-round threshold signature scheme
- **WebSocket server**: Rust-based coordinator for DKG ceremonies
- **Authentication**: ECDSA-signed messages for security

### Important Files
- **`lib/types.ts`** - Core TypeScript interfaces for channels, proofs, and DKG
- **`lib/contracts.ts`** - Smart contract interaction utilities
- **`lib/constants.ts`** - Network configurations and contract addresses
- **`lib/frost-dkg-bridge.ts`** - Bridge between UI and DKG server
- **`components/dkg/`** - DKG ceremony UI components

## Development Guidelines

### Smart Contract Integration
- Always use the contract utilities in `lib/contracts.ts`
- Network configurations are in `lib/constants.ts`
- Contract ABIs should be kept in `contracts/` directory

### Zero-Knowledge Proof Workflow
1. Circuit compilation happens in `proof-generation/`
2. WASM files are served from `public/zk-assets/`
3. Proof generation uses snarkjs in the browser
4. Always verify circuit compatibility when adding new proof types

### DKG Implementation
- DKG server must be running for threshold signatures
- Session management follows the flow in `docs/DKG_FLOW_DOCUMENTATION.md`
- ECDSA keypairs are required for all participants
- Use hooks in `hooks/useDKGWebSocket.ts` for WebSocket management

### State Management
- Channel data fetching uses custom hooks (`useChannelData.ts`)
- Real-time updates via Firebase (being migrated to direct contract events)
- User roles and permissions managed through `useUserRoles.ts`

## Testing and Quality

### Prerequisites for Development
- Node.js 18+
- Rust toolchain (for DKG server)
- Ethereum wallet for testing
- Access to Ethereum testnet (Sepolia recommended)
- Firebase API key (temporary)
- Alchemy API key for Ethereum node access

### Environment Setup
Critical environment variables in `.env.local`:
- Firebase configuration (temporary)
- Alchemy API keys
- Contract addresses for different networks
- DKG server URLs

## Common Patterns

### Contract Interaction Pattern
```typescript
// Always use the contract utilities
import { getRollupBridgeContract } from '@/lib/contracts';
import { contractAddresses } from '@/lib/constants';

const contract = getRollupBridgeContract(chain.id);
await contract.read.getChannelInfo([channelId]);
```

### Proof Generation Pattern
```typescript
// Use clientProofGeneration utilities
import { generateGroth16Proof } from '@/lib/clientProofGeneration';

const proof = await generateGroth16Proof({
  leafCount: 32,
  input: proofInput
});
```

### DKG Session Pattern
```typescript
// Use DKG hooks for WebSocket management
import { useDKGWebSocket } from '@/hooks/useDKGWebSocket';

const { connect, sendMessage, sessionState } = useDKGWebSocket({
  serverUrl: 'ws://localhost:9000/ws'
});
```

## Security Considerations

### Private Key Management
- ECDSA private keys for DKG must be securely stored
- Never commit private keys or sensitive configuration
- Use environment variables for all API keys and secrets

### Smart Contract Security
- All transactions should be validated before signing
- Verify contract addresses match expected deployments
- Always use the latest contract ABIs

### Proof Verification
- Client-generated proofs must be verified on-chain
- Circuit parameters must match on-chain verifier
- Input validation is critical for proof generation

## Deployment Notes

### Production Requirements
- Backend DKG server deployment (see `backend/PRODUCTION_GUIDE.md`)
- Vercel deployment for frontend
- Environment variables configured for production networks
- ZK assets (WASM, zkey files) served from CDN if needed

### Multi-Instance Support
The application supports running multiple instances for testing multi-participant scenarios. Each instance can use different Ethereum accounts to simulate real channel operations.