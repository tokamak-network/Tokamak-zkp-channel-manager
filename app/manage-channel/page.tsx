'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '@/components/Sidebar';

export default function ManageChannelPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar isConnected={isConnected} />
        <div className="lg:ml-64 transition-all duration-300">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
              <p className="text-gray-600 mb-6">You need to connect your wallet to manage channels</p>
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isConnected={isConnected} />

      {/* Main Content Area */}
      <div className="lg:ml-64 transition-all duration-300">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-4 py-4 lg:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 ml-12 lg:ml-0">
                <h1 className="text-xl font-bold text-gray-900">Manage Channels</h1>
              </div>
              <ConnectButton />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 py-8 lg:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="text-center py-12">
                <div className="h-16 w-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🚧</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Coming Soon</h2>
                <p className="text-gray-600 mb-6">
                  The channel management feature is currently under development. 
                  You'll be able to view and manage all your bridge channels here.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                  <h3 className="font-semibold text-blue-900 mb-2">Planned Features:</h3>
                  <ul className="text-sm text-blue-800 space-y-1 text-left">
                    <li>• View all your channels</li>
                    <li>• Channel status tracking</li>
                    <li>• Participant management</li>
                    <li>• Transaction history</li>
                    <li>• Channel closure</li>
                    <li>• Proof submission</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}