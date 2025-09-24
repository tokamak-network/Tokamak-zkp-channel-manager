'use client';

import { useState, useEffect } from 'react';
import { useContractEvent } from 'wagmi';
import { ROLLUP_BRIDGE_ABI, ROLLUP_BRIDGE_ADDRESS } from '@/lib/contracts';

interface ChannelCreatedBannerProps {
  className?: string;
}

export function ChannelCreatedBanner({ className }: ChannelCreatedBannerProps) {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    channelId: string;
    targetContract: string;
    timestamp: number;
  }>>([]);

  // Listen for ChannelOpened events
  useContractEvent({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    eventName: 'ChannelOpened',
    listener: (logs) => {
      logs.forEach((log) => {
        const { channelId, targetContract } = log.args as {
          channelId: bigint;
          targetContract: string;
        };
        
        const notification = {
          id: `${channelId}-${Date.now()}`,
          channelId: channelId.toString(),
          targetContract,
          timestamp: Date.now(),
        };
        
        setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep only 5 most recent
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 10000);
      });
    },
  });

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className || ''}`}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-green-500 text-white rounded-lg shadow-lg p-4 max-w-sm animate-in slide-in-from-right-full duration-300"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-lg">🎉</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  New Channel Created!
                </p>
                <p className="text-xs text-green-100 mt-1">
                  Channel #{notification.channelId}
                </p>
                <p className="text-xs text-green-100 truncate">
                  Target: {notification.targetContract.slice(0, 6)}...{notification.targetContract.slice(-4)}
                </p>
              </div>
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="flex-shrink-0 ml-2 text-green-200 hover:text-white transition-colors"
              aria-label="Dismiss notification"
            >
              <span className="text-lg">×</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}