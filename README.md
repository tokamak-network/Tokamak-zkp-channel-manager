# Tokamak Channel Manager App

Tokamak Channel Manager App is a browser-based GUI for managing Tokamak Private App Channels. Tokamak Private App Channels are private, autonomous layer-2 channels running on Ethereum. This app lets users manage the channel lifecycle, including opening channels, making deposits, exchanging off-chain transactions, generating zero-knowledge proofs, withdrawing funds, and closing channels.

For more information about Tokamak Private App Channels, please read [our introduction](https://medium.com/tokamak-network/project-tokamak-zk-evm-67483656fd21).

![Tokamak ZK Bridge](https://img.shields.io/badge/Tokamak-ZK%20Bridge-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3-blue)

# 🚀 Quick Start

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Ethereum wallet (MetaMask, WalletConnect, etc.)
- Access to Ethereum testnet (Sepolia recommended)
- Firebase API key (temporary, will be removed soon)
- Alchemy's Ethereum node infra service provider API key
- **(Important) Prerequisites for [Tokamak-zk-EVM](https://github.com/tokamak-network/Tokamak-zk-EVM?tab=readme-ov-file#prerequisites)**

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tokamak-network/Tokamak-zkp-channel-manager.git
   cd Tokamak-zkp-channel-manager
   ```

2. **Environment Setup**
   Create a `.env.local` file in the root directory. The format lives in `./env.example`.

3. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

4. **Install Tokamak-zk-EVM**
   _Make sure that all prerequisites for Tokamak-zk-EVM are installed._
   ```bash
   ./install-tokamak-zk-evm.sh
   ```

5. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser**
   Open your browser and navigate to http://localhost:<PORT_NUMBER>, where <PORT_NUMBER> will be displayd on your terminal, if it is smoothely running.

   You can run multiple instances with different port numbers by repeating step 5 on multiple terminals. This will be useful if you want to simulate running a channel using multiple Ethereum accounts.

## Experience lifecycle of a channel
Channel creation -> Deposit -> Initializing channel state -> Channel operation -> On-chain proof verification -> Finalizing channel state -> Withdrawal

We provide [an instructional video](https://youtu.be/1FXlpEbJqDk?si=BDPPzspby_cs-GvO). Please follow along (make sure to disable "Frost threshold signing" when creating a channel. It is under development.)

[![Channel lifecycle walkthrough](https://img.youtube.com/vi/1FXlpEbJqDk/0.jpg)](https://youtu.be/1FXlpEbJqDk)

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
- [Tokamak Network ZKP](https://zkp.tokamak.network)
- [Tokamak Network ZKP overview](https://medium.com/tokamak-network/project-tokamak-zk-evm-67483656fd21)

## ⚠️ Disclaimer

This is a testnet application. Always verify contract addresses and transactions before signing. The developers are not responsible for any loss of funds due to user error or contract bugs.
