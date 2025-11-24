'use client';

import { useParams, useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowRight,
  User,
  Hash,
  Calendar,
  Activity,
  Users,
  Coins,
  Minus,
  Download,
  Play,
  FileText
} from 'lucide-react';

// Participant Balance Type
interface ParticipantBalance {
  address: string;
  balanceBefore: string;
  balanceAfter: string;
  hasChange: boolean; // 이 transaction에서 변화가 있었는지
}

// Mock data types
interface StateChange {
  field: string;
  before: string;
  after: string;
}

interface ProofDetail {
  id: number;
  status: 'pending' | 'verified' | 'rejected';
  timestamp: number;
  submitter: string;
  channelId: number;
  merkleRoot: string;
  signature: string;
  stateChanges: StateChange[];
  transactionHash?: string;
  gasUsed?: string;
  verifier?: string;
  participants: ParticipantBalance[];
  tokenSymbol: string;
}

// Mock data generator
function getMockProofDetail(id: number): ProofDetail {
  const status = id === 3 || id === 5 ? 'pending' : id === 4 ? 'rejected' : 'verified';
  
  return {
    id,
    status,
    timestamp: Date.now() - (id * 3600000),
    submitter: '0x1234567890123456789012345678901234567890',
    channelId: Math.floor((id - 1) / 2) + 1,
    merkleRoot: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
    signature: '0x' + Array(130).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
    stateChanges: [
      {
        field: 'State Root',
        before: '0x' + Array(16).fill('a').join('') + '...',
        after: '0x' + Array(16).fill('b').join('') + '...'
      },
      {
        field: 'Last Update',
        before: new Date(Date.now() - (id + 1) * 7200000).toLocaleString(),
        after: new Date(Date.now() - id * 3600000).toLocaleString()
      }
    ],
    transactionHash: status === 'verified' ? '0xabcdef' + Array(58).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('') : undefined,
    gasUsed: status === 'verified' ? '21000' : undefined,
    verifier: status === 'verified' ? '0x9876543210987654321098765432109876543210' : undefined,
    tokenSymbol: 'WTON',
    participants: [
      {
        address: '0x1234567890123456789012345678901234567890',
        balanceBefore: '1500.25',
        balanceAfter: '1400.25',
        hasChange: true // 이 transaction에서 출금
      },
      {
        address: '0x9876543210987654321098765432109876543210',
        balanceBefore: '2200.50',
        balanceAfter: '2300.50',
        hasChange: true // 이 transaction에서 입금
      },
      {
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
        balanceBefore: '1800.75',
        balanceAfter: '1800.75',
        hasChange: false // 변화 없음
      }
    ]
  };
}

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Clock,
    badgeClass: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
    description: 'Awaiting leader verification'
  },
  verified: {
    label: 'Verified',
    icon: CheckCircle2,
    badgeClass: 'bg-green-500/20 border-green-500 text-green-400',
    description: 'Proof verified and accepted'
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    badgeClass: 'bg-red-500/20 border-red-500 text-red-400',
    description: 'Proof rejected - invalid state'
  }
};

export default function ProofDetailPage() {
  const router = useRouter();
  const params = useParams();
  const proofId = parseInt(params.proofId as string);
  
  const proof = getMockProofDetail(proofId);
  const config = statusConfig[proof.status];
  const Icon = config.icon;

  return (
    <Layout 
      title={`Proof #${proof.id}`}
      subtitle={config.description}
    >
      <div className="p-4 pb-20">
        <div className="max-w-6xl w-full mx-auto">
          {/* Back Button */}
          <Button 
            variant="outline" 
            className="mb-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30 text-white hover:border-[#4fc3f7] hover:bg-[#1a2347]"
            onClick={() => router.push('/state-explorer')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Explorer
          </Button>

          {/* Header Card */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Proof #{proof.id}</h2>
                <p className="text-gray-400">{config.description}</p>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 border ${config.badgeClass} rounded font-medium w-fit`}>
                <Icon className="w-5 h-5" />
                {config.label}
              </div>
            </div>
          </div>

          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Channel</span>
                <div className="bg-[#4fc3f7] p-2 rounded">
                  <Hash className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#4fc3f7]">#{proof.channelId}</div>
            </div>

            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Timestamp</span>
                <div className="bg-[#4fc3f7] p-2 rounded">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-sm text-gray-400">
                {new Date(proof.timestamp).toLocaleString()}
              </div>
            </div>

            <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Submitter</span>
                <div className="bg-[#4fc3f7] p-2 rounded">
                  <User className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-xs font-mono text-gray-400 break-all">
                {proof.submitter.slice(0, 10)}...{proof.submitter.slice(-8)}
              </div>
            </div>

            {proof.verifier && (
              <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">Verifier</span>
                  <div className="bg-green-500 p-2 rounded">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-xs font-mono text-gray-400 break-all">
                  {proof.verifier.slice(0, 10)}...{proof.verifier.slice(-8)}
                </div>
              </div>
            )}
          </div>

          {/* Participant Balances Section */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-[#4fc3f7] p-2 rounded">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Channel Participants & Token Balances</h3>
                <p className="text-sm text-gray-400">Token balances for each participant in this state</p>
              </div>
            </div>

            <div className="space-y-4">
              {proof.participants.map((participant, index) => (
                <div
                  key={participant.address}
                  className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all"
                >
                  {/* Participant Header */}
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#4fc3f7]/20">
                    <div className="bg-[#4fc3f7] px-3 py-1 rounded text-white font-bold text-sm">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">Participant Address</div>
                      <div className="font-mono text-sm text-[#4fc3f7]">
                        {participant.address}
                      </div>
                    </div>
                  </div>

                  {/* Balance Change Display */}
                  {participant.hasChange ? (
                    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                      {/* Before */}
                      <div className="bg-[#1a2347] border border-[#4fc3f7]/20 p-4 rounded">
                        <div className="text-xs text-gray-500 mb-2">Before</div>
                        <div className="flex items-center gap-2 mb-1">
                          <Coins className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-400">{proof.tokenSymbol}</span>
                        </div>
                        <div className="text-xl font-mono text-gray-300">
                          {participant.balanceBefore}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center">
                        <ArrowRight className="w-6 h-6 text-[#4fc3f7]" />
                      </div>

                      {/* After */}
                      <div className="bg-[#1a2347] border border-green-500/30 p-4 rounded">
                        <div className="text-xs text-green-400 mb-2">After</div>
                        <div className="flex items-center gap-2 mb-1">
                          <Coins className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-green-400">{proof.tokenSymbol}</span>
                        </div>
                        <div className="text-xl font-mono font-semibold text-green-400">
                          {participant.balanceAfter}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // No Change
                    <div className="bg-[#1a2347] border border-[#4fc3f7]/20 p-4 rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Coins className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-400">{proof.tokenSymbol}</span>
                          </div>
                          <div className="text-xl font-mono text-gray-300">
                            {participant.balanceAfter}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500">
                          <Minus className="w-4 h-4" />
                          <span className="text-sm">No change</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* State Changes Section */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-[#4fc3f7] p-2 rounded">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">State Changes</h3>
            </div>

            <div className="space-y-4">
              {proof.stateChanges.map((change, index) => (
                <div
                  key={index}
                  className="bg-[#0a1930]/50 border border-[#4fc3f7]/30 p-4 rounded hover:border-[#4fc3f7] transition-all"
                >
                  <div className="font-semibold text-white mb-3">
                    {change.field}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                    {/* Before */}
                    <div className="bg-[#1a2347] border border-[#4fc3f7]/20 p-3 rounded">
                      <div className="text-xs text-gray-500 mb-1">Before</div>
                      <div className="font-mono text-sm text-gray-300">
                        {change.before}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-[#4fc3f7]" />
                    </div>

                    {/* After */}
                    <div className="bg-[#1a2347] border border-green-500/30 p-3 rounded">
                      <div className="text-xs text-green-400 mb-1">After</div>
                      <div className="font-mono text-sm text-green-400 font-semibold">
                        {change.after}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Proof Data Section */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 p-5 hover:border-[#4fc3f7] transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/20 mb-6">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Merkle Root</h4>
            <div className="font-mono text-xs text-[#4fc3f7] break-all bg-[#0a1930] p-3 rounded border border-[#4fc3f7]/20">
              {proof.merkleRoot}
            </div>
          </div>

          {/* Verification & Download Section */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-[#4fc3f7] p-2 rounded">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Verification & Files</h3>
                <p className="text-sm text-gray-400">Download proof files and verify independently</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Verify Button */}
              <button
                onClick={() => {
                  // TODO: Implement verification logic
                  window.alert('This will execute the proof verification process');
                }}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-500 text-white rounded transition-all hover:shadow-lg hover:shadow-green-500/30 font-medium"
              >
                <Play className="w-5 h-5" />
                <span>Verify Proof</span>
              </button>

              {/* Download All Files (ZIP) */}
              <button
                onClick={() => {
                  // TODO: Implement ZIP download with proof and state files
                  // This will download a ZIP file containing:
                  // - proof_{id}.json
                  // - state_{id}.json
                  window.alert('This will download a ZIP file containing proof and state files');
                }}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-[#4fc3f7] hover:bg-[#029bee] text-white rounded transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/30 font-medium"
              >
                <Download className="w-5 h-5" />
                <span>Download Files (ZIP)</span>
              </button>
            </div>

            {/* Info Text */}
            <div className="mt-6 p-4 bg-[#0a1930]/50 border border-[#4fc3f7]/30 rounded">
              <p className="text-sm text-gray-400">
                <span className="text-[#4fc3f7] font-semibold">Note:</span> Download includes both proof and state files in a ZIP archive. You can verify the computation independently using the verification tools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
