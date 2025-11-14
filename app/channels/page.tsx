'use client';

import { useState, useEffect } from 'react';
import { useAccount, useContractRead } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ChannelCard } from '@/components/ChannelCard';
import { CreateChannelModal } from '@/components/CreateChannelModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ClientOnly } from '@/components/ClientOnly';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { ExtendedChannelData, ChannelUIState } from '@/lib/types';
import { sortChannels, debounce } from '@/lib/utils';
import { 
  Plus, 
  Search, 
  Filter, 
  Zap, 
  Users, 
  Coins, 
  TrendingUp,
  RefreshCw,
  AlertCircle 
} from 'lucide-react';
import Link from 'next/link';

export default function ChannelsPage() {
  const { address, isConnected } = useAccount();
  const [uiState, setUIState] = useState<ChannelUIState>({
    selectedChannel: null,
    showCreateModal: false,
    showDepositModal: false,
    showWithdrawModal: false,
    showProofModal: false,
    filter: 'all',
    sortBy: 'newest'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [channels, setChannels] = useState<ExtendedChannelData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get total channels count
  const { data: totalChannels, refetch: refetchTotalChannels } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getTotalChannels',
    watch: true
  });

  // Mock data for demonstration (in production, this would come from contract reads)
  const mockChannels: ExtendedChannelData[] = [
    {
      id: BigInt(1),
      targetContract: '0x0000000000000000000000000000000000000001',
      state: 2, // Open
      stateLabel: 'Open',
      participants: ['0x1234...', '0x5678...', '0x9abc...'],
      participantCount: BigInt(3),
      totalDeposits: BigInt('5000000000000000000'), // 5 ETH
      userDeposit: address ? BigInt('1000000000000000000') : BigInt(0), // 1 ETH
      leader: '0x1234567890123456789012345678901234567890',
      isUserLeader: address === '0x1234567890123456789012345678901234567890',
      isUserParticipant: !!address,
      openTimestamp: BigInt(Math.floor(Date.now() / 1000) - 3600), // 1 hour ago
      timeout: BigInt(86400), // 24 hours
      deadline: BigInt(Math.floor(Date.now() / 1000) + 82800), // 23 hours from now
      remainingTime: BigInt(82800),
      isExpired: false,
      isReadyToClose: false,
      initialRoot: null,
      finalRoot: null
    },
    {
      id: BigInt(2),
      targetContract: '0x0000000000000000000000000000000000000001',
      state: 1, // Initialized
      stateLabel: 'Initialized',
      participants: ['0x1234...', '0x5678...', '0x9abc...', '0xdef0...'],
      participantCount: BigInt(4),
      totalDeposits: BigInt('2500000000000000000'), // 2.5 ETH
      userDeposit: BigInt(0),
      leader: '0x9876543210987654321098765432109876543210',
      isUserLeader: false,
      isUserParticipant: false,
      openTimestamp: BigInt(Math.floor(Date.now() / 1000) - 1800), // 30 min ago
      timeout: BigInt(172800), // 48 hours
      deadline: BigInt(Math.floor(Date.now() / 1000) + 170400),
      remainingTime: BigInt(170400),
      isExpired: false,
      isReadyToClose: false,
      initialRoot: null,
      finalRoot: null
    },
    {
      id: BigInt(3),
      targetContract: '0x0000000000000000000000000000000000000001',
      state: 5, // Closed
      stateLabel: 'Closed',
      participants: ['0x1234...', '0x5678...', '0x9abc...'],
      participantCount: BigInt(3),
      totalDeposits: BigInt('10000000000000000000'), // 10 ETH
      userDeposit: address ? BigInt('3000000000000000000') : BigInt(0), // 3 ETH
      leader: '0x1234567890123456789012345678901234567890',
      isUserLeader: address === '0x1234567890123456789012345678901234567890',
      isUserParticipant: !!address,
      openTimestamp: BigInt(Math.floor(Date.now() / 1000) - 172800), // 2 days ago
      timeout: BigInt(86400),
      deadline: BigInt(Math.floor(Date.now() / 1000) - 86400),
      remainingTime: BigInt(0),
      isExpired: true,
      isReadyToClose: false,
      initialRoot: '0x1234567890123456789012345678901234567890123456789012345678901234',
      finalRoot: '0x9876543210987654321098765432109876543210987654321098765432109876'
    }
  ];

  // Filter and sort channels
  const filteredChannels = sortChannels(
    mockChannels.filter(channel => {
      // Apply filters
      switch (uiState.filter) {
        case 'my-channels':
          return channel.isUserLeader;
        case 'participating':
          return channel.isUserParticipant;
        case 'expired':
          return channel.isExpired;
        default:
          return true;
      }
    }).filter(channel => {
      // Apply search
      if (!searchTerm) return true;
      return (
        channel.id.toString().includes(searchTerm) ||
        channel.leader.toLowerCase().includes(searchTerm.toLowerCase()) ||
        channel.participants.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }),
    uiState.sortBy
  );

  const debouncedSearch = debounce((term: string) => {
    setSearchTerm(term);
  }, 300);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchTotalChannels();
      // In production, would refetch all channel data
    } finally {
      setIsRefreshing(false);
    }
  };

  const stats = {
    total: mockChannels.length,
    userChannels: mockChannels.filter(c => c.isUserLeader).length,
    participating: mockChannels.filter(c => c.isUserParticipant).length,
    totalDeposits: mockChannels.reduce((sum, c) => sum + c.totalDeposits, BigInt(0))
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen">
        {/* Header */}
        <header className="border-b border-gray-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#4fc3f7] flex items-center justify-center shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold gradient-text">Tokamak ZK Zap</h1>
                  <p className="text-sm text-gray-600">Channels</p>
                </div>
              </Link>
              <ClientOnly>
                <ConnectButton />
              </ClientOnly>
            </div>
          </div>
        </header>

        {/* Not Connected State */}
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
              <Zap className="h-12 w-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 mb-8">
              Connect your wallet to view and interact with ZK Rollup Zap channels
            </p>
            <ClientOnly>
              <ConnectButton />
            </ClientOnly>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#4fc3f7] flex items-center justify-center shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">Tokamak ZK Zap</h1>
                <p className="text-sm text-gray-600">Channels</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <ClientOnly>
                <ConnectButton />
              </ClientOnly>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Channels</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Channels</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.userChannels}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Participating</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.participating}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(Number(stats.totalDeposits) / 1e18).toFixed(1)} ETH
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by ID, address, or participant..."
              className="pl-10"
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          
          <Select
            value={uiState.filter}
            onValueChange={(value: any) => setUIState(prev => ({ ...prev, filter: value }))}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="my-channels">My Channels</SelectItem>
              <SelectItem value="participating">Participating</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={uiState.sortBy}
            onValueChange={(value: any) => setUIState(prev => ({ ...prev, sortBy: value }))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="deposits">Most Deposits</SelectItem>
              <SelectItem value="participants">Most Participants</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => setUIState(prev => ({ ...prev, showCreateModal: true }))}
            variant="gradient"
            className="whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Channel
          </Button>
        </div>

        {/* Channels Grid */}
        {filteredChannels.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Channels Found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm 
                  ? "No channels match your search criteria" 
                  : "No channels available with the selected filters"}
              </p>
              {uiState.filter === 'all' && !searchTerm && (
                <Button
                  onClick={() => setUIState(prev => ({ ...prev, showCreateModal: true }))}
                  variant="gradient"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Channel
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredChannels.map((channel) => (
              <ChannelCard
                key={channel.id.toString()}
                channel={channel}
                userAddress={address}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={uiState.showCreateModal}
        onClose={() => setUIState(prev => ({ ...prev, showCreateModal: false }))}
        onSuccess={(channelId) => {
          // Refresh channels list
          handleRefresh();
        }}
      />
    </div>
  );
}