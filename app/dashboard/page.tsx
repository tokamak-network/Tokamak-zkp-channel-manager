'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ClientOnly } from '@/components/ClientOnly';
import { Layout } from '@/components/Layout';
import { ContractInfo } from '@/components/ContractInfo';
import { Activity } from 'lucide-react';

export default function DashboardPage() {
  const { isConnected } = useAccount();

  return (
    <>
      <Layout>
        {/* Dashboard Content */}
        <div className="min-h-screen p-4 pb-20">
          <div className="max-w-6xl w-full mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              </div>
              <p className="text-gray-300 ml-13">
                Monitor your account status, channel participation, and token balances.
              </p>
            </div>

            {!isConnected ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Connect Your Wallet</h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">You need to connect your wallet to view your dashboard</p>
                  <ClientOnly>
                    <ConnectButton />
                  </ClientOnly>
                </div>
              </div>
            ) : (
              <ClientOnly>
                <ContractInfo />
              </ClientOnly>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}