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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ROLLUP_BRIDGE_ADDRESS, ROLLUP_BRIDGE_ABI } from '@/lib/contracts';
import { AlertCircle, Zap, Upload } from 'lucide-react';

interface ProofSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: bigint;
  onSuccess?: () => void;
}

interface ProofData {
  proofPart1: bigint[];
  proofPart2: bigint[];
  publicInputs: bigint[];
  smax: bigint;
  initialMPTLeaves: string[];
  finalMPTLeaves: string[];
  participantRoots: string[];
  aggregatedProofHash: string;
  finalStateRoot: string;
}

export function ProofSubmissionModal({ 
  isOpen, 
  onClose, 
  channelId,
  onSuccess 
}: ProofSubmissionModalProps) {
  const [proofData, setProofData] = useState<ProofData>({
    proofPart1: [],
    proofPart2: [],
    publicInputs: [],
    smax: BigInt(0),
    initialMPTLeaves: [],
    finalMPTLeaves: [],
    participantRoots: [],
    aggregatedProofHash: '',
    finalStateRoot: ''
  });
  const [jsonInput, setJsonInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Parse JSON input
  const parseProofData = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      
      // Validate required fields
      const requiredFields = [
        'proofPart1', 'proofPart2', 'publicInputs', 'smax',
        'initialMPTLeaves', 'finalMPTLeaves', 'participantRoots',
        'aggregatedProofHash', 'finalStateRoot'
      ];
      
      const missingFields = requiredFields.filter(field => !(field in parsed));
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Convert numeric arrays to BigInt arrays
      const convertedData = {
        ...parsed,
        proofPart1: parsed.proofPart1?.map((n: any) => BigInt(n)) || [],
        proofPart2: parsed.proofPart2?.map((n: any) => BigInt(n)) || [],
        publicInputs: parsed.publicInputs?.map((n: any) => BigInt(n)) || [],
        smax: BigInt(parsed.smax || 0)
      };
      
      setProofData(convertedData);
      setErrors({});
      return true;
    } catch (error) {
      setErrors({ json: `Invalid JSON: ${(error as Error).message}` });
      return false;
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!proofData.aggregatedProofHash) {
      newErrors.aggregatedProofHash = 'Aggregated proof hash is required';
    }

    if (!proofData.finalStateRoot) {
      newErrors.finalStateRoot = 'Final state root is required';
    }

    if (proofData.proofPart1.length === 0) {
      newErrors.proofPart1 = 'Proof part 1 is required';
    }

    if (proofData.proofPart2.length === 0) {
      newErrors.proofPart2 = 'Proof part 2 is required';
    }

    if (proofData.initialMPTLeaves.length === 0) {
      newErrors.initialMPTLeaves = 'Initial MPT leaves are required';
    }

    if (proofData.finalMPTLeaves.length === 0) {
      newErrors.finalMPTLeaves = 'Final MPT leaves are required';
    }

    if (proofData.initialMPTLeaves.length !== proofData.finalMPTLeaves.length) {
      newErrors.leaves = 'Initial and final MPT leaves must have the same length';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Prepare contract write
  const isFormValid = validateForm() && !!channelId;
  
  const contractConfig = isFormValid ? {
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'submitAggregatedProof',
    args: [channelId, {
      aggregatedProofHash: proofData.aggregatedProofHash as `0x${string}`,
      finalStateRoot: proofData.finalStateRoot as `0x${string}`,
      proofPart1: proofData.proofPart1 as readonly bigint[],
      proofPart2: proofData.proofPart2 as readonly bigint[],
      publicInputs: proofData.publicInputs as readonly bigint[],
      smax: proofData.smax,
      initialMPTLeaves: proofData.initialMPTLeaves as readonly `0x${string}`[],
      finalMPTLeaves: proofData.finalMPTLeaves as readonly `0x${string}`[],
      participantRoots: proofData.participantRoots as readonly `0x${string}`[]
    }] as const,
    enabled: true
  } : {
    address: ROLLUP_BRIDGE_ADDRESS,
    abi: ROLLUP_BRIDGE_ABI,
    functionName: 'submitAggregatedProof',
    enabled: false
  };

  const { config } = usePrepareContractWrite(contractConfig as any);

  const { data, write } = useContractWrite(config);
  const { isLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      onSuccess?.();
      onClose();
      resetForm();
    }
  });

  const resetForm = () => {
    setProofData({
      proofPart1: [],
      proofPart2: [],
      publicInputs: [],
      smax: BigInt(0),
      initialMPTLeaves: [],
      finalMPTLeaves: [],
      participantRoots: [],
      aggregatedProofHash: '',
      finalStateRoot: ''
    });
    setJsonInput('');
    setErrors({});
  };

  const handleSubmit = () => {
    if (validateForm()) {
      write?.();
    }
  };

  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setJsonInput(content);
        parseProofData(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-600" />
            Submit Aggregated Proof
          </DialogTitle>
          <DialogDescription>
            Submit the aggregated zero-knowledge proof for channel {channelId.toString()}.
            This must be done after the channel timeout but within 7 days to avoid bond slashing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800">Time-Sensitive Action</span>
            </div>
            <p className="text-sm text-amber-700">
              You have 7 days from the channel timeout to submit this proof. 
              Failure to submit within this timeframe will result in your leader bond being slashed.
            </p>
          </div>

          {/* JSON Upload */}
          <div className="space-y-2">
            <Label>Upload Proof Data (JSON)</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".json"
                onChange={handleJsonUpload}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const content = e.target?.result as string;
                        setJsonInput(content);
                        parseProofData(content);
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Browse
              </Button>
            </div>
          </div>

          {/* JSON Input */}
          <div className="space-y-2">
            <Label>Proof Data JSON</Label>
            <Textarea
              placeholder="Paste your proof data JSON here or upload a file..."
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                if (e.target.value.trim()) {
                  parseProofData(e.target.value);
                }
              }}
              rows={10}
              className={`font-mono text-sm ${errors.json ? 'border-red-500' : ''}`}
            />
            {errors.json && (
              <div className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.json}
              </div>
            )}
          </div>

          {/* Proof Summary */}
          {proofData.aggregatedProofHash && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">Proof Summary</h4>
              <div className="space-y-1 text-sm text-blue-700">
                <div>Final State Root: {proofData.finalStateRoot.slice(0, 20)}...</div>
                <div>Aggregated Proof Hash: {proofData.aggregatedProofHash.slice(0, 20)}...</div>
                <div>Participants: {proofData.participantRoots.length}</div>
                <div>MPT Leaves: {proofData.initialMPTLeaves.length} → {proofData.finalMPTLeaves.length}</div>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {Object.keys(errors).length > 0 && errors.json === undefined && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">Validation Errors</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {Object.entries(errors).map(([field, error]) => (
                  <li key={field}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !write || !validateForm()}
            variant="gradient"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Submitting Proof...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Submit Proof
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}