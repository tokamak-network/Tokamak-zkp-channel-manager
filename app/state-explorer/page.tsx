'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Layout } from '@/components/Layout';
import { ProofCard, ProofData } from '@/components/ProofCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, CheckCircle2, Clock, XCircle, Activity, Users, Coins, Plus, ExternalLink } from 'lucide-react';

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

// Mock participant balances (current state)
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
  }
];

export default function StateExplorerPage() {
  const { isConnected } = useAccount();
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

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
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-8 shadow-lg shadow-[#4fc3f7]/20">
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

          {/* Participant Balances Section */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-[#4fc3f7] p-2 rounded">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Current State - Participant Balances</h3>
                <p className="text-sm text-gray-400">Token balances for each participant based on latest verified state</p>
              </div>
            </div>

            <div className="space-y-4">
              {mockParticipantBalances.map((participant, index) => (
                <div
                  key={participant.address}
                  className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all"
                >
                  {/* Participant Header */}
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#4fc3f7]/20">
                    <div className="bg-[#4fc3f7] px-3 py-1 rounded text-white font-bold text-sm">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">Participant Address</div>
                      <div className="font-mono text-sm text-[#4fc3f7]">
                        {participant.address}
                      </div>
                    </div>
                  </div>

                  {/* Token Balances */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {participant.balances.map((balance) => (
                      <div
                        key={balance.token}
                        className="bg-[#1a2347] border border-[#4fc3f7]/20 p-4 rounded hover:border-[#4fc3f7]/50 transition-all"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Coins className="w-4 h-4 text-[#4fc3f7]" />
                          <span className="text-sm font-medium text-gray-300">{balance.symbol}</span>
                        </div>
                        <div className="text-xl font-bold text-white">
                          {balance.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="mt-6 pt-6 border-t border-[#4fc3f7]/30">
              <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-4 rounded">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Total Balances Across All Participants</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">Total ETH</div>
                    <div className="text-lg font-bold text-white">
                      {mockParticipantBalances.reduce((sum, p) => 
                        sum + parseFloat(p.balances.find(b => b.symbol === 'ETH')?.amount || '0'), 0
                      ).toFixed(2)} ETH
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">Total WTON</div>
                    <div className="text-lg font-bold text-white">
                      {mockParticipantBalances.reduce((sum, p) => 
                        sum + parseFloat(p.balances.find(b => b.symbol === 'WTON')?.amount || '0'), 0
                      ).toFixed(2)} WTON
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">Total USDT</div>
                    <div className="text-lg font-bold text-white">
                      {mockParticipantBalances.reduce((sum, p) => 
                        sum + parseFloat(p.balances.find(b => b.symbol === 'USDT')?.amount || '0'), 0
                      ).toFixed(2)} USDT
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
