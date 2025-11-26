'use client';

import { useState } from 'react';
import { useContractWrite, usePrepareContractWrite, useWaitForTransaction, useContractRead } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Shield, Download } from 'lucide-react';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI, ETH_TOKEN_ADDRESS } from '@/lib/contracts';
import { formatBalance } from '@/lib/utils';

interface EmergencyWithdrawalProps {
  channelId: bigint;
  userAddress: string;
  targetContract: string;
  onSuccess?: () => void;
}

export function EmergencyWithdrawal({
  channelId,
  userAddress,
  targetContract,
  onSuccess
}: EmergencyWithdrawalProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if emergency mode is enabled (mock implementation)
  // const { data: isEmergencyEnabled } = useContractRead({
  //   address: ROLLUP_BRIDGE_ADDRESS,
  //   abi: ROLLUP_BRIDGE_ABI,
  //   functionName: 'isEmergencyModeEnabled',
  //   args: [channelId],
  //   watch: true
  // });
  const isEmergencyEnabled = false; // Disabled until emergency functions are implemented in contract

  // Get user's original deposit
  const { data: userDeposit } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'getParticipantTokenDeposit',
    args: [channelId, userAddress as `0x${string}`, targetContract as `0x${string}`],
    watch: true
  });

  // Check if user has already withdrawn
  const { data: hasWithdrawn } = useContractRead({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'hasUserWithdrawn',
    args: [channelId, userAddress as `0x${string}`],
    watch: true
  });

  // Prepare emergency withdrawal (commented out until contract function is implemented)
  // const { config: emergencyWithdrawConfig } = usePrepareContractWrite({
  //   address: ROLLUP_BRIDGE_ADDRESS,
  //   abi: ROLLUP_BRIDGE_ABI,
  //   functionName: 'emergencyWithdraw',
  //   args: [channelId],
  //   enabled: isEmergencyEnabled && !hasWithdrawn && userDeposit && userDeposit > 0
  // });

  // const { write: emergencyWithdraw, data: withdrawData } = useContractWrite(emergencyWithdrawConfig);

  // const { isLoading: isWithdrawing } = useWaitForTransaction({
  //   hash: withdrawData?.hash,
  //   onSuccess: () => {
  //     onSuccess?.();
  //   }
  // });

  const emergencyWithdraw = undefined;
  const isWithdrawing = false;

  const tokenSymbol = targetContract === ETH_TOKEN_ADDRESS ? 'ETH' : 'Tokens';
  const canWithdraw = isEmergencyEnabled && !hasWithdrawn && userDeposit && userDeposit > 0;

  if (!isEmergencyEnabled) {
    return null; // Don't show if emergency mode is not enabled
  }

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Emergency Withdrawal Available
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Emergency Status */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-800">Channel Leader Failed</span>
          </div>
          <p className="text-sm text-red-700">
            The channel leader failed to submit proof within the required timeframe. 
            Emergency withdrawals have been enabled to protect participant funds.
          </p>
        </div>

        {/* Withdrawal Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Your Original Deposit:</span>
            <span className="font-mono">
              {userDeposit ? formatBalance(userDeposit.toString(), 18) : '0'} {tokenSymbol}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Withdrawal Status:</span>
            <span className={`text-sm font-medium ${hasWithdrawn ? 'text-green-600' : 'text-yellow-600'}`}>
              {hasWithdrawn ? 'Already Withdrawn' : 'Available'}
            </span>
          </div>
        </div>

        {/* Withdrawal Action */}
        {canWithdraw ? (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Protected Withdrawal</span>
              </div>
              <p className="text-sm text-blue-700">
                Emergency withdrawals return your original deposit amount without requiring 
                Merkle proofs. This protects your funds when the channel leader fails.
              </p>
            </div>

            <Button
              onClick={() => {
                // Emergency withdrawal function not yet implemented in contract
                console.log('Emergency withdrawal will be available when contract function is implemented');
              }}
              disabled={true} // Disabled until contract function is implemented
              variant="destructive"
              className="w-full"
            >
              {isWithdrawing ? (
                'Processing Withdrawal...'
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Emergency Withdraw {formatBalance(userDeposit?.toString() || '0', 18)} {tokenSymbol}
                </>
              )}
            </Button>
          </div>
        ) : hasWithdrawn ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">Withdrawal Completed</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              You have already withdrawn your funds from this channel.
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              No funds available for emergency withdrawal.
            </p>
          </div>
        )}

        {/* Important Notes */}
        <div className="border-t pt-4 space-y-2">
          <h4 className="font-medium text-sm">Important Notes:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Emergency withdrawals return original deposit amounts only</li>
            <li>• No Merkle proof verification is required</li>
            <li>• Leader bond has been forfeited due to timeout</li>
            <li>• This protects participants from leader negligence</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}