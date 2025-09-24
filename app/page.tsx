'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';
import { ClientOnly } from '@/components/ClientOnly';
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from '@/lib/contracts';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { ContractInfo } from '@/components/ContractInfo';
import { ChannelCreatedBanner } from '@/components/ChannelCreatedBanner';
import { DarkModeToggle } from '@/components/DarkModeToggle';

export default function HomePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [creatorAddress, setCreatorAddress] = useState('');
  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check if the current user is the owner
  const { data: owner } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'owner',
    enabled: isConnected,
  });

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  // Check if the current user is authorized to create channels
  const { data: isAuthorized } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'isAuthorizedCreator',
    args: address ? [address] : undefined,
    enabled: isConnected && !!address,
  });

  // Get total number of channels to check leadership
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isConnected,
  });

  // Check if user is a channel leader by getting channel stats for first few channels
  const { data: channelStats0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(0)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: channelStats1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelStats',
    args: [BigInt(1)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  // Check if user is a leader of any channels
  const hasChannels = address && (
    (channelStats0 && channelStats0[5] && channelStats0[5].toLowerCase() === address.toLowerCase()) ||
    (channelStats1 && channelStats1[5] && channelStats1[5].toLowerCase() === address.toLowerCase())
  );

  // Check if user is a participant (not leader) in channels
  const { data: participantsChannel0 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(0)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 0,
  });

  const { data: participantsChannel1 } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(1)],
    enabled: isConnected && !!totalChannels && Number(totalChannels) > 1,
  });

  // Check if user is participating in any channels (as participant, not leader)
  const isParticipant = address && (
    (participantsChannel0 && participantsChannel0.includes(address)) ||
    (participantsChannel1 && participantsChannel1.includes(address))
  ) && !hasChannels; // Participant but not leader

  // Validate the creator address
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(creatorAddress);
  
  // Prepare the authorize creator transaction
  const { config } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'authorizeCreator',
    args: isValidAddress ? [creatorAddress as `0x${string}`] : undefined,
    enabled: isOwner && isValidAddress,
  });

  const { write: authorizeCreator, isLoading: isAuthorizing } = useContractWrite(config);

  const handleAuthorizeCreator = () => {
    if (authorizeCreator) {
      authorizeCreator();
      setCreatorAddress('');
    }
  };

  const handleCreateChannel = () => {
    if (!isConnected) {
      // User needs to connect wallet first
      return;
    }
    
    if (!isAuthorized) {
      // Show unauthorized modal
      setShowUnauthorizedModal(true);
      return;
    }
    
    // Redirect to channel creation page
    router.push('/create-channel');
  };

  const handleDepositTokens = () => {
    if (!isConnected) return;
    router.push('/deposit-tokens');
  };

  const handleWithdrawTokens = () => {
    if (!isConnected) return;
    // TODO: Implement withdraw tokens functionality
    console.log('Withdraw tokens clicked');
  };

  const handleInitializeState = () => {
    if (!isConnected) return;
    // TODO: Implement initialize state functionality
    console.log('Initialize state clicked');
  };

  const handleSubmitProof = () => {
    if (!isConnected) return;
    // TODO: Implement submit aggregated proof functionality
    console.log('Submit aggregated proof clicked');
  };

  const handleSignProof = () => {
    if (!isConnected) return;
    // TODO: Implement sign aggregated proof functionality
    console.log('Sign aggregated proof clicked');
  };

  const handleCloseChannel = () => {
    if (!isConnected) return;
    // TODO: Implement close channel functionality
    console.log('Close channel clicked');
  };

  const handleDeleteChannel = () => {
    if (!isConnected) return;
    // TODO: Implement delete channel functionality
    console.log('Delete channel clicked');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Channel Created Banner */}
      <ClientOnly>
        <ChannelCreatedBanner />
      </ClientOnly>

      {/* Sidebar */}
      <ClientOnly>
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>

      {/* Main Content Area */}
      <div className={`${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} transition-all duration-300`}>
        {/* Header with Connect Button */}
        <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-40 transition-colors duration-300">
          <div className="px-4 py-4 lg:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 ml-12 lg:ml-0">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">ZK</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">Tokamak ZK-Rollup Manager</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Zero-Knowledge Rollup Manager</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Dark Mode Toggle */}
                <ClientOnly>
                  <DarkModeToggle />
                </ClientOnly>
                
                {/* RainbowKit Connect Button */}
                <ClientOnly>
                  <ConnectButton />
                </ClientOnly>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 py-8 lg:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Welcome to the Tokamak zk-Rollup manager
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              Connect your wallet to start using the Zero-Knowledge Rollup Bridge
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

            {/* Owner Only: Authorize Channel Creator */}
            <ClientOnly>
              {isConnected && isOwner && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <span className="text-2xl">👑</span>
                    <h3 className="text-lg font-semibold text-orange-900">Owner Functions</h3>
                  </div>
                  <div className="max-w-md mx-auto">
                    <label htmlFor="creator-address" className="block text-sm font-medium text-orange-700 mb-2">
                      Authorize Channel Creator
                    </label>
                    <div className="flex gap-3">
                      <input
                        id="creator-address"
                        type="text"
                        value={creatorAddress}
                        onChange={(e) => setCreatorAddress(e.target.value)}
                        placeholder="0x..."
                        className="flex-1 px-3 py-2 border border-orange-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <button
                        onClick={handleAuthorizeCreator}
                        disabled={!isValidAddress || isAuthorizing}
                        className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        {isAuthorizing ? 'Authorizing...' : 'Authorize'}
                      </button>
                    </div>
                    <p className="text-xs text-orange-600 mt-2">
                      Only authorized addresses can create new channels
                    </p>
                  </div>
                </div>
              )}
            </ClientOnly>

            {/* Action Cards */}
            <ClientOnly>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-w-6xl mx-auto">
              {/* Create Channel - Only for authorized users who are not just participants */}
              {isConnected && isAuthorized && !isParticipant && (
                <div 
                  onClick={handleCreateChannel}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-green-300 dark:hover:border-green-500 group"
                >
                  <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors">
                    <span className="text-xl">⚒</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">Create Channel</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-xs group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                    Create multi-party bridge channel
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
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-8 mt-12 transition-colors duration-300">
          <div className="px-4 lg:px-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-6 w-6 rounded bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                <span className="text-white text-xs font-bold">ZK</span>
              </div>
              <span className="font-semibold text-gray-800 dark:text-gray-200">Tokamak ZK-Rollup Manager</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Powered by Tokamak Network
            </p>

            {/* Social Media Links */}
            <div className="flex items-center justify-center gap-4 mb-6">
              {/* X (Twitter) */}
              <a
                href="https://x.com/Tokamak_Network"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors duration-200"
                aria-label="Follow us on X (Twitter)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* Website */}
              <a
                href="https://www.tokamak.network/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors duration-200"
                aria-label="Visit our website"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9" />
                </svg>
              </a>

              {/* Medium */}
              <a
                href="https://medium.com/tokamak-network"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors duration-200"
                aria-label="Read our blog on Medium"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
                </svg>
              </a>

              {/* Discord */}
              <a
                href="https://discord.com/invite/J4chV2zuAK"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors duration-200"
                aria-label="Join our Discord community"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z" />
                </svg>
              </a>

              {/* Telegram */}
              <a
                href="https://t.me/tokamak_network"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors duration-200"
                aria-label="Join our Telegram channel"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/tokamaknetwork/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors duration-200"
                aria-label="Connect with us on LinkedIn"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p>⚠️ Testnet Version</p>
            </div>
          </div>
        </footer>
      </div>

      {/* Unauthorized Modal */}
      {showUnauthorizedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 transition-colors duration-300">
            <div className="text-center">
              <div className="h-12 w-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Authorization Required</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                You are not authorized to create channels. Please contact the project owner to request authorization.
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact:</p>
                <a 
                  href="mailto:hello@tokamak.network"
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  hello@tokamak.network
                </a>
              </div>
              <button
                onClick={() => setShowUnauthorizedModal(false)}
                className="w-full px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}