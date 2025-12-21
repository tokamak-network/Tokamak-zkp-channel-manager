'use client';

import React from 'react';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider, getDefaultWallets, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet, coinbaseWallet } from '@rainbow-me/rainbowkit/wallets';
import { configureChains, createConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as OldThemeProvider } from '@/contexts/ThemeContext';
import { ThemeProvider } from '@/components/ui/theme-toggle';
import { ToastProvider } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/ui/error-boundary';

import '@rainbow-me/rainbowkit/styles.css';

// Configure chains and providers with Alchemy RPC URLs from environment
const { chains, publicClient } = configureChains(
  [sepolia, mainnet],
  [
    jsonRpcProvider({
      rpc: (chain) => ({
        http: chain.id === 1 
          ? process.env.MAINNET_RPC_URL || `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
          : process.env.SEPOLIA_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
        webSocket: undefined, // Disable WebSocket to avoid connection issues
      }),
    }),
    publicProvider()
  ]
);

// Configure wallets without requiring WalletConnect cloud services
const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      injectedWallet({ chains }),
      metaMaskWallet({ 
        projectId: 'local-development', 
        chains 
      }),
      coinbaseWallet({ 
        appName: 'Tokamak ZK Rollup Manager', 
        chains 
      }),
    ],
  },
]);

// Create wagmi config with ENS configuration
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider 
          chains={chains}
          showRecentTransactions={false}
          initialChain={sepolia}
        >
          <ErrorBoundary>
            <ThemeProvider>
              <ToastProvider>
                <OldThemeProvider>
                  {children}
                </OldThemeProvider>
              </ToastProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}