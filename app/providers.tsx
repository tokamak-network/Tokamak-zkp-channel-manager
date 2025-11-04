'use client';

import React from 'react';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider, getDefaultWallets, connectorsForWallets, darkTheme } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet, coinbaseWallet } from '@rainbow-me/rainbowkit/wallets';
import { configureChains, createConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ConsoleErrorFilter from '@/components/ConsoleErrorFilter';

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

// Custom Retro Arcade Theme for RainbowKit
const retroTheme = darkTheme({
  accentColor: '#00FF00',
  accentColorForeground: '#000000',
  borderRadius: 'none',
  fontStack: 'system',
  overlayBlur: 'large',
});

retroTheme.colors.modalBackground = '#0a0a14';
retroTheme.colors.modalBorder = '#00FFFF';
retroTheme.colors.modalText = '#00FFFF';
retroTheme.colors.modalTextSecondary = '#808080';
retroTheme.colors.closeButton = '#808080';
retroTheme.colors.closeButtonBackground = '#1A1A2E';
retroTheme.colors.menuItemBackground = '#1A1A2E';
retroTheme.colors.profileForeground = '#1A1A2E';
retroTheme.colors.selectedOptionBorder = '#00FF00';
retroTheme.colors.actionButtonBorder = '#00FFFF';
retroTheme.colors.actionButtonSecondaryBackground = '#1A1A2E';
retroTheme.colors.connectButtonBackground = '#000000';
retroTheme.colors.connectButtonText = '#00FFFF';
retroTheme.fonts.body = 'var(--font-ibm-plex-mono), monospace';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider 
          chains={chains}
          showRecentTransactions={false}
          initialChain={sepolia}
          theme={retroTheme}
        >
          <ThemeProvider>
            <ConsoleErrorFilter enabled={true} />
            {children}
          </ThemeProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}