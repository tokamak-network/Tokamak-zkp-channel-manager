'use client';

import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  Package,
  Download,
  ExternalLink,
  CheckCircle2,
  Users,
  Layers,
  FileJson,
  AlertCircle,
  Copy,
  ArrowRight,
} from 'lucide-react';
import {
  getChannel,
  getActiveChannels,
  getLatestSnapshot,
  getChannelUserBalances,
  getChannelParticipants,
  getData,
} from '@/lib/realtime-db-helpers';
import type { Channel, StateSnapshot, UserBalance, Participant } from '@/lib/firebase-types';

interface TransactionBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultChannelId?: string;
}

interface BundleData {
  channel: Channel | null;
  snapshot: StateSnapshot | null;
  balances: UserBalance[];
  participants: Participant[];
}

export function TransactionBundleModal({
  isOpen,
  onClose,
  defaultChannelId,
}: TransactionBundleModalProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(defaultChannelId || '');
  const [bundleData, setBundleData] = useState<BundleData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-select default channel when modal opens
  useEffect(() => {
    if (isOpen && defaultChannelId) {
      setSelectedChannelId(defaultChannelId);
    }
  }, [isOpen, defaultChannelId]);

  // Fetch bundle data when channel is selected
  useEffect(() => {
    if (selectedChannelId) {
      fetchBundleData(selectedChannelId);
    }
  }, [selectedChannelId]);

  const fetchBundleData = async (channelId: string) => {
    setIsLoading(true);
    setError(null);
    setDownloadComplete(false);

    try {
      const [channel, snapshot, balances, participants] = await Promise.all([
        getChannel(channelId),
        getLatestSnapshot(channelId),
        getChannelUserBalances(channelId),
        getChannelParticipants(channelId),
      ]);

      setBundleData({
        channel,
        snapshot,
        balances,
        participants,
      });
    } catch (err) {
      console.error('Failed to fetch bundle data:', err);
      setError('Failed to load channel data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedChannelId) {
      setError('No channel selected');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      // Fetch data if not already loaded
      let channel = bundleData?.channel;
      let snapshot = bundleData?.snapshot;
      let balances = bundleData?.balances || [];
      let participants = bundleData?.participants || [];

      if (!channel) {
        try {
          channel = await getChannel(selectedChannelId);
        } catch (err) {
          console.warn('Failed to load channel from Firebase:', err);
        }
      }
      if (!snapshot) {
        try {
          snapshot = await getLatestSnapshot(selectedChannelId);
        } catch (err) {
          console.warn('Failed to load snapshot:', err);
        }
      }
      if (balances.length === 0) {
        try {
          balances = await getChannelUserBalances(selectedChannelId);
        } catch (err) {
          console.warn('Failed to load balances:', err);
        }
      }
      if (participants.length === 0) {
        try {
          participants = await getChannelParticipants(selectedChannelId);
        } catch (err) {
          console.warn('Failed to load participants:', err);
        }
      }

      const zip = new JSZip();

      // Check if verifiedProofs exists and has content
      let verifiedProofs = null;
      let hasVerifiedProofs = false;
      try {
        verifiedProofs = await getData<any[]>(`channels/${selectedChannelId}/verifiedProofs`);
        hasVerifiedProofs = verifiedProofs && Array.isArray(verifiedProofs) && verifiedProofs.length > 0;
      } catch (err) {
        console.warn('Failed to check verifiedProofs:', err);
      }

      // If verifiedProofs folder is empty or doesn't exist, create channel-info.json only
      if (!hasVerifiedProofs) {
        // Get initializationTxHash from Firebase - try multiple paths and ID formats
        let initializationTxHash = null;
        
        // Try from channel object first
        if (channel?.initializationTxHash) {
          initializationTxHash = channel.initializationTxHash;
        }
        
        // Try from initialProof object in channel data
        if (!initializationTxHash && channel?.initialProof?.initializationTxHash) {
          initializationTxHash = channel.initialProof.initializationTxHash;
        }
        
        // Try from getChannel with current ID format
        if (!initializationTxHash) {
          try {
            const channelData = await getChannel(selectedChannelId);
            initializationTxHash = channelData?.initializationTxHash || channelData?.initialProof?.initializationTxHash || null;
          } catch (err) {
            console.warn('Failed to get channel data with ID:', selectedChannelId, err);
          }
        }
        
        // Try from initialProof object path
        if (!initializationTxHash) {
          try {
            const initialProofData = await getData<any>(`channels/${selectedChannelId}/initialProof`);
            if (initialProofData?.initializationTxHash) {
              initializationTxHash = initialProofData.initializationTxHash;
            }
          } catch (err) {
            console.warn('Failed to get initializationTxHash from initialProof:', err);
          }
        }
        
        // Try direct path access with current ID
        if (!initializationTxHash) {
          try {
            const directData = await getData<string>(`channels/${selectedChannelId}/initializationTxHash`);
            initializationTxHash = directData || null;
          } catch (err) {
            console.warn('Failed to get initializationTxHash from direct path:', err);
          }
        }
        
        // Try with numeric ID if current is string
        if (!initializationTxHash && !isNaN(Number(selectedChannelId))) {
          try {
            const numericId = Number(selectedChannelId);
            const channelData = await getChannel(String(numericId));
            initializationTxHash = channelData?.initializationTxHash || channelData?.initialProof?.initializationTxHash || null;
          } catch (err) {
            console.warn('Failed to get channel data with numeric ID:', err);
          }
        }
        
        // Try from initialProof object with numeric ID
        if (!initializationTxHash && !isNaN(Number(selectedChannelId))) {
          try {
            const numericId = Number(selectedChannelId);
            const initialProofData = await getData<any>(`channels/${numericId}/initialProof`);
            if (initialProofData?.initializationTxHash) {
              initializationTxHash = initialProofData.initializationTxHash;
            }
          } catch (err) {
            console.warn('Failed to get initializationTxHash from initialProof with numeric ID:', err);
          }
        }
        
        // Try direct path access with numeric ID
        if (!initializationTxHash && !isNaN(Number(selectedChannelId))) {
          try {
            const numericId = Number(selectedChannelId);
            const directData = await getData<string>(`channels/${numericId}/initializationTxHash`);
            initializationTxHash = directData || null;
          } catch (err) {
            console.warn('Failed to get initializationTxHash from numeric path:', err);
          }
        }

        if (initializationTxHash) {
          const channelInfo = {
            initializedTxHash: initializationTxHash,
          };
          zip.file('channel-info.json', JSON.stringify(channelInfo, null, 2));
        } else {
          // More helpful error message
          const errorMsg = `Could not find initialization transaction hash for channel ${selectedChannelId}. The channel may not have been initialized yet. Please ensure the channel has been initialized on the blockchain.`;
          console.error(errorMsg, {
            channelId: selectedChannelId,
            channelIdType: typeof selectedChannelId,
            numericId: Number(selectedChannelId),
            channelData: channel,
            verifiedProofs: hasVerifiedProofs,
          });
          throw new Error(errorMsg);
        }
      } else {
        // If verifiedProofs exists, don't create the bundle
        throw new Error('Verified proofs already exist. No bundle needed.');
      }

      // Generate and download
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tokamak-channel-${channel?.channelId || selectedChannelId}-state-v${snapshot?.sequenceNumber || 0}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadComplete(true);
    } catch (err) {
      console.error('Failed to create bundle:', err);
      setError('Failed to create bundle');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenDesktopApp = () => {
    // Try to open with custom protocol
    // This would need to be registered by the desktop app
    const customProtocolUrl = `tokamak-app://create-transaction`;
    
    // Try opening with custom protocol
    window.location.href = customProtocolUrl;
    
    // Fallback: Show instructions
    setTimeout(() => {
      // If we're still here, the protocol didn't work
      // The modal stays open so users can see the instructions
    }, 500);
  };

  const handleClose = () => {
    setDownloadComplete(false);
    setError(null);
    setBundleData(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="bg-[#4fc3f7] p-1.5 rounded">
              <Package className="h-4 w-4 text-white" />
            </div>
            Create Transaction Bundle
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Download the current state to create an offline transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Current Channel Display */}
          {selectedChannelId && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Channel</label>
              <div className="bg-[#0a1930] border border-[#4fc3f7]/30 rounded p-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#4fc3f7]" />
                  <span className="text-white font-mono">
                    Channel #{selectedChannelId}
                  </span>
                  {bundleData?.participants && (
                    <span className="text-gray-400 text-sm">
                      ({bundleData.participants.length} participants)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
              <span className="ml-3 text-gray-400">Loading channel data...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}


          {/* Download Button - Always show if channel is selected */}
          {selectedChannelId && !isLoading && (
            <div className="space-y-3">
              {bundleData?.channel && (
                <div className="bg-[#0a1930]/50 border border-[#4fc3f7]/20 rounded p-4 space-y-3">
                  <h4 className="text-sm font-medium text-[#4fc3f7] flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Bundle Contents
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <div className="text-gray-400 text-xs">State Version</div>
                      <div className="font-mono text-white">
                        #{bundleData.snapshot?.sequenceNumber || 'N/A'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-gray-400 text-xs">Merkle Root</div>
                      <div className="font-mono text-white text-xs truncate">
                        {bundleData.snapshot?.merkleRoot?.slice(0, 16) || 'N/A'}...
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-gray-400 text-xs flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Participants
                      </div>
                      <div className="font-medium text-white">
                        {bundleData.participants.length}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-gray-400 text-xs">Threshold</div>
                      <div className="font-medium text-white">
                        {bundleData.channel.threshold}/{bundleData.channel.participantCount}
                      </div>
                    </div>
                  </div>

                  {/* Files included */}
                  <div className="pt-2 border-t border-[#4fc3f7]/10">
                    <div className="text-xs text-gray-400 mb-2">Files included:</div>
                    <div className="flex flex-wrap gap-2">
                      {['channel.json', 'state.json', 'participants.json', 'balances.json'].map((file) => (
                        <span
                          key={file}
                          className="inline-flex items-center gap-1 bg-[#1a2347] px-2 py-0.5 rounded text-xs text-gray-300"
                        >
                          <FileJson className="w-3 h-3 text-[#4fc3f7]" />
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Download Button */}
              <Button
                onClick={handleDownload}
                disabled={isDownloading || !selectedChannelId}
                className="w-full bg-[#4fc3f7] hover:bg-[#4fc3f7]/80 text-[#0a1930] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating Bundle...
                  </>
                ) : downloadComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Downloaded!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download State Bundle (.zip)
                  </>
                )}
              </Button>

              {/* Post-download Instructions */}
              {downloadComplete && (
                <div className="space-y-3 pt-2">
                  <div className="h-px bg-[#4fc3f7]/20" />
                  
                  <div className="text-sm text-gray-300">
                    <div className="font-medium text-white mb-2 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-[#4fc3f7]" />
                      Next Steps
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-gray-400 text-xs ml-1">
                      <li>Open the <span className="text-[#4fc3f7]">Tokamak Desktop App</span></li>
                      <li>Drag and drop the downloaded <span className="text-white font-mono">.zip</span> file</li>
                      <li>Create and sign your transaction offline</li>
                      <li>Submit the signed transaction back to the network</li>
                    </ol>
                  </div>

                  {/* Open Desktop App Button */}
                  <Button
                    onClick={handleOpenDesktopApp}
                    variant="outline"
                    className="w-full border-[#4fc3f7]/30 text-[#4fc3f7] hover:bg-[#4fc3f7]/10"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Desktop App
                  </Button>

                  {/* Manual instructions fallback */}
                  <p className="text-xs text-gray-500 text-center">
                    Don't have the app?{' '}
                    <a
                      href="https://github.com/tokamak-network/desktop-app/releases"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#4fc3f7] hover:underline"
                    >
                      Download here
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* No channel selected or available */}
          {!isLoading && !selectedChannelId && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No channel selected</p>
              <p className="text-gray-500 text-xs mt-1">Please select a channel from the state explorer</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

