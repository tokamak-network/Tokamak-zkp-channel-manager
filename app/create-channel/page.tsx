'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useContractWrite, usePrepareContractWrite, useContractRead, useWaitForTransaction } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { 
  ROLLUP_BRIDGE_CORE_ABI, 
  ROLLUP_BRIDGE_CORE_ADDRESS, 
  TON_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
  USDT_TOKEN_ADDRESS 
} from '@/lib/contracts';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { MobileNavigation } from '@/components/MobileNavigation';
import { Footer } from '@/components/Footer';
import { AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';

interface Participant {
  address: string;
}

export default function CreateChannelPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Check if user is already leading a channel
  const { data: totalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'nextChannelId',
    enabled: isConnected,
  });

  const { data: channelStats0 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(0)],
    enabled: false, // Temporarily disabled
  });

  const { data: channelStats1 } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(1)],
    enabled: false, // Temporarily disabled
  });

  // Anyone can create channels now - no authorization required
  const isAuthorized = true;

  // Check if user is already a channel leader
  const isAlreadyLeader = address && (
    (channelStats0 && channelStats0[4] && String(channelStats0[4]).toLowerCase() === address.toLowerCase() && Number(channelStats0[2]) !== 5) ||
    (channelStats1 && channelStats1[4] && String(channelStats1[4]).toLowerCase() === address.toLowerCase() && Number(channelStats1[2]) !== 5)
  );

  // Form state - default to TON token since it's the only option
  const [targetContract, setTargetContract] = useState<string>(TON_TOKEN_ADDRESS);
  const [participants, setParticipants] = useState<Participant[]>([
    { address: '' }
  ]);
  const [timeout, setTimeout] = useState(1); // in days
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [createdChannelId, setCreatedChannelId] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  // Add/Remove participants
  const addParticipant = () => {
    const maxParticipants = getMaxParticipants(1); // Always 1 token now
    if (participants.length < maxParticipants) {
      setParticipants([...participants, { address: '' }]);
    }
  };

  const removeParticipant = (index: number) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  const updateParticipant = (index: number, value: string) => {
    const newParticipants = [...participants];
    newParticipants[index].address = value;
    setParticipants(newParticipants);
  };

  // Update target contract
  const updateTargetContract = (value: string) => {
    setTargetContract(value);
  };


  // Validation
  const isValidEthereumAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
  const isValidHex = (hex: string) => /^0x[a-fA-F0-9]+$/.test(hex);

  // Helper function to get contract name from address
  const getContractName = (address: string): string => {
    switch (address.toLowerCase()) {
      case TON_TOKEN_ADDRESS.toLowerCase():
        return 'TON Contract';
      case USDC_TOKEN_ADDRESS.toLowerCase():
        return 'USDC Contract';
      case USDT_TOKEN_ADDRESS.toLowerCase():
        return 'USDT Contract';
      default:
        return 'Contract';
    }
  };

  const getMaxParticipants = (tokenCount: number) => {
    // Maximum participants based on Merkle tree constraints (max 128 leaves total)
    // Each participant needs one leaf per token
    if (tokenCount === 0) return 128;
    return Math.floor(128 / tokenCount);
  };

  const isFormValid = () => {
    const maxParticipants = getMaxParticipants(1);
    
    return (
      isAuthorized && // User must be authorized to create channels
      !isAlreadyLeader && // Prevent creation if already leading a channel
      targetContract !== '' && // Target contract must be selected
      targetContract === TON_TOKEN_ADDRESS && // Only TON contract allowed
      participants.length >= 1 && 
      participants.length <= maxParticipants &&
      participants.every(p => isValidEthereumAddress(p.address)) &&
      timeout >= 1 && timeout <= 365 // 1 day to 365 days
    );
  };

  // Prepare contract call
  const channelParams = isFormValid() ? {
    targetContract: targetContract as `0x${string}`,
    participants: participants.map(p => p.address as `0x${string}`),
    timeout: BigInt(timeout * 86400) // Convert days to seconds
  } : undefined;

  const contractConfig = channelParams ? {
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'openChannel',
    args: [channelParams],
    enabled: isFormValid() && isConnected,
  } : {
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'openChannel',
    enabled: false,
  };

  const { config } = usePrepareContractWrite(contractConfig as any);

  const { write: createChannel, isLoading: isCreating, data: txData } = useContractWrite({
    ...config,
    onSuccess(data) {
      setTxHash(data.hash);
    },
    onError(error) {
      setTxHash('');
    },
  });

  // Wait for transaction confirmation
  const { isLoading: isConfirming } = useWaitForTransaction({
    hash: txData?.hash,
    enabled: !!txData?.hash,
    onSuccess(data) {
      // Extract channel ID from transaction or use total channels + 1
      setCreatedChannelId(totalChannels ? String(Number(totalChannels)) : '0');
      setShowSuccessPopup(true);
      setTxHash('');
    },
    onError(error) {
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
      <div className="min-h-screen flex items-center justify-center space-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-gray-300 mb-6">You need to connect your wallet to create a channel</p>
          <ClientOnly>
            <ConnectButton />
          </ClientOnly>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-background">
      {/* Sidebar */}
      <ClientOnly>
        <Sidebar isConnected={isConnected} onCollapse={setSidebarCollapsed} />
      </ClientOnly>

      {/* Mobile Navigation Menu */}
      <MobileNavigation 
        showMobileMenu={showMobileMenu} 
        setShowMobileMenu={setShowMobileMenu} 
      />

      {/* Main Content Area */}
      <div className="ml-0 lg:ml-72 transition-all duration-300 flex flex-col min-h-screen">
        {/* Main Content */}
        <main className="flex-1 px-4 py-8 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-8 mb-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Create Private Channel</h2>
              <p className="text-gray-300">
                Set up a channel targeting the TON token contract for zero-knowledge proof operations with multiple participants.
              </p>
            </div>

            {/* Warning for users already leading a channel */}
            <ClientOnly>
              {isAlreadyLeader && (
                <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/50">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-yellow-300">Channel Creation Restricted</h3>
                  </div>
                  <p className="text-yellow-200/90 mb-3">
                    You are already leading an active channel. You can only lead one channel at a time.
                  </p>
                  <p className="text-sm text-yellow-300/80">
                    Please close your current channel before creating a new one. You can manage your existing channel from the sidebar menu.
                  </p>
                </div>
              )}
            </ClientOnly>


            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Target Contract */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Target Contract (TON Token Only)
                </label>
                
                {/* Warning if non-TON contract is entered */}
                {targetContract && targetContract !== TON_TOKEN_ADDRESS && (
                  <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <p className="text-red-300 text-sm font-semibold">Only TON Token Contract Allowed</p>
                    </div>
                    <p className="text-red-200/80 text-xs mt-1">
                      Please use the TON token contract address: {TON_TOKEN_ADDRESS}
                    </p>
                  </div>
                )}
                
                <div className="border border-[#4fc3f7]/30 bg-[#0a1930]/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="font-medium text-white">Contract</h4>
                    {targetContract === TON_TOKEN_ADDRESS && (
                      <span className="px-2 py-1 text-xs bg-green-600/20 border border-green-500/50 text-green-300 rounded">
                        ✓ TON Contract
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      value={targetContract}
                      onChange={(e) => updateTargetContract(e.target.value)}
                      placeholder="Enter TON token contract address"
                      className="w-full px-3 py-2 text-sm border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] font-mono"
                    />
                    {targetContract && targetContract !== TON_TOKEN_ADDRESS && (
                      <p className="text-red-400 text-xs mt-1 font-semibold">⚠️ Invalid: Only TON token contract is allowed</p>
                    )}
                    
                    {/* Quick select button for TON only */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => updateTargetContract(TON_TOKEN_ADDRESS)}
                        className="px-3 py-1.5 text-sm bg-green-600/20 border border-green-500/50 text-green-300 hover:bg-green-600/40 transition-colors font-medium"
                      >
                        Use TON Token Contract
                      </button>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-400 mt-2">
                  Currently, only the TON token contract is supported for channel creation.
                </p>
                
                {/* Information for TON contract */}
                <div className="mt-3 p-4 bg-blue-900/20 border border-blue-500/50">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-blue-400" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-300 mb-2">
                        TON Token Contract
                      </h4>
                      <p className="text-blue-200/90 text-sm mb-3">
                        Channels must target the TON token contract. This ensures consistent state verification across all channels.
                      </p>
                      <div className="space-y-1 text-xs text-blue-200/80">
                        <p>• TON Contract Address: {TON_TOKEN_ADDRESS}</p>
                        <p>• You must manually enter or use the quick select button</p>
                        <p>• Other token contracts are not supported at this time</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Whitelisted Participants */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-gray-300">
                    Whitelisted Participants ({participants.length}/{getMaxParticipants(1)})
                  </label>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={addParticipant}
                      disabled={participants.length >= getMaxParticipants(1)}
                      className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors duration-200"
                    >
                      Add
                    </button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {participants.map((participant, index) => (
                    <div key={index} className="border border-[#4fc3f7]/30 bg-[#0a1930]/50 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-white">Whitelisted Participant {index + 1}</h4>
                        {participants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParticipant(index)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">
                          L1 Address
                        </label>
                        <input
                          type="text"
                          value={participant.address}
                          onChange={(e) => updateParticipant(index, e.target.value)}
                          placeholder="0x..."
                          className="w-full px-3 py-2 text-sm border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                        />
                        {participant.address && !isValidEthereumAddress(participant.address) && (
                          <p className="text-red-400 text-xs mt-1">Invalid address</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-sm text-gray-400 mt-2">
                  Minimum 1 whitelisted participant, maximum {getMaxParticipants(1)} whitelisted participants.
                </p>
                
              </div>

              {/* Timeout */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Channel Timeout (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={timeout}
                  onChange={(e) => setTimeout(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-[#4fc3f7]/50 bg-[#0a1930] text-white focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] focus:border-[#4fc3f7]"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Channel timeout period (1 day to 365 days)
                </p>
              </div>


              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={!isFormValid() || isCreating || isConfirming}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#4fc3f7] to-[#029bee] text-white font-medium hover:from-[#029bee] hover:to-[#4fc3f7] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] transition-all duration-200"
                >
                  {isCreating 
                    ? 'Submitting Transaction...' 
                    : isConfirming
                    ? 'Waiting for Confirmation...'
                    : isAlreadyLeader 
                    ? 'Already Leading a Channel' 
                    : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>

          {/* Info Panel */}
          <div className="bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 p-8">
            <h3 className="font-semibold text-[#4fc3f7] mb-4">Channel Requirements & Workflow</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Target contract must be the TON token contract</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Maximum 128 participants per channel</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Minimum 1 whitelisted participant required</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Timeout must be between 1 and 365 days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">⚠</span>
                <span>Only TON token channels are currently supported</span>
              </li>
            </ul>
          </div>
        </div>
        </main>

        {/* Footer */}
        <Footer className="mt-auto" />
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-xl shadow-[#4fc3f7]/30 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#4fc3f7]/30">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-green-500/20 border border-green-500/50 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Channel Created Successfully!</h2>
                  <p className="text-sm text-gray-300">Channel ID: {createdChannelId}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Next Steps</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div className="flex items-start gap-3 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/20">
                  <span className="text-[#4fc3f7] font-bold text-lg">1.</span>
                  <div>
                    <p className="font-medium text-white mb-1">Coordinate DKG Ceremony</p>
                    <p>Use the DKG Management page to coordinate the distributed key generation ceremony with all participants.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/20">
                  <span className="text-[#4fc3f7] font-bold text-lg">2.</span>
                  <div>
                    <p className="font-medium text-white mb-1">Wait for Participants to Deposit</p>
                    <p>All whitelisted participants need to deposit their tokens into the channel.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/20">
                  <span className="text-[#4fc3f7] font-bold text-lg">3.</span>
                  <div>
                    <p className="font-medium text-white mb-1">Initialize Channel State</p>
                    <p>As the channel leader, you'll need to initialize the channel state once DKG and deposits are complete.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/20">
                  <span className="text-[#4fc3f7] font-bold text-lg">4.</span>
                  <div>
                    <p className="font-medium text-white mb-1">Proof Operations & Close</p>
                    <p>Submit aggregated proofs, collect signatures, close the channel, and allow whitelisted participants to withdraw.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/50">
                <p className="text-sm text-gray-300">
                  <span className="font-medium text-[#4fc3f7] inline-flex items-center gap-1"><Lightbulb className="w-4 h-4" /> Tip:</span> You can manage your channel and monitor participant deposits from the dashboard. 
                  Use the sidebar menu to access channel leader functions.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#4fc3f7]/30 flex gap-3">
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="flex-1 px-4 py-2 text-gray-300 bg-[#0a1930] border border-[#4fc3f7]/30 hover:bg-[#1a2347] hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSuccessPopup(false);
                  router.push('/');
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#4fc3f7] to-[#029bee] text-white hover:from-[#029bee] hover:to-[#4fc3f7] transition-colors font-medium"
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