'use client';

import { useState, useEffect } from 'react';
import { useContractWrite, usePrepareContractWrite, useWaitForTransaction, useContractRead } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Zap, Shield } from 'lucide-react';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { formatDuration } from '@/lib/utils';

interface ChannelTimeoutManagerProps {
  channelId: bigint;
  isUserLeader: boolean;
  isUserParticipant: boolean;
  openTimestamp: bigint;
  timeout: bigint;
  state: number;
  onSuccess?: () => void;
}

export function ChannelTimeoutManager({
  channelId,
  isUserLeader,
  isUserParticipant,
  openTimestamp,
  timeout,
  state,
  onSuccess
}: ChannelTimeoutManagerProps) {
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate important timestamps
  const channelDeadline = Number(openTimestamp) + Number(timeout);
  const proofDeadline = channelDeadline + (7 * 24 * 60 * 60); // 7 days after timeout
  const timeToTimeout = channelDeadline - currentTime;
  const timeToProofDeadline = proofDeadline - currentTime;
  
  const isChannelExpired = currentTime >= channelDeadline;
  const isProofDeadlineExpired = currentTime >= proofDeadline;
  const canSubmitProof = isChannelExpired && !isProofDeadlineExpired && (state === 2 || state === 3); // Open or Active

  // Get channel timeout info
  const { data: timeoutInfo } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getChannelTimeoutInfo',
    args: [channelId],
    watch: true
  });

  // Prepare contract calls - this function doesn't exist in the contract, removing it
  // const { config: handleTimeoutConfig } = usePrepareContractWrite({
  //   address: ROLLUP_BRIDGE_ADDRESS,
  //   abi: ROLLUP_BRIDGE_ABI,
  //   functionName: 'handleProofTimeout',
  //   args: [channelId],
  //   enabled: isProofDeadlineExpired && isUserParticipant && !isUserLeader
  // });

  // const { config: emergencyCloseConfig } = usePrepareContractWrite({
  //   address: ROLLUP_BRIDGE_ADDRESS,
  //   abi: ROLLUP_BRIDGE_ABI,
  //   functionName: 'emergencyCloseExpiredChannel',
  //   args: [channelId],
  //   enabled: isProofDeadlineExpired
  // });

  // const { write: handleTimeout, data: handleTimeoutData } = useContractWrite(handleTimeoutConfig);
  // const { write: emergencyClose, data: emergencyCloseData } = useContractWrite(emergencyCloseConfig);

  // const { isLoading: isHandlingTimeout } = useWaitForTransaction({
  //   hash: handleTimeoutData?.hash,
  //   onSuccess: () => {
  //     onSuccess?.();
  //   }
  // });

  // const { isLoading: isEmergencyClosing } = useWaitForTransaction({
  //   hash: emergencyCloseData?.hash,
  //   onSuccess: () => {
  //     onSuccess?.();
  //   }
  // });

  const getTimeoutStatus = () => {
    if (!isChannelExpired) {
      return {
        status: 'active',
        message: 'Channel is still active',
        timeRemaining: timeToTimeout,
        color: 'bg-green-100 text-green-800 border-green-200'
      };
    } else if (canSubmitProof) {
      return {
        status: 'timeout',
        message: 'Channel timeout reached - proof submission required',
        timeRemaining: timeToProofDeadline,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      };
    } else if (isProofDeadlineExpired) {
      return {
        status: 'expired',
        message: 'Proof deadline expired - leader bond can be slashed',
        timeRemaining: 0,
        color: 'bg-red-100 text-red-800 border-red-200'
      };
    }
    return {
      status: 'unknown',
      message: 'Unknown status',
      timeRemaining: 0,
      color: 'bg-gray-100 text-gray-800 border-gray-200'
    };
  };

  const timeoutStatus = getTimeoutStatus();

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Channel Timeout Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className={`p-4 rounded-lg border ${timeoutStatus.color}`}>
          <div className="flex items-center gap-2 mb-2">
            {timeoutStatus.status === 'expired' && <AlertTriangle className="h-4 w-4" />}
            {timeoutStatus.status === 'timeout' && <Clock className="h-4 w-4" />}
            {timeoutStatus.status === 'active' && <Shield className="h-4 w-4" />}
            <span className="font-medium">{timeoutStatus.message}</span>
          </div>
          {timeoutStatus.timeRemaining > 0 && (
            <div className="text-sm">
              Time remaining: {formatDuration(timeoutStatus.timeRemaining)}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Timeline:</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Channel timeout:</span>
              <Badge variant={isChannelExpired ? "destructive" : "secondary"}>
                {new Date(channelDeadline * 1000).toLocaleString()}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Proof submission deadline:</span>
              <Badge variant={isProofDeadlineExpired ? "destructive" : "secondary"}>
                {new Date(proofDeadline * 1000).toLocaleString()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Leader Actions */}
        {isUserLeader && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Leader Actions:</h4>
            {canSubmitProof ? (
              <div className="space-y-2">
                <p className="text-sm text-yellow-700">
                  ⚠️ You must submit aggregated proof within 7 days or your bond will be slashed.
                </p>
                <Button variant="gradient" className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  Submit Aggregated Proof
                </Button>
              </div>
            ) : isProofDeadlineExpired ? (
              <p className="text-sm text-red-700">
                ❌ Proof deadline expired. Your leader bond has been forfeited.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Proof submission will be available after channel timeout.
              </p>
            )}
          </div>
        )}

        {/* Participant Actions */}
        {isUserParticipant && !isUserLeader && isProofDeadlineExpired && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Participant Actions:</h4>
            <div className="space-y-2">
              <p className="text-sm text-red-700">
                The leader failed to submit proof on time. Emergency actions are available below.
              </p>
            </div>
          </div>
        )}

        {/* Emergency Close (Anyone) */}
        {isProofDeadlineExpired && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Emergency Actions:</h4>
            <div className="space-y-2">
              <p className="text-sm text-red-700">
                Channel has expired and emergency procedures may be required. Contact the contract owner for assistance.
              </p>
            </div>
          </div>
        )}

        {/* Emergency Withdrawal Info */}
        {isProofDeadlineExpired && isUserParticipant && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Emergency Withdrawal Available</h4>
            <p className="text-sm text-blue-700">
              Since the leader failed to submit proof, you can withdraw your original deposit amount.
              No proof verification is required for emergency withdrawals.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}