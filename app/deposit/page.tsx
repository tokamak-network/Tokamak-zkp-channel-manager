'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Layout } from '@/components/Layout';

export default function DepositPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <Layout title="Deposit Tokens" showFooter={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Connect Your Wallet</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">You need to connect your wallet to deposit tokens</p>
            <ConnectButton />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Deposit Tokens">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🚧</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Coming Soon</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              The deposit tokens feature is currently under development. 
              You'll be able to deposit ETH and ERC20 tokens into bridge channels here.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-md mx-auto">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Planned Features:</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 text-left">
                <li>• ETH deposits to channels</li>
                <li>• ERC20 token deposits</li>
                <li>• Real-time balance tracking</li>
                <li>• Transaction history</li>
                <li>• Gas estimation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}