'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Layout } from '@/components/Layout';
import { ProofCard, ProofData } from '@/components/ProofCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, CheckCircle2, Clock, XCircle, Activity, Users, Coins, Plus, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

// Participant Balance Type
interface ParticipantBalance {
  address: string;
  balances: {
    token: string;
    amount: string;
    symbol: string;
  }[];
}

// Mock data for demonstration
const mockProofs: ProofData[] = [
  {
    id: 1,
    status: 'verified',
    timestamp: Date.now() - 3600000,
    submitter: '0x1234567890123456789012345678901234567890',
    channelId: 1
  },
  {
    id: 2,
    status: 'verified',
    timestamp: Date.now() - 7200000,
    submitter: '0x9876543210987654321098765432109876543210',
    channelId: 1
  },
  {
    id: 3,
    status: 'pending',
    timestamp: Date.now() - 1800000,
    submitter: '0x1234567890123456789012345678901234567890',
    channelId: 2
  },
  {
    id: 4,
    status: 'rejected',
    timestamp: Date.now() - 10800000,
    submitter: '0xabcdef1234567890abcdef1234567890abcdef12',
    channelId: 2
  },
  {
    id: 5,
    status: 'pending',
    timestamp: Date.now() - 900000,
    submitter: '0x1234567890123456789012345678901234567890',
    channelId: 3
  },
  {
    id: 6,
    status: 'verified',
    timestamp: Date.now() - 14400000,
    submitter: '0x9876543210987654321098765432109876543210',
    channelId: 3
  }
];

// Mock participant balances (current state) - Extended for demo
const mockParticipantBalances: ParticipantBalance[] = [
  {
    address: '0x1234567890123456789012345678901234567890',
    balances: [
      { token: 'ETH', amount: '2.5', symbol: 'ETH' },
      { token: 'WTON', amount: '1500.25', symbol: 'WTON' },
      { token: 'USDT', amount: '5000.00', symbol: 'USDT' }
    ]
  },
  {
    address: '0x9876543210987654321098765432109876543210',
    balances: [
      { token: 'ETH', amount: '1.8', symbol: 'ETH' },
      { token: 'WTON', amount: '2200.50', symbol: 'WTON' },
      { token: 'USDT', amount: '3500.00', symbol: 'USDT' }
    ]
  },
  {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    balances: [
      { token: 'ETH', amount: '3.2', symbol: 'ETH' },
      { token: 'WTON', amount: '1800.75', symbol: 'WTON' },
      { token: 'USDT', amount: '4200.50', symbol: 'USDT' }
    ]
  },
  {
    address: '0x2222222222222222222222222222222222222222',
    balances: [
      { token: 'ETH', amount: '0.8', symbol: 'ETH' },
      { token: 'WTON', amount: '950.00', symbol: 'WTON' },
      { token: 'USDT', amount: '2100.00', symbol: 'USDT' }
    ]
  },
  {
    address: '0x3333333333333333333333333333333333333333',
    balances: [
      { token: 'ETH', amount: '1.2', symbol: 'ETH' },
      { token: 'WTON', amount: '1100.50', symbol: 'WTON' },
      { token: 'USDT', amount: '3200.00', symbol: 'USDT' }
    ]
  },
  {
    address: '0x4444444444444444444444444444444444444444',
    balances: [
      { token: 'ETH', amount: '2.1', symbol: 'ETH' },
      { token: 'WTON', amount: '1750.25', symbol: 'WTON' },
      { token: 'USDT', amount: '4500.00', symbol: 'USDT' }
    ]
  }
];

export default function StateExplorerPage() {
  const { isConnected } = useAccount();
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [isBalancesExpanded, setIsBalancesExpanded] = useState(false);
  const VISIBLE_PARTICIPANTS_COLLAPSED = 3; // Number of participants to show when collapsed

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

  return (
    <Layout>
      <div className="p-4 pb-20">
        <div className="max-w-7xl w-full mx-auto">
          {/* Header Section - Dashboard Style */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-4 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-[#4fc3f7] p-2 rounded">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">State Explorer</h2>
                </div>
              </div>
              {/* Create Transaction Button */}
              <button
                onClick={() => {
                  // TODO: Connect to desktop app
                  window.alert('This will open the desktop app to create a new transaction');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-all hover:shadow-lg hover:shadow-green-500/30 font-medium"
              >
                <Plus className="w-4 h-4" />
                Create Transaction
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <p className="text-gray-300 text-sm">
              Track and explore state transitions and proof submissions
            </p>
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
                  <p className="text-xs text-gray-400">{mockParticipantBalances.length} participants</p>
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
                  <span className="text-gray-400">
                    <span className="text-white font-medium">
                      {mockParticipantBalances.reduce((sum, p) => 
                        sum + parseFloat(p.balances.find(b => b.symbol === 'WTON')?.amount || '0'), 0
                      ).toFixed(2)} WTON
                    </span>
                  </span>
                  <span className="text-gray-400">
                    <span className="text-white font-medium">
                      {mockParticipantBalances.reduce((sum, p) => 
                        sum + parseFloat(p.balances.find(b => b.symbol === 'USDT')?.amount || '0'), 0
                      ).toFixed(2)} USDT
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
                  {mockParticipantBalances
                    .slice(0, isBalancesExpanded ? undefined : VISIBLE_PARTICIPANTS_COLLAPSED)
                    .map((participant, index) => (
                    <div
                      key={participant.address}
                      className="bg-[#0a1930]/50 border border-[#4fc3f7]/20 p-3 hover:border-[#4fc3f7]/50 transition-all rounded"
                    >
                      {/* Compact Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-[#4fc3f7] px-1.5 py-0.5 rounded text-white font-bold text-[10px]">
                          #{index + 1}
                        </span>
                        <span className="font-mono text-xs text-[#4fc3f7] truncate flex-1">
                          {participant.address.slice(0, 6)}...{participant.address.slice(-4)}
                        </span>
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

                {/* Show More/Less Button (if many participants) */}
                {mockParticipantBalances.length > VISIBLE_PARTICIPANTS_COLLAPSED && (
                  <div className="flex justify-center mt-3">
                    <div className="text-xs text-gray-400">
                      Showing all {mockParticipantBalances.length} participants
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview when collapsed - show first few participants inline */}
            {!isBalancesExpanded && (
              <div className="px-4 pb-3 flex flex-wrap gap-2 text-xs">
                {mockParticipantBalances.slice(0, 4).map((participant, index) => (
                  <div
                    key={participant.address}
                    className="flex items-center gap-1.5 bg-[#0a1930]/50 border border-[#4fc3f7]/10 px-2 py-1 rounded"
                  >
                    <span className="bg-[#4fc3f7]/80 px-1 rounded text-white font-bold text-[9px]">
                      #{index + 1}
                    </span>
                    <span className="font-mono text-[#4fc3f7]/80 text-[10px]">
                      {participant.address.slice(0, 4)}...{participant.address.slice(-3)}
                    </span>
                    <span className="text-gray-400">
                      {participant.balances.find(b => b.symbol === 'ETH')?.amount} ETH
                    </span>
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
    </Layout>
  );
}
