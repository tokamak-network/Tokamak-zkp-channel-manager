'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useContractWrite, usePrepareContractWrite, useContractRead, useWaitForTransaction } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits } from 'ethers';
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from '@/lib/contracts';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { MobileNavigation } from '@/components/MobileNavigation';
import { MobileMenuButton } from '@/components/MobileMenuButton';

interface Participant {
  address: string;
  l2PublicKey: string;
}

export default function CreateChannelPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Check if user is already leading a channel
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    enabled: isConnected,
  });

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

  // Anyone can create channels now - no authorization required
  const isAuthorized = true;

  // Check if user is already a channel leader
  const isAlreadyLeader = address && (
    (channelStats0 && channelStats0[5] && channelStats0[5].toLowerCase() === address.toLowerCase() && channelStats0[2] !== 5) ||
    (channelStats1 && channelStats1[5] && channelStats1[5].toLowerCase() === address.toLowerCase() && channelStats1[2] !== 5)
  );

  // Form state
  const [targetContract, setTargetContract] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([
    { address: '', l2PublicKey: '' },
    { address: '', l2PublicKey: '' },
    { address: '', l2PublicKey: '' }
  ]);
  const [timeout, setTimeout] = useState(1); // in days
  const [pkx, setPkx] = useState('');
  const [pky, setPky] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [createdChannelId, setCreatedChannelId] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  // Add/Remove participants
  const addParticipant = () => {
    if (participants.length < 50) {
      setParticipants([...participants, { address: '', l2PublicKey: '' }]);
    }
  };

  const removeParticipant = (index: number) => {
    if (participants.length > 3) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  const updateParticipant = (index: number, field: 'address' | 'l2PublicKey', value: string) => {
    const newParticipants = [...participants];
    newParticipants[index][field] = value;
    setParticipants(newParticipants);
  };


  // Validation
  const isValidEthereumAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
  const isValidHex = (hex: string) => /^0x[a-fA-F0-9]+$/.test(hex);

  const isFormValid = () => {
    return (
      isAuthorized && // User must be authorized to create channels
      !isAlreadyLeader && // Prevent creation if already leading a channel
      isValidEthereumAddress(targetContract) &&
      participants.every(p => 
        isValidEthereumAddress(p.address) && 
        isValidEthereumAddress(p.l2PublicKey)
      ) &&
      timeout >= 1 && timeout <= 365 && // 1 day to 365 days
      isValidHex(pkx) &&
      isValidHex(pky)
    );
  };

  // Prepare contract call
  const channelParams = isFormValid() ? {
    targetContract: targetContract as `0x${string}`,
    participants: participants.map(p => p.address as `0x${string}`),
    l2PublicKeys: participants.map(p => p.l2PublicKey as `0x${string}`),
    timeout: BigInt(timeout * 86400), // Convert days to seconds
    pkx: BigInt(pkx),
    pky: BigInt(pky)
  } : undefined;

  const { config } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'openChannel',
    args: channelParams ? [channelParams] : undefined,
    value: parseUnits('1', 18), // Required 1 ETH leader bond
    enabled: isFormValid() && isConnected,
  });

  const { write: createChannel, isLoading: isCreating, data: txData } = useContractWrite({
    ...config,
    onSuccess(data) {
      console.log('Transaction submitted:', data);
      setTxHash(data.hash);
    },
    onError(error) {
      console.error('Failed to submit transaction:', error);
      setTxHash('');
    },
  });

  // Wait for transaction confirmation
  const { isLoading: isConfirming } = useWaitForTransaction({
    hash: txData?.hash,
    enabled: !!txData?.hash,
    onSuccess(data) {
      console.log('Transaction confirmed:', data);
      // Extract channel ID from transaction or use total channels + 1
      setCreatedChannelId(totalChannels ? String(Number(totalChannels)) : '0');
      setShowSuccessPopup(true);
      setTxHash('');
    },
    onError(error) {
      console.error('Transaction failed:', error);
      setTxHash('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createChannel && isFormValid()) {
      createChannel();
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Connect Your Wallet</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">You need to connect your wallet to create a channel</p>
          <ClientOnly>
            <ConnectButton />
          </ClientOnly>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <ClientOnly>
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>

      {/* Main Content Area */}
      <div className={`ml-0 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} transition-all duration-300`}>
        {/* Header */}
        <ClientOnly>
          <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
            <div className="px-4 py-4 lg:px-6">
              <div className="flex items-center justify-between">
                <div className="hidden lg:flex items-center gap-4">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">+</span>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create Channel</h1>
                </div>
                <div className="flex items-center gap-3">
                  <MobileMenuButton 
                    showMobileMenu={showMobileMenu} 
                    setShowMobileMenu={setShowMobileMenu} 
                  />
                  <ClientOnly>
                    <DarkModeToggle />
                  </ClientOnly>
                  <ConnectButton />
                </div>
              </div>
            </div>
          </header>
        </ClientOnly>

        {/* Mobile Navigation Menu */}
        <MobileNavigation 
          showMobileMenu={showMobileMenu} 
          setShowMobileMenu={setShowMobileMenu} 
        />

        {/* Main Content */}
        <main className="px-4 py-8 lg:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 transition-colors duration-300">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Create Multi-Party Channel</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Set up a collaborative bridge channel for zero-knowledge proof operations with multiple participants.
              </p>
            </div>

            {/* Warning for users already leading a channel */}
            <ClientOnly>
              {isAlreadyLeader && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-yellow-600 dark:text-yellow-400 text-lg">⚠️</span>
                    <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">Channel Creation Restricted</h3>
                  </div>
                  <p className="text-yellow-700 dark:text-yellow-400 mb-3">
                    You are already leading an active channel. You can only lead one channel at a time.
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    Please close your current channel before creating a new one. You can manage your existing channel from the sidebar menu.
                  </p>
                </div>
              )}
            </ClientOnly>

            {/* Info message about leader bond requirement */}
            <ClientOnly>
              {!isAlreadyLeader && address && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                    <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300">Leader Bond Required</h3>
                  </div>
                  <p className="text-amber-700 dark:text-amber-400 mb-3">
                    Creating a channel requires a 1 ETH leader bond deposit. This bond will be returned when the channel is successfully closed.
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    If you fail to submit proof within 7 days after the channel timeout, your bond may be slashed. Fill out the form below to create your channel.
                  </p>
                </div>
              )}
            </ClientOnly>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Target Contract */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Contract Address
                </label>
                <input
                  type="text"
                  value={targetContract}
                  onChange={(e) => setTargetContract(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {targetContract && !isValidEthereumAddress(targetContract) && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">Invalid Ethereum address</p>
                )}
                
                {/* Warning for supported tokens */}
                <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                        Supported Target Tokens
                      </h4>
                      <p className="text-amber-700 dark:text-amber-400 text-sm mb-3">
                        Currently, only WTON and USDT tokens are supported as target contracts.
                      </p>
                      <div className="space-y-2">
                        <div className="bg-amber-100 dark:bg-amber-900/40 rounded-md p-2">
                          <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">WTON Token</div>
                          <div className="text-xs text-amber-700 dark:text-amber-400 font-mono break-all">
                            0x79E0d92670106c85E9067b56B8F674340dCa0Bbd
                          </div>
                        </div>
                        <div className="bg-amber-100 dark:bg-amber-900/40 rounded-md p-2">
                          <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">USDT Token</div>
                          <div className="text-xs text-amber-700 dark:text-amber-400 font-mono break-all">
                            0x42d3b260c761cD5da022dB56Fe2F89c4A909b04A
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Participants ({participants.length}/50)
                  </label>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={addParticipant}
                      disabled={participants.length >= 50}
                      className="px-3 py-1 text-sm bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors duration-200"
                    >
                      Add
                    </button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {participants.map((participant, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 rounded-lg p-4 transition-colors duration-300">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Participant {index + 1}</h4>
                        {participants.length > 3 && (
                          <button
                            type="button"
                            onClick={() => removeParticipant(index)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            L1 Address
                          </label>
                          <input
                            type="text"
                            value={participant.address}
                            onChange={(e) => updateParticipant(index, 'address', e.target.value)}
                            placeholder="0x..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {participant.address && !isValidEthereumAddress(participant.address) && (
                            <p className="text-red-600 dark:text-red-400 text-xs mt-1">Invalid address</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            L2 Public Key
                          </label>
                          <input
                            type="text"
                            value={participant.l2PublicKey}
                            onChange={(e) => updateParticipant(index, 'l2PublicKey', e.target.value)}
                            placeholder="0x..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {participant.l2PublicKey && !isValidEthereumAddress(participant.l2PublicKey) && (
                            <p className="text-red-600 dark:text-red-400 text-xs mt-1">Invalid L2 public key</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-sm text-gray-500 mt-2">
                  Minimum 3 participants, maximum 50 participants required.
                </p>
              </div>

              {/* Timeout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Channel Timeout (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={timeout}
                  onChange={(e) => setTimeout(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Channel timeout period (1 day to 365 days)
                </p>
              </div>


              {/* Group Public Key */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Public Key X Coordinate
                  </label>
                  <input
                    type="text"
                    value={pkx}
                    onChange={(e) => setPkx(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {pkx && !isValidHex(pkx) && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">Invalid hex format</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Public Key Y Coordinate
                  </label>
                  <input
                    type="text"
                    value={pky}
                    onChange={(e) => setPky(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {pky && !isValidHex(pky) && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">Invalid hex format</p>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={!isFormValid() || isCreating || isConfirming}
                  className="w-full px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  {isCreating 
                    ? 'Submitting Transaction...' 
                    : isConfirming
                    ? 'Waiting for Confirmation...'
                    : isAlreadyLeader 
                    ? 'Already Leading a Channel' 
                    : 'Create Channel (1 ETH bond)'}
                </button>
              </div>
            </form>
          </div>

          {/* Info Panel */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6 transition-colors duration-300">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">Channel Requirements</h3>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
              <li>• Target contract must be a valid Ethereum address</li>
              <li>• Between 3-50 participants required</li>
              <li>• Each participant needs L1 address and L2 public key</li>
              <li>• Timeout must be between 1 day and 365 days</li>
              <li>• Group public key coordinates are required for FROST signatures</li>
              <li>• Preprocess data JSON file is required with part1 and part2 entries</li>
              <li>• All addresses must be valid Ethereum format (0x...)</li>
            </ul>
          </div>
        </div>
        </main>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 transition-colors duration-300">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Channel Created Successfully!</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Channel ID: {createdChannelId}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Next Steps</h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 font-bold">1.</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Wait for Participants to Deposit</p>
                    <p>All participants need to deposit their tokens into the channel.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 font-bold">2.</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Initialize Channel State</p>
                    <p>As the channel leader, you'll need to initialize the channel state once all deposits are complete.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 font-bold">3.</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Proof Operations</p>
                    <p>Submit aggregated proofs, collect signatures, and manage the channel lifecycle.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 font-bold">4.</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Close & Withdraw</p>
                    <p>Close the channel when operations are complete and allow participants to withdraw.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <span className="font-medium">💡 Tip:</span> You can manage your channel and monitor participant deposits from the dashboard. 
                  Use the sidebar menu to access channel leader functions.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSuccessPopup(false);
                  router.push('/');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}