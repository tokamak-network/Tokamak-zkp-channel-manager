'use client';

import { useState } from 'react';
import { useContractRead } from 'wagmi';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';
import { Users, UserCheck, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { shortenAddress } from '@/lib/utils';

interface ChannelParticipantInfoProps {
  channelId: bigint;
  className?: string;
}

export function ChannelParticipantInfo({ channelId, className = '' }: ChannelParticipantInfoProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Get whitelisted users (set during channel creation)
  const { data: whitelistedUsers } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelWhitelisted',
    args: [channelId],
  });

  // Get actual participants (users who have deposited)
  const { data: participants } = useContractRead({
    address: ROLLUP_BRIDGE_CORE_ADDRESS,
    abi: ROLLUP_BRIDGE_CORE_ABI,
    functionName: 'getChannelParticipants',
    args: [channelId],
  });

  const whitelistedAddresses = whitelistedUsers as readonly string[] || [];
  const participantAddresses = participants as readonly string[] || [];

  // Users who are whitelisted but haven't deposited yet
  const pendingUsers = whitelistedAddresses.filter(
    addr => !participantAddresses.includes(addr)
  );

  return (
    <div className={`border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Summary */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="font-medium text-gray-900">Channel Participants</h3>
            <p className="text-sm text-gray-600">
              {participantAddresses.length} active, {pendingUsers.length} pending
            </p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          {showDetails ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Detailed breakdown */}
      {showDetails && (
        <div className="mt-4 space-y-4">
          {/* Active participants */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              <h4 className="font-medium text-green-700">
                Active Participants ({participantAddresses.length})
              </h4>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Users who have deposited tokens into the channel
            </p>
            {participantAddresses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {participantAddresses.map((address, index) => (
                  <div 
                    key={address} 
                    className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-mono">{shortenAddress(address)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No participants have deposited yet</p>
            )}
          </div>

          {/* Pending users */}
          {pendingUsers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-4 w-4 text-yellow-500" />
                <h4 className="font-medium text-yellow-700">
                  Pending Deposits ({pendingUsers.length})
                </h4>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Whitelisted users who haven't deposited yet
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pendingUsers.map((address, index) => (
                  <div 
                    key={address} 
                    className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm"
                  >
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="font-mono">{shortenAddress(address)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status summary */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              <strong>Total whitelisted:</strong> {whitelistedAddresses.length} •{' '}
              <strong>Deposited:</strong> {participantAddresses.length} •{' '}
              <strong>Pending:</strong> {pendingUsers.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}