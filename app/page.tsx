'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useContractRead } from 'wagmi';
import { ClientOnly } from '@/components/ClientOnly';
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from '@/lib/contracts';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';

export default function HomePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [creatorAddress, setCreatorAddress] = useState('');
  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);

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

  // Use dynamic hook to check all channels for leadership and participation
  const { hasChannels, isParticipant: isDynamicParticipant, participatingChannels, leadingChannels } = useUserRolesDynamic();

  // For compatibility, map the dynamic results to the existing variable names
  const isParticipant = isDynamicParticipant;

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

  // Game missions based on user status
  const missions = [];
  
  if (isConnected) {
    // Create Channel - available for anyone with 1 ETH deposit
    missions.push({ 
      id: 'create', 
      icon: '⚒', 
      name: 'Create Channel', 
      level: 'LVL 1',
      color: '#00FF00',
      action: handleCreateChannel 
    });
    
    // DKG Management - available for all connected users
    missions.push({ 
      id: 'dkg', 
      icon: '🔑', 
      name: 'DKG Management', 
      level: 'LVL 2',
      color: '#FFFF00',
      action: handleDKGManagement 
    });
    
    if (isParticipant || hasChannels) {
      missions.push(
        { id: 'deposit', icon: '💰', name: 'Deposit Tokens', level: 'LVL 3', color: '#00FFFF', action: handleDepositTokens },
        { id: 'withdraw', icon: '💳', name: 'Withdraw Tokens', level: 'LVL 4', color: '#FF00FF', action: handleWithdrawTokens }
      );
    }
    
    if (hasChannels) {
      missions.push(
        { id: 'init', icon: '⚡', name: 'Initialize State', level: 'LVL 5', color: '#FFA500', action: handleInitializeState },
        { id: 'submit', icon: '📋', name: 'Submit Proof', level: 'LVL 6', color: '#00FFFF', action: handleSubmitProof },
        { id: 'sign', icon: '✎', name: 'Sign Proof', level: 'LVL 7', color: '#FF00FF', action: handleSignProof },
        { id: 'close', icon: '⊗', name: 'Close Channel', level: 'LVL 8', color: '#FF0000', action: handleCloseChannel },
        { id: 'delete', icon: '✕', name: 'Delete Channel', level: 'LVL 9', color: '#808080', action: handleDeleteChannel }
      );
    }
  }

  return (
    <>
      <Layout mainClassName="!p-0 !pt-0">
        {/* 3D Perspective Grid - Fixed to viewport */}
        <div className="perspective-grid">
          <div className="grid-plane"></div>
        </div>

        <div className="min-h-screen relative overflow-hidden">
          {/* Pac-Man dot pattern */}
          <div className="fixed inset-0 pacman-dots z-0"></div>

          {/* Main Content */}
          <div className="relative z-10 pt-12 px-6 pb-12">
            <div className="max-w-7xl mx-auto">
              {/* Channel Hub Title */}
              <div className="text-center mb-12">
                <h1 className="text-3xl pixel-font mb-4 text-[#FFA500] neon-glow-orange">
                  CHANNEL HUB
                </h1>
                <p className="text-[#00FFFF] font-mono text-xs tracking-tight">
                  {isConnected ? 'MANAGE YOUR L2 STATE CHANNELS' : 'CONNECT WALLET TO CONTINUE'}
                </p>
              </div>

              {/* Arcade Cabinet Frame */}
              <div className="arcade-cabinet max-w-5xl mx-auto mb-12">
                {/* CRT Screen */}
                <div className="arcade-screen crt-curve">
                  <div className="crt-content">
                    {/* Player Status Board */}
                    <ClientOnly>
                      {isConnected ? (
                        <div 
                          className="bg-[#1A1A2E] p-6 mb-8 border-2 border-[#FFFF00] neon-border-yellow"
                          style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
                        >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="text-center">
                        <p className="text-[#00FFFF] font-mono text-xs mb-2">PARTICIPATING CHANNELS</p>
                        <p className="text-[#00FF00] pixel-font text-2xl" style={{ textShadow: '0 0 10px #00FF00, 0 0 20px #00FF00' }}>
                          {isParticipant ? participatingChannels.length : 0}
                        </p>
                        <p className="text-[#00FFFF] font-mono text-[10px] mt-1 opacity-70">
                          Channels you've joined
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[#00FFFF] font-mono text-xs mb-2">CREATED CHANNELS</p>
                        <p className="text-[#FF00FF] pixel-font text-2xl neon-glow-pink">
                          {hasChannels ? leadingChannels.length : 0}
                        </p>
                        <p className="text-[#00FFFF] font-mono text-[10px] mt-1 opacity-70">
                          Channels you've created
                        </p>
                      </div>
                    </div>
                    
                    {/* Owner Panel Toggle */}
                    {isOwner && (
                      <div className="mt-6 pt-6 border-t-2 border-[#00FFFF]">
                        <button
                          onClick={() => setShowOwnerPanel(!showOwnerPanel)}
                          className="w-full h-12 bg-black border-2 border-[#FFA500] text-[#FFA500] hover:bg-[#1A1A2E] transition-all pixel-font text-xs flex items-center justify-center gap-2"
                          style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                        >
                          <span>👑</span>
                          <span>{showOwnerPanel ? 'HIDE' : 'SHOW'} ADMIN PANEL</span>
                        </button>
                        
                        {showOwnerPanel && (
                          <div className="mt-4 p-4 bg-black border-2 border-[#FFA500]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                            <label className="block text-[#00FFFF] font-mono text-xs mb-2">
                              AUTHORIZE CREATOR ADDRESS
                            </label>
                            <div className="flex gap-3">
                              <input
                                type="text"
                                value={creatorAddress}
                                onChange={(e) => setCreatorAddress(e.target.value)}
                                placeholder="0x..."
                                className="flex-1 px-3 py-2 bg-black border-2 border-[#00FFFF] text-[#00FFFF] font-mono text-xs focus:outline-none focus:border-[#FFFF00]"
                              />
                              <button
                                onClick={handleAuthorizeCreator}
                                disabled={!isValidAddress || isAuthorizing}
                                className="px-6 py-2 bg-black border-2 border-[#00FF00] text-[#00FF00] pixel-font text-xs hover:bg-[#1A1A2E] disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                              >
                                {isAuthorizing ? 'LOADING...' : 'AUTHORIZE'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                          )}
                        </div>
                      ) : (
                        <div 
                          className="bg-[#1A1A2E] p-12 border-2 border-[#FFFF00] neon-border-yellow text-center flash-animation"
                          style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
                        >
                          <div className="text-8xl mb-6">🎮</div>
                          <p className="text-[#FFFF00] pixel-font text-2xl mb-6 neon-glow-yellow">
                            CONNECT WALLET
                          </p>
                          <p className="text-[#00FFFF] font-mono text-xs mb-8">
                            Connect your wallet to start playing
                          </p>
                          <div className="flex justify-center">
                            <ConnectButton />
                          </div>
                        </div>
                      )}
                    </ClientOnly>

                    {/* Action Cards Grid */}
                    <ClientOnly>
                      {missions.length > 0 && (
                        <div className="mt-8">
                          <h2 className="text-[#00FFFF] pixel-font text-xl text-center mb-6 neon-glow-cyan">
                            AVAILABLE ACTIONS
                          </h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {missions.map((mission, index) => (
                        <button
                          key={mission.id}
                          onClick={mission.action}
                          className="p-6 bg-[#1A1A2E] border-2 hover:bg-[#2A2A3E] transition-all hover:translate-x-[-4px] hover:translate-y-[-4px] group"
                          style={{ 
                            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                            borderColor: mission.color,
                            boxShadow: `0 0 10px ${mission.color}40`
                          }}
                        >
                          <div className="flex items-center justify-center mb-4">
                            <span 
                              className="text-4xl"
                              style={{
                                filter: `drop-shadow(0 0 8px ${mission.color}) drop-shadow(0 0 12px ${mission.color})`
                              }}
                            >
                              {mission.icon}
                            </span>
                          </div>
                          <h3 
                            className="pixel-font text-xs mb-2"
                            style={{ 
                              color: mission.color,
                              textShadow: `0 0 5px ${mission.color}, 0 0 10px ${mission.color}`
                            }}
                          >
                            {mission.name}
                          </h3>
                            <div className="flex items-center justify-between mt-4">
                              <span className="text-[#00FFFF] font-mono text-[10px]">EXECUTE</span>
                              <span className="text-[#FFFF00] font-mono text-xs">▶</span>
                            </div>
                          </button>
                        ))}
                          </div>
                        </div>
                      )}
                    </ClientOnly>
                  </div>
                </div>
              </div>

              {/* Contract Info - Condensed */}
              <ClientOnly>
                {isConnected && (
                  <div 
                    className="mt-12 max-w-2xl mx-auto bg-[#1A1A2E] border-2 border-[#00FFFF] p-6"
                    style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
                  >
                    <p className="text-[#00FFFF] font-mono text-xs text-center mb-2">CONTRACT ADDRESS</p>
                    <p className="text-[#FFFF00] font-mono text-sm text-center break-all">
                      {ROLLUP_BRIDGE_ADDRESS}
                    </p>
                  </div>
                )}
              </ClientOnly>
            </div>
          </div>
        </div>
      </Layout>

      {/* Unauthorized Modal - Retro Style */}
      {showUnauthorizedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-[#1A1A2E] border-2 border-[#FF0000] p-8 max-w-md w-full"
            style={{ 
              clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
              boxShadow: '0 0 20px #FF0000, 0 0 40px #FF0000'
            }}
          >
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-[#FF0000] pixel-font text-xl mb-4 neon-glow-pink">
                ACCESS DENIED
              </h3>
              <p className="text-[#00FFFF] font-mono text-xs mb-6">
                You are not authorized to create channels. Contact the admin for authorization.
              </p>
              <div className="bg-black border-2 border-[#00FFFF] p-4 mb-6">
                <p className="text-[#00FFFF] font-mono text-xs mb-2">CONTACT</p>
                <a 
                  href="mailto:hello@tokamak.network"
                  className="text-[#FFFF00] font-mono text-xs hover:text-[#FF00FF] transition-colors"
                >
                  hello@tokamak.network
                </a>
              </div>
              <button
                onClick={() => setShowUnauthorizedModal(false)}
                className="w-full h-12 bg-black border-2 border-[#FF0000] text-[#FF0000] pixel-font text-xs hover:bg-[#1A1A2E] transition-all"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                CONTINUE
              </button>
            </div>
          </div>
        </div>
      )}
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
                  Create multi-party bridge channel (1 ETH bond)
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