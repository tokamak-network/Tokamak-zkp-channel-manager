'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  myRole: 'creator' | 'participant';
  description?: string;
  participants: any[];
  roster: Array<[number, string, string]>;
  groupVerifyingKey?: string;
}

interface DKGSessionDetailsProps {
  session: DKGSession | null;
  onClose: () => void;
  onDownloadKeyShare: () => void;
}

export function DKGSessionDetails({
  session,
  onClose,
  onDownloadKeyShare
}: DKGSessionDetailsProps) {
  if (!session) return null;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Session Details
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Complete information about this DKG session
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">📋 Basic Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Session ID:</span>
                  <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{session.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <Badge className={getStatusColor(session.status)}>
                    {getStatusText(session.status)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Your Role:</span>
                  <Badge className={session.myRole === 'creator' 
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  }>
                    {session.myRole === 'creator' ? 'Creator' : 'Participant'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="text-gray-900 dark:text-gray-100">{session.createdAt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Group ID:</span>
                  <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{session.groupId}</span>
                </div>
                {session.topic && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Topic:</span>
                    <span className="text-gray-900 dark:text-gray-100">{session.topic}</span>
                  </div>
                )}
                {session.description && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 block mb-1">Description:</span>
                    <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      {session.description}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Threshold Configuration */}
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">⚙️ Threshold Configuration</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Participants:</span>
                  <span className="text-gray-900 dark:text-gray-100">{session.maxSigners}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current Joined:</span>
                  <span className="text-gray-900 dark:text-gray-100">{session.currentParticipants}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Required Signers:</span>
                  <span className="text-gray-900 dark:text-gray-100">{session.minSigners}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Scheme:</span>
                  <span className="text-gray-900 dark:text-gray-100">{session.minSigners}-of-{session.maxSigners} Threshold</span>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Participation Progress</span>
                    <span className="text-gray-900 dark:text-gray-100">{session.currentParticipants}/{session.maxSigners}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(session.currentParticipants / session.maxSigners) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Participants List */}
            <Card className="p-4 lg:col-span-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">👥 Participants</h3>
              {session.roster && session.roster.length > 0 ? (
                <div className="space-y-2">
                  {session.roster.map(([uid, idHex, ecdsaPubHex]) => (
                    <div key={uid} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Badge variant="outline">#{uid}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Participant {uid}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                          FROST ID: {idHex}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                          Public Key: {ecdsaPubHex}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-600 dark:text-gray-400">No participants information available</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Participant details will appear once the session starts
                  </p>
                </div>
              )}
            </Card>

            {/* Session Results */}
            {session.status === 'completed' && (
              <Card className="p-4 lg:col-span-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">🎉 Session Results</h3>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-600 dark:text-green-400 text-lg">✅</span>
                    <h4 className="font-medium text-green-800 dark:text-green-200">
                      DKG Ceremony Completed Successfully
                    </h4>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    All participants have successfully completed the distributed key generation process. 
                    The threshold signature scheme is now active with {session.minSigners}-of-{session.maxSigners} signing capability.
                  </p>
                </div>

                {session.groupVerifyingKey && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Group Verification Key</h4>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                      <span className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all select-all cursor-pointer">
                        {session.groupVerifyingKey}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      This is the group's public verification key. Use it to verify threshold signatures created by this group.
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={onDownloadKeyShare}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={!session.groupVerifyingKey}
                  >
                    🔑 Download Key Share (share_{session.id.slice(0, 8)}.json)
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Close Button */}
          <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}