'use client';

import { useState } from 'react';
import { useContractWrite, usePrepareContractWrite, useWaitForTransaction, useContractRead, useAccount } from 'wagmi';
import { parseEther, parseUnits } from 'ethers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI, ETH_TOKEN_ADDRESS, ERC20_ABI } from '@/lib/contracts';
import { DepositFormData } from '@/lib/types';
import { formatBalance, isValidAmount, parseInputAmount, isValidAddress } from '@/lib/utils';
import { AlertCircle, Coins, ArrowDown } from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: bigint;
  targetContract: string;
  onSuccess?: () => void;
}

export function DepositModal({ 
  isOpen, 
  onClose, 
  channelId, 
  targetContract, 
  onSuccess 
}: DepositModalProps) {
  const { address } = useAccount();
  const [formData, setFormData] = useState<DepositFormData>({
    channelId: channelId.toString(),
    amount: '',
    token: targetContract === ETH_TOKEN_ADDRESS ? 'ETH' : 'ERC20',
    tokenAddress: targetContract !== ETH_TOKEN_ADDRESS ? targetContract : undefined
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isETH = formData.token === 'ETH';
  const tokenAddress = isETH ? ETH_TOKEN_ADDRESS : (formData.tokenAddress || targetContract);

  // Get user's balance
  const { data: balance } = useContractRead({
    address: isETH ? undefined : tokenAddress as `0x${string}`,
    abi: isETH ? undefined : ERC20_ABI,
    functionName: isETH ? undefined : 'balanceOf',
    args: isETH ? undefined : address ? [address] : undefined,
    enabled: !isETH && isValidAddress(tokenAddress)
  });

  // Check allowance for ERC20 tokens
  const { data: allowance } = useContractRead({
    address: !isETH ? tokenAddress as `0x${string}` : undefined,
    abi: !isETH ? ERC20_ABI : undefined,
    functionName: !isETH ? 'allowance' : undefined,
    args: !isETH && address ? [address, ROLLUP_BRIDGE_ADDRESS] : undefined,
    enabled: !isETH && isValidAddress(tokenAddress) && isValidAmount(formData.amount)
  });

  const needsApproval = !isETH && allowance !== undefined && 
    isValidAmount(formData.amount) && 
    parseInputAmount(formData.amount, 18) > allowance;

  // Prepare approval transaction
  const { config: approveConfig } = usePrepareContractWrite({
    address: !isETH ? tokenAddress as `0x${string}` : undefined,
    abi: !isETH ? ERC20_ABI : undefined,
    functionName: !isETH ? 'approve' : undefined,
    args: !isETH ? [ROLLUP_BRIDGE_ADDRESS, parseInputAmount(formData.amount, 18)] : undefined,
    enabled: needsApproval && isValidAmount(formData.amount)
  });

  const { write: approve, data: approveData } = useContractWrite(approveConfig);
  const { isLoading: isApproving, isSuccess: approvalSuccess } = useWaitForTransaction({
    hash: approveData?.hash
  });

  // Prepare deposit transaction
  const depositArgs = isETH 
    ? [channelId] as const
    : [channelId, tokenAddress as `0x${string}`, parseInputAmount(formData.amount, 18)] as const;
  
  const { config: depositConfig } = usePrepareContractWrite({
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: isETH ? 'depositETH' : 'depositToken',
    args: depositArgs,
    value: isETH ? parseInputAmount(formData.amount, 18) : undefined,
    enabled: isValidAmount(formData.amount) && (!needsApproval || approvalSuccess)
  } as any);

  const { write: deposit, data: depositData } = useContractWrite(depositConfig);
  const { isLoading: isDepositing, isSuccess: depositSuccess } = useWaitForTransaction({
    hash: depositData?.hash,
    onSuccess: () => {
      onSuccess?.();
      onClose();
      resetForm();
    }
  });

  const resetForm = () => {
    setFormData({
      channelId: channelId.toString(),
      amount: '',
      token: targetContract === ETH_TOKEN_ADDRESS ? 'ETH' : 'ERC20',
      tokenAddress: targetContract !== ETH_TOKEN_ADDRESS ? targetContract : undefined
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!isValidAmount(formData.amount)) {
      newErrors.amount = 'Invalid amount';
    }

    if (!isETH && !isValidAddress(tokenAddress)) {
      newErrors.tokenAddress = 'Invalid token address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMaxClick = () => {
    if (balance) {
      const formatted = formatBalance(balance.toString(), 18, 6);
      setFormData(prev => ({ ...prev, amount: formatted }));
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    if (needsApproval) {
      approve?.();
    } else {
      deposit?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary-600" />
            Deposit to Channel #{channelId.toString()}
          </DialogTitle>
          <DialogDescription>
            Deposit {isETH ? 'ETH' : 'tokens'} into the channel for bridging operations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Token Selection */}
          {targetContract === ETH_TOKEN_ADDRESS && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Token Type</label>
              <Select
                value={formData.token}
                onValueChange={(value: 'ETH' | 'ERC20') => {
                  setFormData(prev => ({ ...prev, token: value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETH">ETH</SelectItem>
                  <SelectItem value="ERC20">Custom ERC20</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Token Address */}
          {formData.token === 'ERC20' && targetContract === ETH_TOKEN_ADDRESS && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Token Contract Address</label>
              <Input
                placeholder="0x..."
                value={formData.tokenAddress || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  tokenAddress: e.target.value 
                }))}
                className={errors.tokenAddress ? 'border-red-500' : ''}
              />
              {errors.tokenAddress && (
                <div className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.tokenAddress}
                </div>
              )}
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount to Deposit</label>
            <div className="relative">
              <Input
                type="number"
                step="0.000001"
                placeholder="0.0"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className={`pr-16 ${errors.amount ? 'border-red-500' : ''}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMaxClick}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs"
              >
                MAX
              </Button>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                Balance: {balance ? formatBalance(balance.toString(), 18) : '0'} {isETH ? 'ETH' : 'tokens'}
              </span>
            </div>
            {errors.amount && (
              <div className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.amount}
              </div>
            )}
          </div>

          {/* Transaction Preview */}
          {isValidAmount(formData.amount) && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-700">You will deposit:</span>
                <span className="font-medium text-primary-900">
                  {formData.amount} {isETH ? 'ETH' : 'tokens'}
                </span>
              </div>
              <ArrowDown className="h-4 w-4 text-primary-600 mx-auto mt-1" />
              <div className="text-center text-xs text-primary-600 mt-1">
                Into Channel #{channelId.toString()}
              </div>
            </div>
          )}

          {/* Approval Status */}
          {needsApproval && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-sm text-yellow-700 text-center">
                {isApproving ? (
                  <span>Step 1/2: Approving token spending...</span>
                ) : approvalSuccess ? (
                  <span>✅ Token approved! Now deposit your tokens</span>
                ) : (
                  <span>Step 1: Approve token spending first</span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isApproving || isDepositing}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!validateForm() || isApproving || isDepositing || (!approve && needsApproval) || (!deposit && !needsApproval)}
            variant="gradient"
          >
            {isApproving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Approving...
              </>
            ) : isDepositing ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Depositing...
              </>
            ) : needsApproval && !approvalSuccess ? (
              'Approve Token'
            ) : (
              'Deposit'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}