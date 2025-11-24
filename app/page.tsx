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
import { Lock, Zap, Gem, PlusCircle, Key, ArrowDownCircle, ArrowUpCircle, Activity, FileCheck, PenTool, XCircle, Trash2 } from 'lucide-react';

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
        {/* Hero Section - When Not Connected */}
        {!isConnected ? (
          <div className="min-h-screen flex flex-col items-center justify-center px-4 py-20 relative">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#4fc3f7]/5 blur-3xl"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#028bee]/5 blur-3xl"></div>
            </div>

            <div className="max-w-4xl w-full mx-auto text-center relative z-10">
              {/* Main Title */}
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-tight" 
                  style={{ 
                    textShadow: '0 0 30px rgba(79, 195, 247, 0.3)', 
                    fontFamily: '"Jersey 10", "Press Start 2P", monospace' 
                  }}>
                Tokamak zk-Rollup
                <span className="block text-[#4fc3f7] mt-2">Channel Manager</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg lg:text-xl text-gray-300 mb-16 max-w-2xl mx-auto leading-relaxed">
                Secure, private, and efficient zero-knowledge rollup channels for Ethereum
              </p>

              {/* Connect Wallet Button - Centered */}
              <div className="flex justify-center mb-20">
                <ClientOnly>
                  <ConnectButton />
                </ClientOnly>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
                <div className="text-center p-6">
                  <div className="w-14 h-14 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 mx-auto mb-4 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-[#4fc3f7]" />
                  </div>
                  <h4 className="text-white font-semibold mb-2 text-lg">Privacy First</h4>
                  <p className="text-gray-400 text-sm">Zero-knowledge proofs ensure complete transaction privacy</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-14 h-14 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 mx-auto mb-4 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-[#4fc3f7]" />
                  </div>
                  <h4 className="text-white font-semibold mb-2 text-lg">Lightning Fast</h4>
                  <p className="text-gray-400 text-sm">Off-chain processing with on-chain security guarantees</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-14 h-14 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 mx-auto mb-4 flex items-center justify-center">
                    <Gem className="w-6 h-6 text-[#4fc3f7]" />
                  </div>
                  <h4 className="text-white font-semibold mb-2 text-lg">Low Cost</h4>
                  <p className="text-gray-400 text-sm">Minimal gas fees through batch transaction processing</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-screen p-4 pb-20">
            <div className="max-w-6xl w-full mx-auto">
              {/* Welcome Header */}
              <div className="mb-8 text-center">
                <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                  Welcome to Tokamak zkRollup
                </h2>
                <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                  Manage your channels
                </p>
              </div>

              {/* Action Cards */}
              <ClientOnly>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                  {/* Dashboard - Always available when connected */}
                  {isConnected && (
                    <div 
                      onClick={() => router.push('/dashboard')}
                      className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                    >
                      <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">Dashboard</h3>
                        <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                          View your account status and balances
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Create Channel - Available for all connected users */}
                  {isConnected && (
                    <div 
                      onClick={handleCreateChannel}
                      className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                    >
                      <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                        <PlusCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">Create Channel</h3>
                        <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                          Create multi-party bridge channel (0.001 ETH bond)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* DKG Management - Available for all connected users */}
                  {isConnected && (
                    <div 
                      onClick={handleDKGManagement}
                      className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                    >
                      <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                        <Key className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">DKG Management</h3>
                        <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                          Distributed Key Generation
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Deposit Tokens - Only for participants or leaders */}
                  {isConnected && (isParticipant || hasChannels) && (
                    <div 
                      onClick={handleDepositTokens}
                      className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                    >
                      <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                        <ArrowDownCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">Deposit Tokens</h3>
                        <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                          Deposit ERC20 tokens
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Withdraw Tokens - Only for participants or leaders */}
                  {isConnected && (isParticipant || hasChannels) && (
                    <div 
                      onClick={handleWithdrawTokens}
                      className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                    >
                      <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                        <ArrowUpCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">Withdraw Tokens</h3>
                        <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                          Withdraw from closed channel
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Channel Leader Actions */}
                  {isConnected && hasChannels && (
                    <>
                      {/* Initialize State */}
                      <div 
                        onClick={handleInitializeState}
                        className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                      >
                        <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                          <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">Initialize State</h3>
                          <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                            Initialize channel state
                          </p>
                        </div>
                      </div>

                      {/* Submit Aggregated Proof */}
                      <div 
                        onClick={handleSubmitProof}
                        className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                      >
                        <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                          <FileCheck className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">Submit Proof</h3>
                          <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                            Submit aggregated proof
                          </p>
                        </div>
                      </div>

                      {/* Sign Aggregated Proof */}
                      <div 
                        onClick={handleSignProof}
                        className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                      >
                        <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                          <PenTool className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">Sign Proof</h3>
                          <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                            Sign aggregated proof
                          </p>
                        </div>
                      </div>

                      {/* Close Channel */}
                      <div 
                        onClick={handleCloseChannel}
                        className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                      >
                        <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                          <XCircle className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">Close Channel</h3>
                          <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                            Close the channel
                          </p>
                        </div>
                      </div>

                      {/* Delete Channel */}
                      <div 
                        onClick={handleDeleteChannel}
                        className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-4 shadow-lg shadow-[#4fc3f7]/20 hover:shadow-xl hover:shadow-[#4fc3f7]/40 transition-all duration-300 cursor-pointer hover:scale-105 group flex items-center gap-4"
                      >
                        <div className="h-12 w-12 bg-[#4fc3f7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#029bee] transition-all shadow-lg shadow-[#4fc3f7]/30">
                          <Trash2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1 text-sm group-hover:text-[#4fc3f7] transition-colors">Delete Channel</h3>
                          <p className="text-gray-300 text-xs group-hover:text-gray-200 transition-colors">
                            Delete the channel
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ClientOnly>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}