'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Layout } from '@/components/Layout';
import { ProofCard, ProofData } from '@/components/ProofCard';
import { TransactionBundleModal } from '@/components/TransactionBundleModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI,
  TON_TOKEN_ADDRESS,
  WTON_TOKEN_ADDRESS,
  ETH_TOKEN_ADDRESS
} from '@/lib/contracts';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Activity, 
  Users, 
  Coins, 
  Plus, 
  ChevronDown, 
  ChevronUp,
  ArrowLeft,
  Layers,
  Shield,
  Hash,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { formatEther } from 'viem';

// Types
interface ParticipantBalance {
  address: string;
  balances: {
    token: string;
    amount: string;
    symbol: string;
  }[];
}

interface OnChainChannel {
  id: number;
  state: number; // 0: Pending, 1: Active, 2: Closed
  participantCount: number;
  participants: string[];
  leader: string;
  isLeader: boolean;
  allowedTokens: string[];
  hasPublicKey: boolean;
}

// Channel state enum - matches contract: None(0), Initialized(1), Open(2), Active(3), Closing(4), Closed(5)
const ChannelState = {
  0: 'none',
  1: 'pending',    // Initialized - awaiting deposits/setup
  2: 'active',     // Open - ready for operations  
  3: 'active',     // Active - in use
  4: 'closing',    // Closing - being finalized
  5: 'closed'      // Closed - finalized
} as const;

// Mock proofs data - In production, fetch from Firebase
const getMockProofsForChannel = (channelId: number): ProofData[] => {
  return [
    {
      id: 1,
      status: 'verified',
      timestamp: Date.now() - 3600000,
      submitter: '0x1234567890123456789012345678901234567890',
      channelId
    },
    {
      id: 2,
      status: 'verified',
      timestamp: Date.now() - 7200000,
      submitter: '0x9876543210987654321098765432109876543210',
      channelId
    },
    {
      id: 3,
      status: 'pending',
      timestamp: Date.now() - 1800000,
      submitter: '0x1234567890123456789012345678901234567890',
      channelId
    }
  ];
};

// Channel Selection View Component
function ChannelSelectionView({ 
  channels, 
  onSelectChannel,
  isLoading,
  onRefresh,
  error
}: { 
  channels: OnChainChannel[];
  onSelectChannel: (channel: OnChainChannel) => void;
  isLoading: boolean;
  onRefresh: () => void;
  error: string | null;
}) {
  const activeChannels = channels.filter(c => {
    const state = ChannelState[c.state as keyof typeof ChannelState];
    return state === 'active';
  });
  const pendingChannels = channels.filter(c => {
    const state = ChannelState[c.state as keyof typeof ChannelState];
    return state === 'pending';
  });
  const closedChannels = channels.filter(c => {
    const state = ChannelState[c.state as keyof typeof ChannelState];
    return state === 'closed' || state === 'closing';
  });

  return (
    <div className="p-4 pb-20">
      <div className="max-w-5xl w-full mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-6 shadow-lg shadow-[#4fc3f7]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#4fc3f7] p-2 rounded">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">State Explorer</h2>
                <p className="text-gray-400 text-sm">Select a channel to view its state</p>
              </div>
            </div>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-[#4fc3f7]/10 hover:bg-[#4fc3f7]/20 text-[#4fc3f7] rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
            <span className="ml-4 text-gray-400">Loading your channels from blockchain...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Failed to load channels</p>
              <p className="text-red-400/70 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* No Channels */}
        {!isLoading && !error && channels.length === 0 && (
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Channels Found</h3>
            <p className="text-gray-400">You are not participating in any channels.</p>
          </div>
        )}

        {/* Active Channels */}
        {!isLoading && activeChannels.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Active Channels ({activeChannels.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 text-left hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20 group"
                >
                  {/* Channel Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-semibold group-hover:text-[#4fc3f7] transition-colors font-mono">
                          Channel #{channel.id}
                        </h4>
                        {channel.isLeader && (
                          <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-medium">
                            LEADER
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-400 text-xs">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                      Active
                    </div>
                  </div>

                  {/* Channel Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-[#0a1930]/50 p-2 rounded">
                      <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Participants
                      </div>
                      <div className="text-white font-medium text-sm">
                        {channel.participantCount}
                      </div>
                    </div>
                    <div className="bg-[#0a1930]/50 p-2 rounded">
                      <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Public Key
                      </div>
                      <div className="text-white font-medium text-sm">
                        {channel.hasPublicKey ? '✓ Set' : '✗ Not set'}
                      </div>
                    </div>
                  </div>

                  {/* Tokens */}
                  <div className="text-xs text-gray-500">
                    {channel.allowedTokens.length} allowed tokens
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pending Channels */}
        {!isLoading && pendingChannels.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              Pending Channels ({pendingChannels.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-yellow-500/30 p-5 text-left hover:border-yellow-500/50 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-semibold font-mono">Channel #{channel.id}</h4>
                      {channel.isLeader && (
                        <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-medium">
                          LEADER
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-yellow-400 text-xs">
                      <Clock className="w-3 h-3" />
                      Pending
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {channel.participantCount} participants • Awaiting initialization
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Closed Channels */}
        {!isLoading && closedChannels.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full" />
              Closed Channels ({closedChannels.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {closedChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-gray-600/30 p-5 text-left hover:border-gray-500/50 transition-all opacity-60 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-gray-400 font-semibold font-mono">Channel #{channel.id}</h4>
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <XCircle className="w-3 h-3" />
                      Closed
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {channel.participantCount} participants
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// State Explorer Detail View Component
function StateExplorerDetailView({
  channel,
  onBack,
  userAddress
}: {
  channel: OnChainChannel;
  onBack: () => void;
  userAddress: string;
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [isBalancesExpanded, setIsBalancesExpanded] = useState(false);
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);
  const VISIBLE_PARTICIPANTS_COLLAPSED = 3;

  const mockProofs = getMockProofsForChannel(channel.id);
  
  // Create participant balances from on-chain data (mock balances for now)
  const mockParticipantBalances: ParticipantBalance[] = channel.participants.map((addr, idx) => ({
    address: addr,
    balances: [
      { token: 'ETH', amount: (Math.random() * 5).toFixed(2), symbol: 'ETH' },
      { token: 'WTON', amount: (Math.random() * 3000).toFixed(2), symbol: 'WTON' },
      { token: 'TON', amount: (Math.random() * 5000).toFixed(2), symbol: 'TON' }
    ]
  }));

  const filteredProofs = mockProofs.filter(proof => {
    if (filter === 'all') return true;
    return proof.status === filter;
  });

  const stats = {
    total: mockProofs.length,
    verified: mockProofs.filter(p => p.status === 'verified').length,
    pending: mockProofs.filter(p => p.status === 'pending').length,
    rejected: mockProofs.filter(p => p.status === 'rejected').length
  };

  const channelStateLabel = ChannelState[channel.state as keyof typeof ChannelState] || 'unknown';

  return (
    <>
      <div className="p-4 pb-20">
        <div className="max-w-7xl w-full mx-auto">
          {/* Header Section with Back Button */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-4 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Back Button */}
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-[#4fc3f7]/10 rounded transition-colors text-gray-400 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="bg-[#4fc3f7] p-2 rounded">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-white font-mono">Channel #{channel.id}</h2>
                    {channel.isLeader && (
                      <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded font-medium">
                        LEADER
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      channelStateLabel === 'active' ? 'bg-green-500/20 text-green-400' :
                      channelStateLabel === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {channelStateLabel.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              {/* Create Transaction Button */}
              <button
                onClick={() => setIsBundleModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-all hover:shadow-lg hover:shadow-green-500/30 font-medium"
              >
                <Plus className="w-4 h-4" />
                Create Transaction
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {channel.participantCount} participants
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                Public Key: {channel.hasPublicKey ? 'Set' : 'Not set'}
              </span>
              <span className="flex items-center gap-1">
                <Coins className="w-4 h-4" />
                {channel.allowedTokens.length} tokens
              </span>
            </div>
          </div>

          {/* Compact Participant Balances Section - Collapsible */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/20 mb-4 overflow-hidden">
            {/* Header with Toggle */}
            <button
              onClick={() => setIsBalancesExpanded(!isBalancesExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-[#4fc3f7]/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#4fc3f7] p-1.5 rounded">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white">Current State - Participant Balances</h3>
                  <p className="text-xs text-gray-400">{channel.participantCount} participants</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Quick Summary Stats */}
                <div className="hidden md:flex items-center gap-4 text-xs">
                  <span className="text-gray-400">
                    Total: <span className="text-white font-medium">
                      {mockParticipantBalances.reduce((sum, p) => 
                        sum + parseFloat(p.balances.find(b => b.symbol === 'ETH')?.amount || '0'), 0
                      ).toFixed(2)} ETH
                    </span>
                  </span>
                </div>
                {/* Expand/Collapse Icon */}
                <div className="text-[#4fc3f7]">
                  {isBalancesExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>
            </button>

            {/* Expandable Content */}
            <div
              className={`transition-all duration-300 ease-in-out ${
                isBalancesExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
              } overflow-hidden`}
            >
              <div className="px-4 pb-4">
                {/* Compact Participant Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {mockParticipantBalances.map((participant, index) => (
                    <div
                      key={participant.address}
                      className={`bg-[#0a1930]/50 border p-3 hover:border-[#4fc3f7]/50 transition-all rounded ${
                        participant.address.toLowerCase() === userAddress?.toLowerCase() 
                          ? 'border-[#4fc3f7]/50 bg-[#4fc3f7]/5' 
                          : 'border-[#4fc3f7]/20'
                      }`}
                    >
                      {/* Compact Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-[#4fc3f7] px-1.5 py-0.5 rounded text-white font-bold text-[10px]">
                          #{index + 1}
                        </span>
                        <span className="font-mono text-xs text-[#4fc3f7] truncate flex-1">
                          {participant.address.slice(0, 6)}...{participant.address.slice(-4)}
                        </span>
                        {participant.address.toLowerCase() === userAddress?.toLowerCase() && (
                          <span className="text-[9px] text-[#4fc3f7] bg-[#4fc3f7]/20 px-1 rounded">YOU</span>
                        )}
                        {participant.address.toLowerCase() === channel.leader.toLowerCase() && (
                          <span className="text-[9px] text-amber-400 bg-amber-500/20 px-1 rounded">LEADER</span>
                        )}
                      </div>
                      
                      {/* Compact Balances - Horizontal */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {participant.balances.map((balance) => (
                          <div
                            key={balance.token}
                            className="flex items-center gap-1 bg-[#1a2347]/50 px-2 py-1 rounded"
                          >
                            <Coins className="w-3 h-3 text-[#4fc3f7]" />
                            <span className="font-medium text-white">{balance.amount}</span>
                            <span className="text-gray-400">{balance.symbol}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview when collapsed - show first few participants inline */}
            {!isBalancesExpanded && (
              <div className="px-4 pb-3 flex flex-wrap gap-2 text-xs">
                {mockParticipantBalances.slice(0, 4).map((participant, index) => (
                  <div
                    key={participant.address}
                    className={`flex items-center gap-1.5 bg-[#0a1930]/50 border px-2 py-1 rounded ${
                      participant.address.toLowerCase() === userAddress?.toLowerCase() 
                        ? 'border-[#4fc3f7]/30' 
                        : 'border-[#4fc3f7]/10'
                    }`}
                  >
                    <span className="bg-[#4fc3f7]/80 px-1 rounded text-white font-bold text-[9px]">
                      #{index + 1}
                    </span>
                    <span className="font-mono text-[#4fc3f7]/80 text-[10px]">
                      {participant.address.slice(0, 4)}...{participant.address.slice(-3)}
                    </span>
                    {participant.address.toLowerCase() === userAddress?.toLowerCase() && (
                      <span className="text-[8px] text-[#4fc3f7]">(you)</span>
                    )}
                  </div>
                ))}
                {mockParticipantBalances.length > 4 && (
                  <div className="flex items-center text-gray-400">
                    +{mockParticipantBalances.length - 4} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Content Area - Dashboard Style Border */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20 mb-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Total Proofs */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">Total Proofs</span>
                  <div className="bg-[#4fc3f7] p-2 rounded">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">{stats.total}</div>
              </div>

              {/* Verified */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">Verified</span>
                  <div className="bg-green-500 p-2 rounded">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-green-400">{stats.verified}</div>
              </div>

              {/* Pending */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">Pending</span>
                  <div className="bg-yellow-500 p-2 rounded">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
              </div>

              {/* Rejected */}
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">Rejected</span>
                  <div className="bg-red-500 p-2 rounded">
                    <XCircle className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-red-400">{stats.rejected}</div>
              </div>
            </div>

            {/* Filter */}
            <div className="mb-6">
              <Select
                value={filter}
                onValueChange={(value: any) => setFilter(value)}
              >
                <SelectTrigger className="w-48 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2347] border-[#4fc3f7]/30 text-white">
                  <SelectItem value="all">All Proofs</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Proof Cards Grid */}
            {filteredProofs.length === 0 ? (
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/50 p-12 text-center">
                <Activity className="h-12 w-12 text-[#4fc3f7] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Proofs Found</h3>
                <p className="text-gray-400">
                  No proofs match the selected filter
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProofs.map((proof) => (
                  <ProofCard key={proof.id} proof={proof} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Bundle Modal */}
      <TransactionBundleModal
        isOpen={isBundleModalOpen}
        onClose={() => setIsBundleModalOpen(false)}
        defaultChannelId={channel.id.toString()}
      />
    </>
  );
}

// Main Page Component
export default function StateExplorerPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [selectedChannel, setSelectedChannel] = useState<OnChainChannel | null>(null);
  const [channels, setChannels] = useState<OnChainChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's channels from blockchain
  const fetchChannels = async () => {
    if (!address || !publicClient) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Get the next channel ID to know how many channels exist
      const nextChannelId = await publicClient.readContract({
        address: ROLLUP_BRIDGE_CORE_ADDRESS,
        abi: ROLLUP_BRIDGE_CORE_ABI,
        functionName: 'nextChannelId',
      }) as bigint;

      const totalChannels = Number(nextChannelId);
      const userChannels: OnChainChannel[] = [];

      // Check each channel if user is a participant
      for (let i = 1; i < totalChannels; i++) {
        try {
          const isParticipant = await publicClient.readContract({
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: 'isChannelParticipant',
            args: [BigInt(i), address],
          }) as boolean;

          if (isParticipant) {
            // Fetch channel details
            const [channelInfo, participants, leader, publicKey, allowedTokens] = await Promise.all([
              publicClient.readContract({
                address: ROLLUP_BRIDGE_CORE_ADDRESS,
                abi: ROLLUP_BRIDGE_CORE_ABI,
                functionName: 'getChannelInfo',
                args: [BigInt(i)],
              }) as Promise<[string[], number, bigint, string]>,
              publicClient.readContract({
                address: ROLLUP_BRIDGE_CORE_ADDRESS,
                abi: ROLLUP_BRIDGE_CORE_ABI,
                functionName: 'getChannelParticipants',
                args: [BigInt(i)],
              }) as Promise<string[]>,
              publicClient.readContract({
                address: ROLLUP_BRIDGE_CORE_ADDRESS,
                abi: ROLLUP_BRIDGE_CORE_ABI,
                functionName: 'getChannelLeader',
                args: [BigInt(i)],
              }) as Promise<string>,
              publicClient.readContract({
                address: ROLLUP_BRIDGE_CORE_ADDRESS,
                abi: ROLLUP_BRIDGE_CORE_ABI,
                functionName: 'getChannelPublicKey',
                args: [BigInt(i)],
              }) as Promise<[bigint, bigint]>,
              publicClient.readContract({
                address: ROLLUP_BRIDGE_CORE_ADDRESS,
                abi: ROLLUP_BRIDGE_CORE_ABI,
                functionName: 'getChannelAllowedTokens',
                args: [BigInt(i)],
              }) as Promise<string[]>,
            ]);

            userChannels.push({
              id: i,
              state: channelInfo[1],
              participantCount: Number(channelInfo[2]),
              participants: participants,
              leader: leader,
              isLeader: leader.toLowerCase() === address.toLowerCase(),
              allowedTokens: allowedTokens,
              hasPublicKey: publicKey[0] !== BigInt(0) || publicKey[1] !== BigInt(0),
            });
          }
        } catch (err) {
          console.warn(`Error fetching channel ${i}:`, err);
          // Continue to next channel
        }
      }

      setChannels(userChannels);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch channels');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch channels on mount and when address changes
  useEffect(() => {
    if (isConnected && address) {
      fetchChannels();
    } else {
      setChannels([]);
      setIsLoading(false);
    }
  }, [isConnected, address, publicClient]);

  const handleSelectChannel = (channel: OnChainChannel) => {
    setSelectedChannel(channel);
  };

  const handleBack = () => {
    setSelectedChannel(null);
  };

  return (
    <Layout>
      {selectedChannel ? (
        <StateExplorerDetailView 
          channel={selectedChannel} 
          onBack={handleBack}
          userAddress={address || ''}
        />
      ) : (
        <ChannelSelectionView 
          channels={channels} 
          onSelectChannel={handleSelectChannel}
          isLoading={isLoading}
          onRefresh={fetchChannels}
          error={error}
        />
      )}
    </Layout>
  );
}
