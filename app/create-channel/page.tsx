'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useContractWrite, usePrepareContractWrite, useContractRead } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from '@/lib/contracts';
import { Sidebar } from '@/components/Sidebar';
import { ClientOnly } from '@/components/ClientOnly';
import { DarkModeToggle } from '@/components/DarkModeToggle';

interface Participant {
  address: string;
  l2PublicKey: string;
}

export default function CreateChannelPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  
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
  const [timeout, setTimeout] = useState(24); // in hours
  const [pkx, setPkx] = useState('');
  const [pky, setPky] = useState('');
  const [preprocessData, setPreprocessData] = useState<{
    preprocess_entries_part1: string[];
    preprocess_entries_part2: string[];
  } | null>(null);
  const [preprocessError, setPreprocessError] = useState<string>('');

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

  // Handle JSON file upload for preprocess data
  const handlePreprocessFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      setPreprocessError('Please upload a JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        
        // Validate the JSON structure
        if (!data.preprocess_entries_part1 || !data.preprocess_entries_part2) {
          setPreprocessError('JSON must contain preprocess_entries_part1 and preprocess_entries_part2 arrays');
          return;
        }

        if (!Array.isArray(data.preprocess_entries_part1) || !Array.isArray(data.preprocess_entries_part2)) {
          setPreprocessError('preprocess_entries_part1 and preprocess_entries_part2 must be arrays');
          return;
        }

        // Validate hex strings
        const isValidHex16 = (str: string) => /^0x[a-fA-F0-9]{32}$/.test(str);
        const isValidHex64 = (str: string) => /^0x[a-fA-F0-9]{64}$/.test(str);

        const part1Valid = data.preprocess_entries_part1.every((entry: any) => 
          typeof entry === 'string' && isValidHex16(entry)
        );
        const part2Valid = data.preprocess_entries_part2.every((entry: any) => 
          typeof entry === 'string' && isValidHex64(entry)
        );

        if (!part1Valid) {
          setPreprocessError('preprocess_entries_part1 must contain 32-character hex strings (0x + 32 hex chars)');
          return;
        }

        if (!part2Valid) {
          setPreprocessError('preprocess_entries_part2 must contain 64-character hex strings (0x + 64 hex chars)');
          return;
        }

        setPreprocessData(data);
        setPreprocessError('');
      } catch (error) {
        setPreprocessError('Invalid JSON format');
      }
    };
    
    reader.readAsText(file);
  };

  // Validation
  const isValidEthereumAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
  const isValidHex = (hex: string) => /^0x[a-fA-F0-9]+$/.test(hex);

  const isFormValid = () => {
    return (
      !isAlreadyLeader && // Prevent creation if already leading a channel
      isValidEthereumAddress(targetContract) &&
      participants.every(p => 
        isValidEthereumAddress(p.address) && 
        isValidEthereumAddress(p.l2PublicKey)
      ) &&
      timeout >= 1 && timeout <= 168 && // 1 hour to 7 days
      isValidHex(pkx) &&
      isValidHex(pky) &&
      preprocessData !== null // Preprocess data is required
    );
  };

  // Prepare contract call
  const channelParams = isFormValid() && preprocessData ? {
    targetContract: targetContract as `0x${string}`,
    participants: participants.map(p => p.address as `0x${string}`),
    l2PublicKeys: participants.map(p => p.l2PublicKey as `0x${string}`),
    preprocessedPart1: preprocessData.preprocess_entries_part1.map(entry => 
      BigInt(entry) // Convert hex string to bigint
    ),
    preprocessedPart2: preprocessData.preprocess_entries_part2.map(entry => 
      BigInt(entry) // Convert hex string to bigint
    ),
    timeout: BigInt(timeout * 3600), // Convert hours to seconds
    pkx: BigInt(pkx),
    pky: BigInt(pky)
  } : undefined;

  const { config } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'openChannel',
    args: channelParams ? [channelParams] : undefined,
    enabled: isFormValid() && isConnected,
  });

  const { write: createChannel, isLoading: isCreating } = useContractWrite(config);

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
        <Sidebar isConnected={isConnected} />
      </ClientOnly>

      {/* Main Content Area */}
      <div className="lg:ml-64 transition-all duration-300">
        {/* Header */}
        <ClientOnly>
          <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
            <div className="px-4 py-4 lg:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 ml-12 lg:ml-0">
                  <button
                    onClick={() => router.push('/')}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                  >
                    ← Back to Home
                  </button>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create Channel</h1>
                </div>
                <div className="flex items-center gap-3">
                  <ClientOnly>
                    <DarkModeToggle />
                  </ClientOnly>
                  <ConnectButton />
                </div>
              </div>
            </div>
          </header>
        </ClientOnly>

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
                  Channel Timeout (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={timeout}
                  onChange={(e) => setTimeout(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Channel timeout period (1 hour to 7 days)
                </p>
              </div>

              {/* Preprocess Data Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preprocess Data (JSON File)
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handlePreprocessFileUpload}
                    className="hidden"
                    id="preprocess-upload"
                  />
                  <label
                    htmlFor="preprocess-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-3">
                      <span className="text-2xl">📄</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      {preprocessData ? 'File uploaded successfully!' : 'Click to upload JSON file'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Upload JSON with preprocess_entries_part1 and preprocess_entries_part2
                    </p>
                  </label>
                </div>
                
                {preprocessError && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-2">{preprocessError}</p>
                )}
                
                {preprocessData && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md transition-colors duration-300">
                    <p className="text-green-800 dark:text-green-300 text-sm font-medium">✓ Preprocess data loaded</p>
                    <p className="text-green-700 dark:text-green-400 text-xs mt-1">
                      Part 1: {preprocessData.preprocess_entries_part1.length} entries, 
                      Part 2: {preprocessData.preprocess_entries_part2.length} entries
                    </p>
                  </div>
                )}
                
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md transition-colors duration-300">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Expected JSON format:</p>
                  <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
{`{
  "preprocess_entries_part1": [
    "0x1186b2f2b6871713b10bc24ef04a9a39",
    "0x02b36b71d4948be739d14bb0e8f4a887"
  ],
  "preprocess_entries_part2": [
    "0x7e084b3358f7f1404f0a4ee1acc6d254997032f77fd77593fab7c896b7cfce1e",
    "0xe2dfa30cd1fca5558bfe26343dc755a0a52ef6115b9aef97d71b047ed5d830c8"
  ]
}`}
                  </pre>
                </div>
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
                  disabled={!isFormValid() || isCreating}
                  className="w-full px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  {isCreating ? 'Creating Channel...' : isAlreadyLeader ? 'Already Leading a Channel' : 'Create Channel'}
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
              <li>• Timeout must be between 1 hour and 7 days</li>
              <li>• Group public key coordinates are required for FROST signatures</li>
              <li>• Preprocess data JSON file is required with part1 and part2 entries</li>
              <li>• All addresses must be valid Ethereum format (0x...)</li>
            </ul>
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}