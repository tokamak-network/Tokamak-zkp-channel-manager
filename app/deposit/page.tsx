'use client';

import { useState } from 'react';
import { useAccount, useContractRead } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Layout } from '@/components/Layout';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import { getTokenSymbol } from '@/lib/tokenUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, ArrowRight, Users, Clock } from 'lucide-react';
import { DepositModal } from '@/components/DepositModal';

// Token info now handled by centralized getTokenSymbol function

const CHANNEL_STATES = {
  0: { label: 'None', color: 'gray' },
  1: { label: 'Initialized', color: 'blue' },
  2: { label: 'Open', color: 'green' },
  3: { label: 'Active', color: 'yellow' },
  4: { label: 'Closing', color: 'orange' },
  5: { label: 'Closed', color: 'red' },
};

function ChannelCard({ channelId, onDepositClick }: { channelId: number; onDepositClick: (channelId: number, firstToken: string) => void }) {
  const { data: channelState } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelState',
    args: [BigInt(channelId)],
  });

  const { data: allowedTokens } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelAllowedTokens',
    args: [BigInt(channelId)],
  });

  const { data: participants } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [BigInt(channelId)],
  });

  const { data: leader } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelLeader',
    args: [BigInt(channelId)],
  });

  const state = channelState as number | undefined;
  const stateInfo = state !== undefined ? CHANNEL_STATES[state as keyof typeof CHANNEL_STATES] || CHANNEL_STATES[0] : CHANNEL_STATES[0];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Channel #{channelId}</CardTitle>
          <Badge 
            variant={stateInfo.color as any}
            className="text-xs"
          >
            {stateInfo.label}
          </Badge>
        </div>
        <CardDescription>
          Deposit tokens into this channel to enable bridging operations
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="space-y-3">
          {/* Allowed Tokens */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed Tokens</h4>
            <div className="flex flex-wrap gap-2">
              {allowedTokens?.map((token: string) => {
                const tokenSymbol = getTokenSymbol(token);
                return (
                  <Badge key={token} variant="outline" className="text-xs">
                    {tokenSymbol}
                  </Badge>
                );
              }) || (
                <Badge variant="outline" className="text-xs text-gray-500">
                  Loading...
                </Badge>
              )}
            </div>
          </div>

          {/* Channel Info */}
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{participants?.length || 0} participants</span>
            </div>
            {leader && (
              <div className="text-xs">
                <span className="font-medium">Leader:</span> {leader.slice(0, 6)}...{leader.slice(-4)}
              </div>
            )}
          </div>

          {/* Deposit Button */}
          <Button 
            className="w-full mt-4" 
            disabled={state !== 1} // Only allow deposits in Initialized state
            onClick={() => {
              if (state === 1 && allowedTokens && allowedTokens.length > 0) {
                onDepositClick(channelId, allowedTokens[0]);
              }
            }}
          >
            <Coins className="h-4 w-4 mr-2" />
            {state === 1 ? 'Freeze State' : 'Channel Not Ready'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DepositPage() {
  const { isConnected } = useAccount();
  const { hasChannels, leadingChannels, isParticipant, participatingChannels, totalChannels, isLoading } = useUserRolesDynamic();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<number>(0);
  const [selectedToken, setSelectedToken] = useState<string>('');
  
  // Show channels where user is either leader OR participant
  const allUserChannels = [...leadingChannels, ...participatingChannels.filter(id => !leadingChannels.includes(id))];

  // Debug the detection - add early logging

  const handleDepositClick = (channelId: number, firstToken: string) => {
    setSelectedChannelId(channelId);
    setSelectedToken(firstToken);
    setDepositModalOpen(true);
  };


  if (!isConnected) {
    return (
      <Layout title="Freeze State" showFooter={false}>
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

  if (isLoading) {
    return (
      <Layout title="Freeze State">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading your channels...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if ((!hasChannels && !isParticipant) || allUserChannels.length === 0) {
    return (
      <Layout title="Freeze State">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Coins className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">No Channels Found</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                You don't have any channels yet. Create a channel first to start depositing tokens.
              </p>
              <Button asChild>
                <a href="/create-channel">
                  <Coins className="h-4 w-4 mr-2" />
                  Create Channel
                </a>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Freeze State">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Freeze State</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Deposit tokens into channels where you're a leader or participant
          </p>
          <div className="mt-4 flex gap-4 text-sm">
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
              {leadingChannels.length} channels as leader
            </span>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
              {participatingChannels.length} channels as participant
            </span>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-full">
              {totalChannels} total found
            </span>
          </div>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allUserChannels.map((channelId) => (
            <ChannelCard key={channelId} channelId={channelId} onDepositClick={handleDepositClick} />
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Important Notes
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <li>• Only channels in "Initialized" state accept deposits</li>
            <li>• You can only deposit tokens that are allowed in each channel</li>
            <li>• Make sure you have sufficient token balance and approval</li>
            <li>• Deposits are used for cross-chain bridging operations</li>
            <li>• You can withdraw unused tokens after channel operations</li>
          </ul>
        </div>

        {/* Deposit Modal */}
        <DepositModal
          isOpen={depositModalOpen}
          onClose={() => setDepositModalOpen(false)}
          channelId={BigInt(selectedChannelId)}
          targetContract={selectedToken}
          onSuccess={() => {
            // Optionally refresh data or show success message
          }}
        />
      </div>
    </Layout>
  );
}