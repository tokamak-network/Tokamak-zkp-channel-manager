# Tokamak ZK Rollup Manager UI

A user-friendly and attractive interface for interacting with the Tokamak ZK Rollup Manager smart contracts. This Next.js application provides a seamless experience for creating channels, making deposits, submitting proofs, and withdrawing funds using zero-knowledge cryptography and threshold signatures.

![Tokamak ZK Bridge](https://img.shields.io/badge/Tokamak-ZK%20Bridge-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3-blue)

## 🌟 Features

### Core Functionality
- **Channel Management**: Create and manage multi-party bridge channels
- **Deposits & Withdrawals**: Support for ETH and ERC20 token operations
- **Zero-Knowledge Proofs**: Integration with ZK proof submission and verification
- **Threshold Signatures**: Multi-party signature verification using FROST protocol
- **Real-time Updates**: Live channel state monitoring and updates

### User Experience
- **Wallet Integration**: Seamless connection with popular Ethereum wallets via RainbowKit
- **Responsive Design**: Mobile-first approach with beautiful animations
- **Intuitive Interface**: Clean, modern UI inspired by the template design
- **Real-time Feedback**: Loading states, transaction monitoring, and error handling
- **Search & Filtering**: Advanced channel discovery and management tools

### Security Features
- **Gas Optimization**: 39-44% gas savings through embedded Merkle operations
- **Type Safety**: Full TypeScript implementation with comprehensive type definitions
- **Error Handling**: Robust error management and user feedback
- **Address Validation**: Input validation and sanitization

## 🛠 Technology Stack

- **Frontend**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **Web3**: Wagmi v1 + Viem for Ethereum interactions
- **Wallet**: RainbowKit for wallet connections
- **UI Components**: Radix UI primitives with custom styling
- **Icons**: Lucide React icon library
- **State Management**: React Query for server state
- **TypeScript**: Full type safety throughout

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Ethereum wallet (MetaMask, WalletConnect, etc.)
- Access to Ethereum testnet (Sepolia recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Tokamak-Zk-Rollup-UI
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   # Wallet Connect Project ID (get from https://cloud.walletconnect.com)
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

   # Optional: Alchemy API key for better RPC performance
   NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key

   # Contract addresses (update with actual deployed addresses)
   NEXT_PUBLIC_ROLLUP_BRIDGE_ADDRESS=0x...
   NEXT_PUBLIC_VERIFIER_ADDRESS=0x...
   NEXT_PUBLIC_ZECFROST_ADDRESS=0x...
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Contract Integration

### Required Contract Addresses

Update the following addresses in `lib/contracts.ts`:

```typescript
export const ROLLUP_BRIDGE_ADDRESS: Address = '0x...'; // Main bridge contract
export const VERIFIER_ADDRESS: Address = '0x...';      // ZK verifier contract  
export const ZECFROST_ADDRESS: Address = '0x...';      // Threshold signature contract
```

### Supported Networks

- **Sepolia Testnet** (Chain ID: 11155111) - Recommended for testing
- **Ethereum Mainnet** (Chain ID: 1) - Production deployment
- **Local Hardhat** (Chain ID: 31337) - Development

## 🏗 Project Structure

```
├── app/                    # Next.js app directory
│   ├── channels/          # Channel listing and detail pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Homepage
│   └── providers.tsx      # Web3 and theme providers
├── components/            # React components
│   ├── ui/               # Base UI components (buttons, cards, etc.)
│   ├── ChannelCard.tsx   # Channel display component
│   ├── CreateChannelModal.tsx  # Channel creation form
│   ├── DepositModal.tsx  # Deposit interface
│   └── ...               # Other feature components
├── lib/                   # Utility libraries
│   ├── contracts.ts      # Contract ABIs and addresses
│   ├── types.ts          # TypeScript type definitions
│   ├── utils.ts          # Helper functions
│   └── wagmi.ts          # Web3 configuration
├── public/               # Static assets
└── ...                   # Config files
```

## 🎨 Key Components

### ChannelCard
Displays individual channel information with:
- Channel state and status badges
- Participant and deposit information
- Quick action buttons
- Time remaining indicators

### CreateChannelModal
Modal form for creating new channels:
- Participant address input
- L2 public key configuration
- Timeout and token selection
- Group public key setup

### DepositModal
Handles deposits with:
- ETH and ERC20 token support
- Approval flow for ERC20 tokens
- Balance checking and validation
- Transaction progress tracking

## 🔧 Configuration

### Wallet Configuration

The app uses RainbowKit for wallet connections. Supported wallets include:
- MetaMask
- WalletConnect
- Coinbase Wallet
- Rainbow Wallet

### Theme Customization

The design system is built with Tailwind CSS and includes:
- Custom color palette with primary, rollup, and zk theme colors
- Gradient backgrounds and effects
- Custom animations and transitions
- Dark mode support (can be enabled)

### Network Configuration

Networks are configured in `lib/wagmi.ts`. To add a new network:

```typescript
import { defineChain } from 'viem'

const yourNetwork = defineChain({
  id: 12345,
  name: 'Your Network',
  network: 'yournetwork',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://your-rpc-url'] } },
  blockExplorers: { default: { name: 'Explorer', url: 'https://explorer-url' } },
})
```

## 🧪 Development

### Running Tests

```bash
npm run test
# or
yarn test
```

### Building for Production

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

### Linting and Formatting

```bash
npm run lint
# or
yarn lint
```

## 🔐 Security Considerations

1. **Contract Addresses**: Always verify contract addresses before deployment
2. **Private Keys**: Never commit private keys or mnemonics
3. **Environment Variables**: Use `.env.local` for sensitive data
4. **Input Validation**: All user inputs are validated and sanitized
5. **Gas Limits**: Transaction gas limits are estimated with safety margins

## 📖 Usage Guide

### Creating a Channel

1. Connect your wallet to the application
2. Click "Create Channel" on the channels page
3. Fill in the required information:
   - Select target token (ETH or ERC20)
   - Add participant addresses (3-50 participants)
   - Set L2 public keys for each participant
   - Choose channel timeout (1 hour - 7 days)
   - Generate or input group public key coordinates
4. Submit the transaction and wait for confirmation

### Making Deposits

1. Navigate to a channel in "Initialized" state
2. Click the "Deposit" button
3. Enter the amount to deposit
4. For ERC20 tokens, approve the contract first
5. Confirm the deposit transaction
6. Wait for transaction confirmation

### Channel Lifecycle

1. **Initialized**: Channel created, accepting deposits
2. **Open**: Channel state initialized, ready for operations
3. **Active**: Channel processing transactions
4. **Closing**: Proof submitted, awaiting signatures
5. **Closed**: Channel finalized, ready for withdrawals

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Tokamak Network](https://tokamak.network)
- [Documentation](https://docs.tokamak.network)
- [GitHub Repository](https://github.com/tokamak-network)

## ⚠️ Disclaimer

This is a testnet application. Always verify contract addresses and transactions before signing. The developers are not responsible for any loss of funds due to user error or contract bugs.