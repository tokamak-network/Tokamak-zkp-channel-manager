'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, XCircle, ArrowRight, Check, Trash2 } from 'lucide-react';

export type ProofStatus = 'pending' | 'verified' | 'rejected';

export interface ProofData {
  id: number | string;
  status: ProofStatus;
  timestamp: number;
  submitter: string;
  channelId: number;
  proofId?: string;
  sequenceNumber?: number;
  subNumber?: number;
  key?: string; // Firebase key
}

interface ProofCardProps {
  proof: ProofData;
  isLeader?: boolean;
  onVerify?: (proof: ProofData) => void;
  isVerifying?: boolean;
  onDelete?: (proof: ProofData) => void;
  isDeleting?: boolean;
  userAddress?: string;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Clock,
    badgeClass: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
    borderClass: 'border-yellow-500/50'
  },
  verified: {
    label: 'Verified',
    icon: CheckCircle2,
    badgeClass: 'bg-green-500/20 border-green-500 text-green-400',
    borderClass: 'border-green-500/50'
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    badgeClass: 'bg-red-500/20 border-red-500 text-red-400',
    borderClass: 'border-red-500/50'
  }
};

export function ProofCard({ 
  proof, 
  isLeader = false, 
  onVerify, 
  isVerifying = false,
  onDelete,
  isDeleting = false,
  userAddress
}: ProofCardProps) {
  const config = statusConfig[proof.status];
  const Icon = config.icon;
  const proofDisplayId = proof.proofId || `#${proof.id}`;

  // Check if user can delete this proof
  const isSubmitter = userAddress && proof.submitter?.toLowerCase() === userAddress.toLowerCase();
  const canDelete = isLeader || (isSubmitter && proof.status === 'pending');

  const handleVerify = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onVerify && proof.status === 'pending') {
      onVerify(proof);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete && canDelete) {
      if (window.confirm(`Are you sure you want to delete ${proofDisplayId}?`)) {
        onDelete(proof);
      }
    }
  };

  return (
    <div className={`bg-gradient-to-b from-[#1a2347] to-[#0a1930] border ${config.borderClass} p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20 group`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Proof {proofDisplayId}
          </h3>
        </div>
        {/* Status Icon - Only one icon per status */}
        {proof.status === 'verified' && (
          <div className="bg-green-500 p-2 rounded">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
        )}
        {proof.status === 'pending' && (
          <div className="bg-yellow-500 p-2 rounded">
            <Clock className="h-4 w-4 text-white" />
          </div>
        )}
        {proof.status === 'rejected' && (
          <div className="bg-red-500 p-2 rounded">
            <XCircle className="h-4 w-4 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Channel</span>
          <span className="text-[#4fc3f7] font-semibold">#{proof.channelId}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Timestamp</span>
          <span className="text-gray-300">
            {new Date(proof.timestamp).toLocaleDateString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Submitter</span>
          <span className="text-gray-300 font-mono text-xs">
            {proof.submitter?.slice(0, 6)}...{proof.submitter?.slice(-4)}
          </span>
        </div>

        <div className="pt-2 border-t border-[#4fc3f7]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/state-explorer/${proof.channelId}/${encodeURIComponent(proof.id || proof.proofId || proof.key || '')}`}>
              <div className="text-sm text-gray-400 group-hover:text-[#4fc3f7] transition-colors flex items-center gap-1 cursor-pointer">
                View Details
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
            {/* Delete Button */}
            {canDelete && onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 disabled:opacity-50"
                title={isLeader ? "Delete proof (Leader)" : "Delete your pending proof"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Status Text */}
          <span className={`text-xs font-medium ${
            proof.status === 'verified' ? 'text-green-400' :
            proof.status === 'pending' ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {config.label}
          </span>
        </div>
      </div>
    </div>
  );
}
