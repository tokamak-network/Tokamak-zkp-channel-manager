'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';

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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
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
            <div className="text-6xl mb-4">🚫</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Access Restricted
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
              The Channel Explorer is only available to users who are involved in bridge channels 
              as either leaders or participants.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Channel Explorer
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Explore and monitor all bridge channels and their activity
            </p>
          </div>
          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            Coming Soon
          </Badge>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Channel Overview Card */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📊 Channel Overview
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Total Channels</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">-</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Active Channels</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">-</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Your Participation</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">-</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Total Volume</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">-</span>
              </div>
            </div>
          </Card>

          {/* Channel Activity Card */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              🔄 Recent Activity
            </h2>
            <div className="space-y-3">
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-500 dark:text-gray-400">
                  Channel activity will be displayed here
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Channel List */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            📋 All Channels
          </h2>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Channel Explorer Coming Soon
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              This feature will show detailed information about all bridge channels, 
              including their status, participants, transaction history, and real-time activity.
            </p>
          </div>
        </Card>

        {/* Planned Features */}
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            🛠️ Planned Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Channel Discovery</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Browse all available channels</li>
                <li>• Filter by status and activity</li>
                <li>• Search channels by participants</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Activity Monitoring</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Real-time transaction updates</li>
                <li>• Channel state changes</li>
                <li>• Participant activity logs</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Analytics</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Volume and usage statistics</li>
                <li>• Performance metrics</li>
                <li>• Historical data visualization</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Integration</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• DKG session coordination</li>
                <li>• Cross-channel analytics</li>
                <li>• Export and reporting tools</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}