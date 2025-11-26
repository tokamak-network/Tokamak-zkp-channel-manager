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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>(defaultChannelId || '');
  const [bundleData, setBundleData] = useState<BundleData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available channels on mount
  useEffect(() => {
    if (isOpen) {
      fetchChannels();
    }
  }, [isOpen]);

  // Fetch bundle data when channel is selected
  useEffect(() => {
    if (selectedChannelId) {
      fetchBundleData(selectedChannelId);
    }
  }, [selectedChannelId]);

  const fetchChannels = async () => {
    try {
      const activeChannels = await getActiveChannels();
      setChannels(activeChannels);
      
      // Auto-select first channel if no default
      if (!defaultChannelId && activeChannels.length > 0) {
        setSelectedChannelId(activeChannels[0].channelId);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
      setError('Failed to load channels');
    }
  };

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
    if (!bundleData?.channel) return;

    setIsDownloading(true);
    setError(null);

    try {
      const zip = new JSZip();

      // Create bundle metadata
      const metadata = {
        bundleVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        channelId: bundleData.channel.channelId,
        stateVersion: bundleData.snapshot?.sequenceNumber || 0,
        participantCount: bundleData.participants.length,
        bundleType: 'transaction_creation',
      };

      // Add files to zip
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      zip.file('channel.json', JSON.stringify(bundleData.channel, null, 2));
      
      if (bundleData.snapshot) {
        zip.file('state.json', JSON.stringify(bundleData.snapshot, null, 2));
      }
      
      zip.file('participants.json', JSON.stringify(bundleData.participants, null, 2));
      zip.file('balances.json', JSON.stringify(bundleData.balances, null, 2));

      // Add a README for the desktop app
      const readme = `# Tokamak Channel State Bundle

This bundle contains the current state of channel ${bundleData.channel.channelId}.

## Contents
- metadata.json: Bundle metadata and version info
- channel.json: Channel configuration and settings
- state.json: Latest verified state snapshot
- participants.json: Channel participants info
- balances.json: Current user balances

## Usage
1. Open the Tokamak Desktop App
2. Drag and drop this zip file into the app
3. Create and sign your transaction

## Bundle Info
- Created: ${metadata.createdAt}
- State Version: ${metadata.stateVersion}
- Participants: ${metadata.participantCount}
`;
      zip.file('README.md', readme);

      // Generate and download
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tokamak-channel-${bundleData.channel.channelId}-state-v${bundleData.snapshot?.sequenceNumber || 0}.zip`;
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
          {/* Channel Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Select Channel</label>
            <Select
              value={selectedChannelId}
              onValueChange={setSelectedChannelId}
            >
              <SelectTrigger className="bg-[#0a1930] border-[#4fc3f7]/30 text-white">
                <SelectValue placeholder="Select a channel..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2347] border-[#4fc3f7]/30 text-white">
                {channels.map((channel) => (
                  <SelectItem key={channel.channelId} value={channel.channelId}>
                    Channel #{channel.channelId.slice(0, 8)}... ({channel.participantCount} participants)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          {/* Bundle Preview */}
          {bundleData?.channel && !isLoading && (
            <div className="space-y-3">
              {/* State Info Card */}
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

              {/* Download Button */}
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full bg-[#4fc3f7] hover:bg-[#4fc3f7]/80 text-[#0a1930] font-medium"
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

          {/* No channels available */}
          {!isLoading && channels.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No active channels found</p>
              <p className="text-gray-500 text-xs mt-1">Create a channel first to generate transaction bundles</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

