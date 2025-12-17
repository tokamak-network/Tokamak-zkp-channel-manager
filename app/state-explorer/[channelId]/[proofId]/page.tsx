'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useContractReads } from 'wagmi';
import { formatUnits } from 'viem';
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
import {
  ROLLUP_BRIDGE_CORE_ADDRESS,
  ROLLUP_BRIDGE_CORE_ABI,
  ETH_TOKEN_ADDRESS,
} from '@/lib/contracts';
import { ERC20_ABI } from '@/lib/contracts';
import { getData, getLatestSnapshot } from '@/lib/realtime-db-helpers';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { 
  parseProofFromBase64Zip, 
  analyzeProof, 
  type ProofAnalysisResult 
} from '@/lib/proofAnalyzer';

// Participant Balance Type
interface ParticipantBalance {
  address: string;
  initialDeposit: string;
  currentBalance: string; // Before balance (from latest approved state)
  newBalance?: string; // After balance (from proof file analysis - to be implemented)
  symbol: string;
  decimals: number;
  hasChange?: boolean; // Whether balance changed in this proof
}

interface ProofData {
  proofId?: string;
  id?: string | number;
  status: 'pending' | 'verified' | 'rejected';
  timestamp: number;
  submitter: string;
  channelId: number | string;
  sequenceNumber?: number;
  subNumber?: number;
  verifier?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  zipFile?: {
    path: string;
    size: number;
    fileName: string;
    content?: string; // base64 content
  };
  key?: string; // Firebase key
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
  const channelId = params.channelId as string;
  // Decode the proofId to handle URL-encoded characters like # (%23)
  const proofId = params.proofId ? decodeURIComponent(params.proofId as string) : '';
  const publicClient = usePublicClient();
  
  const [proof, setProof] = useState<ProofData | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [participantBalances, setParticipantBalances] = useState<ParticipantBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [decimals, setDecimals] = useState(18);
  const [symbol, setSymbol] = useState('TOKEN');
  const [proofAnalysis, setProofAnalysis] = useState<ProofAnalysisResult | null>(null);
  const [isAnalyzingProof, setIsAnalyzingProof] = useState(false);

  // Fetch proof data from Firebase
  useEffect(() => {
    const fetchProof = async () => {
      if (!channelId || !proofId) {
        console.log('ProofDetailPage: Missing channelId or proofId', { channelId, proofId });
        return;
      }

      console.log('ProofDetailPage: Fetching proof', { channelId, proofId });
      setIsLoading(true);
      try {
        // Try to find proof in submittedProofs, verifiedProofs, or rejectedProofs
        const [submittedProofs, verifiedProofs, rejectedProofs] = await Promise.all([
          getData<any>(`channels/${channelId}/submittedProofs`),
          getData<any>(`channels/${channelId}/verifiedProofs`),
          getData<any>(`channels/${channelId}/rejectedProofs`),
        ]);

        let foundProof: any = null;

        // Search in submittedProofs
        if (submittedProofs) {
          const submittedList = Array.isArray(submittedProofs)
            ? submittedProofs
            : Object.entries(submittedProofs).map(([key, value]: [string, any]) => ({ ...value, key }));
          foundProof = submittedList.find((p: any) => {
            // Match by proofId, id, or key (case-insensitive comparison)
            const pProofId = String(p.proofId || '').toLowerCase();
            const pId = String(p.id || '').toLowerCase();
            const pKey = String(p.key || key || '').toLowerCase();
            const searchId = String(proofId || '').toLowerCase();
            return pProofId === searchId || pId === searchId || pKey === searchId;
          });
        }

        // Search in verifiedProofs
        if (!foundProof && verifiedProofs) {
          const verifiedList = Array.isArray(verifiedProofs)
            ? verifiedProofs
            : Object.entries(verifiedProofs).map(([key, value]: [string, any]) => ({ ...value, key }));
          foundProof = verifiedList.find((p: any) => {
            const pProofId = String(p.proofId || '').toLowerCase();
            const pId = String(p.id || '').toLowerCase();
            const pKey = String(p.key || key || '').toLowerCase();
            const searchId = String(proofId || '').toLowerCase();
            return pProofId === searchId || pId === searchId || pKey === searchId;
          });
        }

        // Search in rejectedProofs
        if (!foundProof && rejectedProofs) {
          const rejectedList = Array.isArray(rejectedProofs)
            ? rejectedProofs
            : Object.entries(rejectedProofs).map(([key, value]: [string, any]) => ({ ...value, key }));
          foundProof = rejectedList.find((p: any) => {
            const pProofId = String(p.proofId || '').toLowerCase();
            const pId = String(p.id || '').toLowerCase();
            const pKey = String(p.key || key || '').toLowerCase();
            const searchId = String(proofId || '').toLowerCase();
            return pProofId === searchId || pId === searchId || pKey === searchId;
          });
        }

        if (foundProof) {
          // Get zipFile data if it exists
          let zipFileData = foundProof.zipFile;
          
          // Try to get ZIP file content from Firebase
          // The ZIP file is stored at: channels/{channelId}/{status}Proofs/{storageProofId}/zipFile
          // where storageProofId is like "proof-1" or "proof-1-2"
          // The key from Firebase is the storageProofId (e.g., "proof-1")
          const storageProofId = foundProof.key || 
            (foundProof.proofId ? foundProof.proofId.replace(/#/g, '-') : null) ||
            (foundProof.id ? `proof-${foundProof.id}` : null);
          
          console.log('ProofDetailPage: Looking for ZIP file', {
            channelId,
            proofId,
            foundProofKey: foundProof.key,
            foundProofProofId: foundProof.proofId,
            storageProofId,
            proofStatus: foundProof.status
          });
          
          if (storageProofId) {
            // Determine which status folder to check based on proof status
            const statusFolder = foundProof.status === 'verified' ? 'verifiedProofs' :
                                foundProof.status === 'rejected' ? 'rejectedProofs' :
                                'submittedProofs';
            
            // Try the most likely path first (based on status)
            const primaryPath = `channels/${channelId}/${statusFolder}/${storageProofId}/zipFile`;
            
            // Also try other possible paths
            const possiblePaths = [
              primaryPath,
              `channels/${channelId}/submittedProofs/${storageProofId}/zipFile`,
              `channels/${channelId}/verifiedProofs/${storageProofId}/zipFile`,
              `channels/${channelId}/rejectedProofs/${storageProofId}/zipFile`,
            ];
            
            // Try each path until we find the ZIP file
            for (const path of possiblePaths) {
              try {
                console.log('ProofDetailPage: Trying path', path);
                const zipFileContent = await getData<any>(path);
                console.log('ProofDetailPage: zipFileContent from', path, {
                  hasContent: !!zipFileContent,
                  type: typeof zipFileContent,
                  keys: zipFileContent ? Object.keys(zipFileContent) : [],
                  contentExists: !!zipFileContent?.content,
                  contentType: typeof zipFileContent?.content,
                  fullData: zipFileContent
                });
                
                if (zipFileContent) {
                  // Check if content exists and is a string
                  if (zipFileContent.content && typeof zipFileContent.content === 'string') {
                    console.log('ProofDetailPage: Found ZIP file content at', path, 'Content length:', zipFileContent.content.length);
                    zipFileData = {
                      path: path,
                      size: zipFileContent.size || foundProof.zipFile?.size || 0,
                      fileName: zipFileContent.fileName || foundProof.zipFile?.fileName || `proof-${foundProof.proofId || foundProof.id || 'unknown'}.zip`,
                      content: zipFileContent.content,
                    };
                    break; // Found it, stop searching
                  } else if (typeof zipFileContent === 'string') {
                    // If the entire response is a string (base64), use it directly
                    console.log('ProofDetailPage: Found ZIP file content as string at', path, 'Content length:', zipFileContent.length);
                    zipFileData = {
                      path: path,
                      size: foundProof.zipFile?.size || 0,
                      fileName: foundProof.zipFile?.fileName || `proof-${foundProof.proofId || foundProof.id || 'unknown'}.zip`,
                      content: zipFileContent,
                    };
                    break; // Found it, stop searching
                  } else {
                    console.warn('ProofDetailPage: zipFileContent exists but no valid content found', zipFileContent);
                  }
                }
              } catch (error) {
                console.warn('ProofDetailPage: Failed to fetch from path', path, error);
                // Continue to next path
                continue;
              }
            }
          } else if (foundProof.zipFile?.path) {
            // Fallback to the path in zipFile metadata
            try {
              console.log('ProofDetailPage: Trying zipFile.path', foundProof.zipFile.path);
              const zipFileContent = await getData<any>(foundProof.zipFile.path);
              if (zipFileContent?.content) {
                zipFileData = {
                  ...foundProof.zipFile,
                  content: zipFileContent.content,
                };
              }
            } catch (error) {
              console.warn('Failed to fetch ZIP file content:', error);
            }
          }
          
          console.log('ProofDetailPage: Final zipFileData', zipFileData ? { ...zipFileData, content: zipFileData.content ? 'present' : 'missing' } : null);

          const proofData = {
            ...foundProof,
            channelId: channelId,
            status: foundProof.status || 'pending',
            timestamp: foundProof.timestamp || foundProof.submittedAt || Date.now(),
            verifier: foundProof.verifiedBy || foundProof.verifier,
            zipFile: zipFileData,
          };
          
          setProof(proofData);
          
          // Analyze proof files if ZIP content is available
          if (zipFileData?.content) {
            setIsAnalyzingProof(true);
            try {
              const { instance, snapshot, error } = await parseProofFromBase64Zip(zipFileData.content);
              
              if (error) {
                console.error('Error parsing proof ZIP:', error);
              } else if (instance && snapshot) {
                const analysis = analyzeProof(instance, snapshot, decimals);
                setProofAnalysis(analysis);
                console.log('Proof analysis completed:', analysis);
              }
            } catch (error) {
              console.error('Error analyzing proof:', error);
            } finally {
              setIsAnalyzingProof(false);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching proof:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProof();
  }, [channelId, proofId, decimals]);

  // Fetch channel data and participants
  useEffect(() => {
    const fetchChannelData = async () => {
      if (!publicClient || !channelId) return;

      try {
        const channelIdNum = BigInt(channelId);
        
        // Get channel info
        const [channelInfo, participants, leader] = await Promise.all([
          publicClient.readContract({
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: "getChannelInfo",
            args: [channelIdNum],
          }) as Promise<readonly [`0x${string}`, number, bigint, `0x${string}`]>,
          publicClient.readContract({
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: "getChannelParticipants",
            args: [channelIdNum],
          }) as Promise<readonly `0x${string}`[]>,
          publicClient.readContract({
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: "getChannelLeader",
            args: [channelIdNum],
          }) as Promise<`0x${string}`>,
        ]);

        const targetAddress = channelInfo[0];
        const state = channelInfo[1];
        const participantCount = Number(channelInfo[2]);

        setChannel({
          id: Number(channelId),
          targetAddress,
          state,
          participantCount,
          participants: participants.map(p => p.toLowerCase()),
          leader: leader.toLowerCase(),
        });

        // Get token info
        const isETH =
          targetAddress === ETH_TOKEN_ADDRESS ||
          targetAddress === "0x0000000000000000000000000000000000000001" ||
          targetAddress === "0x0000000000000000000000000000000000000000";

        if (!isETH && targetAddress !== "0x0000000000000000000000000000000000000000") {
          const [tokenDecimals, tokenSymbol] = await Promise.all([
            publicClient.readContract({
              address: targetAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "decimals",
            }),
            publicClient.readContract({
              address: targetAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "symbol",
            }),
          ]);

          setDecimals(Number(tokenDecimals) || 18);
          setSymbol(String(tokenSymbol) || 'TOKEN');
        } else {
          setDecimals(18);
          setSymbol('ETH');
        }
      } catch (error) {
        console.error('Error fetching channel data:', error);
      }
    };

    fetchChannelData();
  }, [publicClient, channelId]);

  // Fetch participant balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicClient || !channel || channel.participants.length === 0) return;

      try {
        // Get initial deposits
        const depositPromises = channel.participants.map((participant: string) =>
          publicClient.readContract({
            address: ROLLUP_BRIDGE_CORE_ADDRESS,
            abi: ROLLUP_BRIDGE_CORE_ABI,
            functionName: "getParticipantDeposit",
            args: [BigInt(channel.id), participant as `0x${string}`],
          })
        );

        const initialDeposits = await Promise.all(depositPromises);

        // Get latest snapshot
        const latestSnapshot = await getLatestSnapshot(channelId);

        const balances: ParticipantBalance[] = channel.participants.map(
          (participant: string, idx: number) => {
            const initialDeposit = (initialDeposits[idx] as bigint) || BigInt(0);
            const initialDepositFormatted = parseFloat(formatUnits(initialDeposit, decimals)).toFixed(2);

            let currentBalance = initialDepositFormatted;
            if (latestSnapshot?.userBalances) {
              const userBalance = latestSnapshot.userBalances.find(
                (ub: any) => ub.userAddressL1?.toLowerCase() === participant.toLowerCase()
              );
              if (userBalance?.amount) {
                currentBalance = parseFloat(formatUnits(BigInt(userBalance.amount), decimals)).toFixed(2);
              }
            }

            // Get new balance from proof analysis if available
            let newBalance: string | undefined = undefined;
            let hasChange = false;
            
            if (proofAnalysis && proofAnalysis.balances[idx]) {
              const proofBalance = proofAnalysis.balances[idx];
              newBalance = parseFloat(formatUnits(BigInt(proofBalance.balance), decimals)).toFixed(2);
              hasChange = newBalance !== currentBalance;
            }

            return {
              address: participant,
              initialDeposit: initialDepositFormatted,
              currentBalance: currentBalance, // This is the "Before" balance from latest approved state
              newBalance: newBalance, // From proof file analysis
              symbol: symbol,
              decimals: decimals,
              hasChange: hasChange,
            };
          }
        );

        setParticipantBalances(balances);
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    };

    fetchBalances();
  }, [publicClient, channel, channelId, decimals, symbol, proofAnalysis]);

  if (isLoading || !proof) {
    return (
      <Layout title="Loading Proof..." subtitle="Fetching proof data...">
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  const config = statusConfig[proof.status];
  const Icon = config.icon;
  const proofDisplayId = proof.proofId || `#${proof.id || proofId}`;

  return (
    <Layout 
      title={`Proof ${proofDisplayId}`}
      subtitle={config.description}
    >
      <div className="p-4 pb-20">
        <div className="max-w-6xl w-full mx-auto">
          {/* Back Button */}
          <Button 
            variant="outline" 
            className="mb-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30 text-white hover:border-[#4fc3f7] hover:bg-[#1a2347]"
            onClick={() => router.push(`/state-explorer?channelId=${channelId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Explorer
          </Button>

          {/* Header Card */}
          <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7] p-6 mb-6 shadow-lg shadow-[#4fc3f7]/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Proof {proofDisplayId}</h2>
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
              <div className="text-2xl font-bold text-[#4fc3f7]">#{channelId}</div>
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
                {proof.submitter?.slice(0, 10)}...{proof.submitter?.slice(-8)}
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

            {participantBalances.length === 0 ? (
              <div className="text-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <div className="space-y-4">
                {participantBalances.map((participant, index) => {
                  const hasChange = participant.hasChange && participant.newBalance !== undefined;
                  
                  return (
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
                      {hasChange ? (
                        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                          {/* Before - Current State Balance from main page */}
                          <div className="bg-[#1a2347] border border-[#4fc3f7]/20 p-4 rounded">
                            <div className="text-xs text-gray-500 mb-2">Before (Latest Approved State)</div>
                            <div className="flex items-center gap-2 mb-1">
                              <Coins className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-400">{participant.symbol}</span>
                            </div>
                            <div className="text-xl font-mono text-gray-300">
                              {participant.currentBalance}
                            </div>
                          </div>

                          {/* Arrow */}
                          <div className="flex justify-center">
                            <ArrowRight className="w-6 h-6 text-[#4fc3f7]" />
                          </div>

                          {/* After - From proof file analysis (address only for now) */}
                          <div className="bg-[#1a2347] border border-green-500/30 p-4 rounded">
                            <div className="text-xs text-green-400 mb-2">After (From Proof)</div>
                            <div className="flex items-center gap-2 mb-1">
                              <Coins className="w-4 h-4 text-green-400" />
                              <span className="text-sm font-medium text-green-400">{participant.symbol}</span>
                            </div>
                            <div className="text-xl font-mono font-semibold text-green-400">
                              {isAnalyzingProof ? 'Analyzing...' : (participant.newBalance || 'N/A')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // No Change - Show current balance only
                        <div className="bg-[#1a2347] border border-[#4fc3f7]/20 p-4 rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Coins className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-400">{participant.symbol}</span>
                              </div>
                              <div className="text-xl font-mono text-gray-300">
                                {participant.currentBalance}
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
                  );
                })}
              </div>
            )}
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
                onClick={async () => {
                  if (!proof.zipFile?.content) {
                    window.alert('ZIP file not found. The proof may not have a ZIP file uploaded.');
                    return;
                  }

                  try {
                    // Convert base64 to Blob
                    const base64Content = proof.zipFile.content;
                    const binaryString = atob(base64Content);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    const blob = new Blob([bytes], { type: 'application/zip' });

                    // Create download link
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = proof.zipFile.fileName || `proof-${proof.proofId || proof.id || 'unknown'}.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error('Error downloading ZIP file:', error);
                    window.alert('Failed to download ZIP file. Please try again.');
                  }
                }}
                disabled={!proof.zipFile?.content}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-[#4fc3f7] hover:bg-[#029bee] text-white rounded transition-all hover:shadow-lg hover:shadow-[#4fc3f7]/30 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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

