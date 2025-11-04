'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useContractRead } from 'wagmi';
import { ClientOnly } from '@/components/ClientOnly';
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from '@/lib/contracts';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { ContractInfo } from '@/components/ContractInfo';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';

export default function HomePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Use dynamic hook to check all channels for leadership and participation
  const { hasChannels, isParticipant } = useUserRolesDynamic();

  const handleCreateChannel = () => {
    if (!isConnected) {
      return;
    }
    
    router.push('/create-channel');
  };

  const handleDepositTokens = () => {
    if (!isConnected) return;
    router.push('/deposit-tokens');
  };

  const handleWithdrawTokens = () => {
    if (!isConnected) return;
    router.push('/withdraw-tokens');
  };

  const handleInitializeState = () => {
    if (!isConnected) return;
    router.push('/initialize-state');
  };

  const handleSubmitProof = () => {
    if (!isConnected) return;
    router.push('/submit-proof');
  };

  const handleSignProof = () => {
    if (!isConnected) return;
    router.push('/sign-proof');
  };

  const handleCloseChannel = () => {
    if (!isConnected) return;
    router.push('/close-channel');
  };

  const handleDeleteChannel = () => {
    if (!isConnected) return;
    router.push('/delete-channel');
  };

  const handleDKGManagement = () => {
    if (!isConnected) return;
    router.push('/dkg-management');
  };

  return (
    <>
      <Layout>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Welcome to the Tokamak zk-Rollup manager
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Connect your wallet to start using the Zero-Knowledge Rollup Manager
          </p>

          {/* Contract Information */}
          <ClientOnly>
            <ContractInfo />
          </ClientOnly>

          {/* Connection Status */}
          <ClientOnly fallback={
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-900">Loading...</h3>
              </div>
              <p className="text-gray-600">
                Checking wallet connection status
              </p>
            </div>
          }>
            {!isConnected ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="h-3 w-3 bg-yellow-500 rounded-full animate-pulse"></div>
                  <h3 className="text-lg font-semibold text-yellow-900">Wallet Not Connected</h3>
                </div>
                <p className="text-yellow-700 mb-4">
                  Please connect your wallet to access bridge functionality
                </p>
                <div className="flex justify-center">
                  <ClientOnly>
                    <ConnectButton />
                  </ClientOnly>
                </div>
              </div>
            ) : null}
          </ClientOnly>


          {/* Action Cards */}
          <ClientOnly>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-w-6xl mx-auto px-4">
            {/* Create Channel - Available for all connected users */}
            {isConnected && (
              <div 
                onClick={handleCreateChannel}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-green-300 dark:hover:border-green-500 group"
              >
                <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors">
                  <span className="text-xl">⚒</span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">Create Channel</h3>
                <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                  Create multi-party bridge channel (0.001 ETH bond)
                </p>
              </div>
            )}

            {/* DKG Management - Available for all connected users */}
            {isConnected && (
              <div 
                onClick={handleDKGManagement}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-yellow-300 dark:hover:border-yellow-500 group"
              >
                <div className="h-10 w-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-800/40 transition-colors">
                  <span className="text-xl">🔑</span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-yellow-700 dark:group-hover:text-yellow-300 transition-colors">DKG Management</h3>
                <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                  Distributed Key Generation
                </p>
              </div>
            )}

            {/* Deposit Tokens - Only for participants or leaders */}
            {isConnected && (isParticipant || hasChannels) && (
              <div 
                onClick={handleDepositTokens}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300 dark:hover:border-blue-500 group"
              >
                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                  <span className="text-xl">💰</span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">Deposit Tokens</h3>
                <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 transition-colors">
                  Deposit ETH or ERC20 tokens
                </p>
              </div>
            )}

            {/* Withdraw Tokens - Only for participants or leaders */}
            {isConnected && (isParticipant || hasChannels) && (
              <div 
                onClick={handleWithdrawTokens}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-purple-300 dark:hover:border-purple-500 group"
              >
                <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors">
                  <span className="text-xl">💳</span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">Withdraw Tokens</h3>
                <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 transition-colors">
                  Withdraw from closed channel
                </p>
              </div>
            )}

            {/* Channel Leader Actions */}
            {isConnected && hasChannels && (
              <>
                {/* Initialize State */}
                <div 
                  onClick={handleInitializeState}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-orange-300 dark:hover:border-orange-500 group"
                >
                  <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40 transition-colors">
                    <span className="text-xl">⚡</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-orange-700 dark:group-hover:text-orange-300 transition-colors">Initialize State</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 transition-colors">
                    Initialize channel state
                  </p>
                </div>

                {/* Submit Aggregated Proof */}
                <div 
                  onClick={handleSubmitProof}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-teal-300 dark:hover:border-teal-500 group"
                >
                  <div className="h-10 w-10 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-teal-200 dark:group-hover:bg-teal-800/40 transition-colors">
                    <span className="text-xl">📋</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">Submit Proof</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 transition-colors">
                    Submit aggregated proof
                  </p>
                </div>

                {/* Sign Aggregated Proof */}
                <div 
                  onClick={handleSignProof}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 group"
                >
                  <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/40 transition-colors">
                    <span className="text-xl">✍️</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">Sign Proof</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 transition-colors">
                    Sign aggregated proof
                  </p>
                </div>

                {/* Close Channel */}
                <div 
                  onClick={handleCloseChannel}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-red-300 dark:hover:border-red-500 group"
                >
                  <div className="h-10 w-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-red-200 dark:group-hover:bg-red-800/40 transition-colors">
                    <span className="text-xl">🔐</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">Close Channel</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 transition-colors">
                    Close the channel
                  </p>
                </div>

                {/* Delete Channel */}
                <div 
                  onClick={handleDeleteChannel}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 group"
                >
                  <div className="h-10 w-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                    <span className="text-xl">🗑️</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-gray-700 transition-colors">Delete Channel</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 transition-colors">
                    Delete the channel
                  </p>
                </div>
              </>
            )}
            </div>
          </ClientOnly>
        </div>
      </Layout>

    </>
  );
}