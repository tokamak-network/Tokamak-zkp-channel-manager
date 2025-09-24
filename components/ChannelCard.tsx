'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { ExtendedChannelData } from '@/lib/types';
import { formatBalance, formatDuration, shortenAddress, formatTokenSymbol } from '@/lib/utils';
import { 
  Users, 
  Clock, 
  Coins, 
  User, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle2,
  Timer 
} from 'lucide-react';
import Link from 'next/link';

interface ChannelCardProps {
  channel: ExtendedChannelData;
  userAddress?: string;
}

export function ChannelCard({ channel, userAddress }: ChannelCardProps) {
  const tokenSymbol = formatTokenSymbol(channel.targetContract);
  const isUserChannel = userAddress && (channel.isUserLeader || channel.isUserParticipant);

  return (
    <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">#{channel.id.toString()}</span>
            </div>
            <div>
              <CardTitle className="text-lg">Channel {channel.id.toString()}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge state={channel.state} />
                {channel.isUserLeader && (
                  <Badge variant="default">Leader</Badge>
                )}
                {channel.isUserParticipant && !channel.isUserLeader && (
                  <Badge variant="secondary">Participant</Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-gray-600">Token</div>
            <div className="font-medium">{tokenSymbol}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Participants</div>
              <div className="font-medium">{channel.participantCount}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Total Deposits</div>
              <div className="font-medium">
                {formatBalance(channel.totalDeposits.toString(), tokenSymbol === 'ETH' ? 18 : 18)} {tokenSymbol}
              </div>
            </div>
          </div>
        </div>

        {/* User's Deposit */}
        {channel.isUserParticipant && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary-600" />
              <div>
                <div className="text-sm text-primary-700">Your Deposit</div>
                <div className="font-medium text-primary-900">
                  {formatBalance(channel.userDeposit.toString(), tokenSymbol === 'ETH' ? 18 : 18)} {tokenSymbol}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Time Information */}
        <div className="flex items-center gap-2">
          {channel.isExpired ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : channel.remainingTime > 0 ? (
            <Timer className="h-4 w-4 text-yellow-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          <div>
            <div className="text-sm text-gray-600">
              {channel.isExpired ? 'Expired' : 'Time Remaining'}
            </div>
            <div className="font-medium">
              {channel.isExpired ? 'Channel expired' : formatDuration(channel.remainingTime)}
            </div>
          </div>
        </div>

        {/* Leader Information */}
        <div className="text-xs text-gray-500">
          Leader: {shortenAddress(channel.leader)}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Link href={`/channels/${channel.id}`}>
            <Button variant="outline" className="w-full group">
              View Details
              <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* Quick Actions for User's Channels */}
        {isUserChannel && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex gap-2">
              {channel.state === 1 && ( // Initialized
                <Link href={`/channels/${channel.id}/deposit`}>
                  <Button size="sm" variant="default" className="flex-1">
                    Deposit
                  </Button>
                </Link>
              )}
              {channel.state === 5 && ( // Closed
                <Link href={`/channels/${channel.id}/withdraw`}>
                  <Button size="sm" variant="success" className="flex-1">
                    Withdraw
                  </Button>
                </Link>
              )}
              {channel.isReadyToClose && channel.isUserLeader && (
                <Button size="sm" variant="gradient" className="flex-1">
                  Close Channel
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}