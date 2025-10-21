'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface DKGSession {
  id: string;
  creator: string;
  minSigners: number;
  maxSigners: number;
  currentParticipants: number;
  status: 'waiting' | 'round1' | 'round2' | 'finalizing' | 'completed' | 'failed';
  groupId: string;
  topic: string;
  createdAt: Date;
  myRole?: 'creator' | 'participant';
  description?: string;
  participants: any[];
  roster: Array<[number, string, string]>;
  groupVerifyingKey?: string;
  automationMode?: 'manual' | 'automatic';
}

interface DKGSessionDetailsModalProps {
  session: DKGSession | null;
  isOpen: boolean;
  onClose: () => void;
  onDownloadKeyShare?: () => void;
  frostIdMap?: Record<string, string>;
  isNewlyCreated?: boolean; // Special styling/messaging for newly created sessions
}

export function DKGSessionDetailsModal({
  session,
  isOpen,
  onClose,
  onDownloadKeyShare,
  frostIdMap = {},
  isNewlyCreated = false
}: DKGSessionDetailsModalProps) {
  if (!isOpen || !session) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'round1': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'round2': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'finalizing': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return 'Waiting for Participants';
      case 'round1': return 'Round 1: Commitments';
      case 'round2': return 'Round 2: Secret Shares';
      case 'finalizing': return 'Finalizing';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {isNewlyCreated && (
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30">
                <span className="text-lg">🎉</span>
              </div>
            )}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {isNewlyCreated ? 'Session Created Successfully!' : 'Session Details'}
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </Button>
        </div>

        {isNewlyCreated && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-200 mb-2">
              🎉 Your DKG session has been created! Share the Session ID below with participants to get started.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* Session Overview */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <span>📋</span> Session Overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Session ID
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-gray-100 select-all flex-1">
                    {session.id}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(session.id)}
                    className="px-2 py-1 h-7"
                  >
                    📋
                  </Button>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Status
                </label>
                <div className="mt-1">
                  <Badge className={getStatusColor(session.status)}>
                    {getStatusText(session.status)}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Your Role
                </label>
                <div className="mt-1">
                  <Badge className={session.myRole === 'creator' 
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  }>
                    {session.myRole === 'creator' ? '👑 Creator' : '🤝 Participant'}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Created
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {session.createdAt.toLocaleDateString()} at {session.createdAt.toLocaleTimeString()}
                </div>
              </div>

              {frostIdMap[session.id] && (
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    FROST Identifier
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-gray-100 select-all flex-1">
                      {frostIdMap[session.id]}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(frostIdMap[session.id])}
                      className="px-2 py-1 h-7"
                    >
                      📋
                    </Button>
                  </div>
                </div>
              )}

              {session.description && (
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Description
                  </label>
                  <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {session.description}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Threshold Configuration */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <span>⚙️</span> Threshold Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {session.minSigners}
                </div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Required Signers
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {session.maxSigners}
                </div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Maximum Signers
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {session.currentParticipants}
                </div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Current Participants
                </div>
              </div>
            </div>
            
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              <p>
                📝 This session requires <strong>{session.minSigners}</strong> signatures out of <strong>{session.maxSigners}</strong> participants to create valid threshold signatures.
              </p>
            </div>
          </Card>

          {/* Participants */}
          {session.roster && session.roster.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <span>👥</span> Participants ({session.roster.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {session.roster.map(([uid, participantId, publicKey], index) => (
                  <div key={uid} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Badge variant="outline" className="shrink-0">
                      #{uid}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        ID: {participantId}
                      </div>
                      <div className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">
                        {publicKey}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(publicKey)}
                      className="px-2 py-1 h-7 shrink-0"
                    >
                      📋
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Group Verifying Key (for completed sessions) */}
          {session.status === 'completed' && session.groupVerifyingKey && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <span>🔐</span> Group Verifying Key
              </h3>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-gray-900 dark:text-gray-100 select-all flex-1 break-all">
                  {session.groupVerifyingKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(session.groupVerifyingKey!)}
                  className="px-2 py-1 shrink-0"
                >
                  📋
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Close
          </Button>
          
          {session.status === 'completed' && onDownloadKeyShare && (
            <Button
              onClick={onDownloadKeyShare}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              📥 Download Key Share
            </Button>
          )}
          
          {isNewlyCreated && (
            <Button
              onClick={() => copyToClipboard(session.id)}
              className="flex-1"
            >
              📋 Copy Session ID
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}