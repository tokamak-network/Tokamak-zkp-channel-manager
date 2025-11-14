'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';
import { Search, BarChart3, Activity, FileText, Rocket, Wrench, ShieldOff, Clock } from 'lucide-react';

export default function ChannelExplorerPage() {
  const { address, isConnected } = useAccount();
  const { hasChannels, isParticipant, isLoading } = useUserRolesDynamic();

  if (!isConnected) {
    return (
      <Layout 
        title="Channel Explorer"
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Connect Your Wallet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You need to connect your wallet to explore channels
            </p>
            <ConnectButton />
          </div>
        </div>
      </Layout>
    );
  }

  // Show loading state while checking user roles
  if (isLoading) {
    return (
      <Layout 
        title="Channel Explorer"
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="h-12 w-12 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-[#4fc3f7] animate-pulse" />
            </div>
            <p className="text-gray-300">
              Checking your channel access...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if user has access to channels (either as leader or participant)
  if (!hasChannels && !isParticipant) {
    return (
      <Layout 
        title="Channel Explorer"
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="h-16 w-16 bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <ShieldOff className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Access Restricted
            </h3>
            <p className="text-gray-300 mb-4 max-w-md mx-auto">
              The Channel Explorer is only available to users who are involved in bridge channels 
              as either leaders or participants.
            </p>
            <p className="text-sm text-gray-400">
              Create a channel or get invited to participate to access this feature.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Channel Explorer"
    >
      <div className="px-4 py-8 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#4fc3f7] flex items-center justify-center shadow-lg shadow-[#4fc3f7]/30">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                Channel Explorer
              </h1>
              <p className="text-gray-300 mt-1">
                Explore and monitor all bridge channels and their activity
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-[#4fc3f7]/10 border-[#4fc3f7]/50 text-[#4fc3f7]">
            Coming Soon
          </Badge>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Channel Overview Card */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[#4fc3f7]" />
              <h2 className="text-lg font-semibold text-white">
                Channel Overview
              </h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-[#4fc3f7]/30">
                <span className="text-gray-300">Total Channels</span>
                <span className="font-medium text-white">-</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#4fc3f7]/30">
                <span className="text-gray-300">Active Channels</span>
                <span className="font-medium text-white">-</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#4fc3f7]/30">
                <span className="text-gray-300">Your Participation</span>
                <span className="font-medium text-white">-</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-300">Total Volume</span>
                <span className="font-medium text-white">-</span>
              </div>
            </div>
          </div>

          {/* Channel Activity Card */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-[#4fc3f7]" />
              <h2 className="text-lg font-semibold text-white">
                Recent Activity
              </h2>
            </div>
            <div className="space-y-3">
              <div className="text-center py-8">
                <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-[#4fc3f7]" />
                </div>
                <p className="text-gray-300">
                  Channel activity will be displayed here
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Channel List */}
        <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#4fc3f7]" />
            <h2 className="text-lg font-semibold text-white">
              All Channels
            </h2>
          </div>
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-[#4fc3f7]" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Channel Explorer Coming Soon
            </h3>
            <p className="text-gray-300 max-w-md mx-auto">
              This feature will show detailed information about all bridge channels, 
              including their status, participants, transaction history, and real-time activity.
            </p>
          </div>
        </div>

        {/* Planned Features */}
        <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-[#4fc3f7]" />
            <h2 className="text-lg font-semibold text-white">
              Planned Features
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-white">Channel Discovery</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Browse all available channels</li>
                <li>• Filter by status and activity</li>
                <li>• Search channels by participants</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-white">Activity Monitoring</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Real-time transaction updates</li>
                <li>• Channel state changes</li>
                <li>• Participant activity logs</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-white">Analytics</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Volume and usage statistics</li>
                <li>• Performance metrics</li>
                <li>• Historical data visualization</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-white">Integration</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• DKG session coordination</li>
                <li>• Cross-channel analytics</li>
                <li>• Export and reporting tools</li>
              </ul>
            </div>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
}