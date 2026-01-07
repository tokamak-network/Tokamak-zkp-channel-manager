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
import { parseParticipantAddresses, isValidAddress } from '@/lib/utils';
import { AlertCircle, Users, Settings } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (channelId: bigint) => void;
}

export function CreateChannelModal({ isOpen, onClose, onSuccess }: CreateChannelModalProps) {
  const [formData, setFormData] = useState<CreateChannelFormData>({
    targetContract: ETH_TOKEN_ADDRESS,
    whitelistedUsers: [''],
    pkx: '',
    pky: '',
    enableFrostSignatures: true
  });
  const [whitelistedUsersText, setWhitelistedUsersText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate whitelistedUsers
    const whitelistedUsers = parseParticipantAddresses(whitelistedUsersText);
    if (whitelistedUsers.length < 3) {
      newErrors.whitelistedUsers = 'At least 3 whitelistedUsers required';
    } else if (whitelistedUsers.length > 50) {
      newErrors.whitelistedUsers = 'Maximum 50 whitelistedUsers allowed';
    }

    // Validate target contract
    if (!isValidAddress(formData.targetContract)) {
      newErrors.targetContract = 'Invalid contract address';
    }

    // Validate public key components (only if frost signatures are enabled)
    if (formData.enableFrostSignatures && (!formData.pkx || !formData.pky)) {
      newErrors.publicKey = 'Both PKX and PKY are required when frost signatures are enabled';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Prepare contract write - updated for new contract structure
  const channelArgs = validateForm() ? [{
    targetContract: formData.targetContract as `0x${string}`,
    whitelistedUsers: parseParticipantAddresses(whitelistedUsersText) as `0x${string}`[],
    enableFrostSignature: formData.enableFrostSignatures
  }] : undefined;

  const contractConfig = channelArgs ? {
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'openChannel',
    args: channelArgs,
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
      whitelistedUsers: [''],
      pkx: '',
      pky: '',
      enableFrostSignatures: true
    });
    setWhitelistedUsersText('');
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
            Set up a new ZK Rollup bridge channel with multiple whitelistedUsers
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

          {/* whitelistedUsers */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Participant Addresses</label>
            <Textarea
              placeholder="Enter participant addresses (one per line)&#10;0x1234...&#10;0x5678...&#10;0x9abc..."
              value={whitelistedUsersText}
              onChange={(e) => setWhitelistedUsersText(e.target.value)}
              rows={4}
              className={errors.whitelistedUsers ? 'border-red-500' : ''}
            />
            <div className="text-xs text-gray-500">
              Enter 3-50 participant addresses, one per line. Must be valid Ethereum addresses.
            </div>
            {errors.whitelistedUsers && (
              <div className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.whitelistedUsers}
              </div>
            )}
          </div>


          {/* Frost Signatures Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Frost Signatures
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="frost-signatures"
                checked={formData.enableFrostSignatures}
                onChange={(e) => setFormData(prev => ({ ...prev, enableFrostSignatures: e.target.checked }))}
                className="rounded border border-gray-300 focus:ring-2 focus:ring-primary-600"
              />
              <label htmlFor="frost-signatures" className="text-sm">
                Enable Frost signature workflow
              </label>
            </div>
            <div className="text-xs text-gray-500">
              When enabled, channel will require DKG ceremony and threshold signatures for operations.
              When disabled, channel operates without group signatures.
            </div>
          </div>

          {/* Group Public Key (only shown when Frost signatures are enabled) */}
          {formData.enableFrostSignatures && (
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
          )}
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