'use client';

import { useState } from 'react';
import { useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI, ETH_TOKEN_ADDRESS } from '@/lib/contracts';
import { CreateChannelFormData } from '@/lib/types';
import { parseParticipantAddresses, isValidAddress, timeoutToSeconds } from '@/lib/utils';
import { AlertCircle, Users, Clock, Settings, AlertTriangle } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (channelId: bigint) => void;
}

export function CreateChannelModal({ isOpen, onClose, onSuccess }: CreateChannelModalProps) {
  const [formData, setFormData] = useState<CreateChannelFormData>({
    targetContract: ETH_TOKEN_ADDRESS,
    participants: [''],
    l2PublicKeys: [''],
    timeout: '1',
    timeoutUnit: 'days',
    pkx: '',
    pky: ''
  });
  const [participantsText, setParticipantsText] = useState('');
  const [l2KeysText, setL2KeysText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate participants
    const participants = parseParticipantAddresses(participantsText);
    if (participants.length < 3) {
      newErrors.participants = 'At least 3 participants required';
    } else if (participants.length > 50) {
      newErrors.participants = 'Maximum 50 participants allowed';
    }

    // Validate L2 keys
    const l2Keys = parseParticipantAddresses(l2KeysText);
    if (l2Keys.length !== participants.length) {
      newErrors.l2Keys = 'Number of L2 keys must match participants';
    }

    // Validate target contract
    if (!isValidAddress(formData.targetContract)) {
      newErrors.targetContract = 'Invalid contract address';
    }

    // Validate timeout
    const timeout = parseFloat(formData.timeout);
    if (isNaN(timeout) || timeout <= 0) {
      newErrors.timeout = 'Timeout must be greater than 0';
    } else if (formData.timeoutUnit === 'days' && (timeout < 1 || timeout > 365)) {
      newErrors.timeout = 'Timeout must be between 1 and 365 days';
    }

    // Validate public key components
    if (!formData.pkx || !formData.pky) {
      newErrors.publicKey = 'Both PKX and PKY are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Prepare contract write with required 0.001 ETH leader bond
  const channelArgs = validateForm() ? [{
    targetContract: formData.targetContract as `0x${string}`,
    participants: parseParticipantAddresses(participantsText) as `0x${string}`[],
    l2PublicKeys: parseParticipantAddresses(l2KeysText) as `0x${string}`[],
    timeout: timeoutToSeconds(parseFloat(formData.timeout), formData.timeoutUnit),
    pkx: formData.pkx ? BigInt(formData.pkx) : BigInt(0),
    pky: formData.pky ? BigInt(formData.pky) : BigInt(0)
  }] : undefined;

  const contractConfig = channelArgs ? {
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'openChannel',
    args: channelArgs,
    value: BigInt('1000000000000000'), // Required 0.001 ETH leader bond (1e15 wei)
    enabled: validateForm() && !!formData.targetContract
  } : {
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'openChannel',
    enabled: false,
  };

  const { config } = usePrepareContractWrite(contractConfig as any);

  const { data, write } = useContractWrite(config);
  const { isLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: (receipt) => {
      // Extract channel ID from logs if available
      const channelId = BigInt(1); // Would extract from event logs in production
      onSuccess?.(channelId);
      onClose();
      resetForm();
    }
  });

  const resetForm = () => {
    setFormData({
      targetContract: ETH_TOKEN_ADDRESS,
      participants: [''],
      l2PublicKeys: [''],
      timeout: '1',
      timeoutUnit: 'days',
      pkx: '',
      pky: ''
    });
    setParticipantsText('');
    setL2KeysText('');
    setErrors({});
  };

  const handleSubmit = () => {
    if (validateForm()) {
      write?.();
    }
  };

  // Auto-generate dummy public key for testing
  const generateDummyKeys = () => {
    setFormData(prev => ({
      ...prev,
      pkx: '12345678901234567890123456789012345678901234567890123456789012345678',
      pky: '98765432109876543210987654321098765432109876543210987654321098765432'
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-600" />
            Create New Channel
          </DialogTitle>
          <DialogDescription>
            Set up a new ZK Rollup bridge channel with multiple participants
            <br />
            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 mt-2">
              <AlertTriangle className="w-4 h-4" />
              Requires 0.001 ETH leader bond deposit
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Target Contract */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Token Contract</label>
            <Select
              value={formData.targetContract}
              onValueChange={(value) => setFormData(prev => ({ ...prev, targetContract: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select token type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ETH_TOKEN_ADDRESS}>ETH</SelectItem>
                <SelectItem value="custom">Custom ERC20 Token</SelectItem>
              </SelectContent>
            </Select>
            
            {formData.targetContract === 'custom' && (
              <Input
                placeholder="Enter ERC20 contract address"
                value={formData.targetContract}
                onChange={(e) => setFormData(prev => ({ ...prev, targetContract: e.target.value }))}
                className={errors.targetContract ? 'border-red-500' : ''}
              />
            )}
            {errors.targetContract && (
              <div className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.targetContract}
              </div>
            )}
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Participant Addresses</label>
            <Textarea
              placeholder="Enter participant addresses (one per line)&#10;0x1234...&#10;0x5678...&#10;0x9abc..."
              value={participantsText}
              onChange={(e) => setParticipantsText(e.target.value)}
              rows={4}
              className={errors.participants ? 'border-red-500' : ''}
            />
            <div className="text-xs text-gray-500">
              Enter 3-50 participant addresses, one per line. Must be valid Ethereum addresses.
            </div>
            {errors.participants && (
              <div className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.participants}
              </div>
            )}
          </div>

          {/* L2 Public Keys */}
          <div className="space-y-2">
            <label className="text-sm font-medium">L2 Public Keys</label>
            <Textarea
              placeholder="Enter L2 public keys (one per line, matching participant order)&#10;0xabcd...&#10;0xefgh...&#10;0xijkl..."
              value={l2KeysText}
              onChange={(e) => setL2KeysText(e.target.value)}
              rows={4}
              className={errors.l2Keys ? 'border-red-500' : ''}
            />
            <div className="text-xs text-gray-500">
              L2 public keys must match the number and order of participants
            </div>
            {errors.l2Keys && (
              <div className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.l2Keys}
              </div>
            )}
          </div>

          {/* Timeout */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Channel Timeout
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                max="365"
                placeholder="Duration"
                value={formData.timeout}
                onChange={(e) => setFormData(prev => ({ ...prev, timeout: e.target.value }))}
                className={`flex-1 ${errors.timeout ? 'border-red-500' : ''}`}
              />
              <Select
                value={formData.timeoutUnit}
                onValueChange={(value: 'days') => setFormData(prev => ({ ...prev, timeoutUnit: value }))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-gray-500">
              Channel will expire after this duration. Range: 1 day - 365 days
            </div>
            {errors.timeout && (
              <div className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.timeout}
              </div>
            )}
          </div>

          {/* Group Public Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Group Public Key
            </label>
            <div className="space-y-2">
              <Input
                placeholder="PKX (Public Key X coordinate)"
                value={formData.pkx}
                onChange={(e) => setFormData(prev => ({ ...prev, pkx: e.target.value }))}
                className={errors.publicKey ? 'border-red-500' : ''}
              />
              <Input
                placeholder="PKY (Public Key Y coordinate)"
                value={formData.pky}
                onChange={(e) => setFormData(prev => ({ ...prev, pky: e.target.value }))}
                className={errors.publicKey ? 'border-red-500' : ''}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateDummyKeys}
                className="text-xs"
              >
                Generate Test Keys
              </Button>
            </div>
            <div className="text-xs text-gray-500">
              Aggregated public key for threshold signature verification
            </div>
            {errors.publicKey && (
              <div className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.publicKey}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !write}
            variant="gradient"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Creating Channel...
              </>
            ) : (
              'Create Channel'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}