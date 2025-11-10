'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DKGAutomatedCeremonyModal } from './DKGAutomatedCeremonyModal';
import { Crown, Users } from 'lucide-react';

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

interface DKGSessionsListProps {
  sessions: DKGSession[];
  address: string | undefined;
  activeTab: string;
  frostIdMap: Record<string, string>;
  joinedSessions: Set<string>;
  onSelectSession: (session: DKGSession) => void;
  onViewMore: (session: DKGSession) => void;
  onRefreshSession: (sessionId: string) => void;
  onSubmitRound1: (session: DKGSession) => void;
  onSubmitRound2: (session: DKGSession) => void;
  onSubmitFinalization: (session: DKGSession) => void;
  onStartAutomatedCeremony?: (sessionId: string) => Promise<boolean>;
  isSubmittingRound1: boolean;
  isSubmittingRound2: boolean;
  isSubmittingFinalize: boolean;
  authState: {
    isAuthenticated: boolean;
  };
  wsConnection: WebSocket | null;
}

export function DKGSessionsList({
  sessions,
  address,
  activeTab,
  frostIdMap,
  joinedSessions,
  onSelectSession,
  onViewMore,
  onRefreshSession,
  onSubmitRound1,
  onSubmitRound2,
  onSubmitFinalization,
  onStartAutomatedCeremony,
  isSubmittingRound1,
  isSubmittingRound2,
  isSubmittingFinalize,
  authState,
  wsConnection
}: DKGSessionsListProps) {
  const [showAutomatedModal, setShowAutomatedModal] = useState(false);
  const [selectedAutomatedSession, setSelectedAutomatedSession] = useState<DKGSession | null>(null);
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

  const getActionButton = (session: DKGSession) => {
    console.log(`🔍 [DEBUG] getActionButton for session ${session.id}:`, {
      automationMode: session.automationMode,
      status: session.status,
      myRole: session.myRole,
      onStartAutomatedCeremony: !!onStartAutomatedCeremony
    });
    
    // For automatic sessions, show "Run Automated Ceremony" button for creators in Round 1
    if (session.automationMode === 'automatic') {
      if (session.status === 'round1' && session.myRole === 'creator') {
        console.log(`🎯 [DEBUG] Rendering Run Automated Ceremony button for session ${session.id}`);
        return (
          <Button
            onClick={(e) => {
              console.log(`🚀 [DEBUG] Run Automated Ceremony button clicked for session ${session.id}`);
              e.preventDefault();
              e.stopPropagation();
              setSelectedAutomatedSession(session);
              setShowAutomatedModal(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2"
            disabled={false}
            type="button"
          >
            Run Automated Ceremony
          </Button>
        );
      }
      if (session.status === 'round1') {
        return (
          <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 font-medium px-6 py-2 rounded-md">
            🤖 Waiting for creator to start...
          </div>
        );
      }
      if (session.status === 'round2') {
        return (
          <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 font-medium px-6 py-2 rounded-md">
            🤖 Auto-processing Round 2...
          </div>
        );
      }
      if (session.status === 'finalizing') {
        return (
          <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 font-medium px-6 py-2 rounded-md">
            🤖 Auto-finalizing...
          </div>
        );
      }
    }

    // Manual session actions
    if (session.status === 'round1' && !frostIdMap[session.id]) {
      return (
        <Button
          onClick={() => onRefreshSession(session.id)}
          className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-6 py-2"
        >
          🔄 Refresh Session
        </Button>
      );
    }

    if (session.status === 'round1' && frostIdMap[session.id]) {
      return (
        <Button
          onClick={() => onSubmitRound1(session)}
          disabled={isSubmittingRound1 || !authState.isAuthenticated}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 disabled:opacity-50"
        >
          {isSubmittingRound1 ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Submitting...
            </div>
          ) : (
            <>🔐 Submit Commitment</>
          )}
        </Button>
      );
    }

    if (session.status === 'round2') {
      return (
        <Button
          onClick={() => onSubmitRound2(session)}
          disabled={isSubmittingRound2 || !authState.isAuthenticated}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2"
        >
          {isSubmittingRound2 ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Submitting...
            </div>
          ) : (
            <>🔒 Submit Encrypted Share</>
          )}
        </Button>
      );
    }

    if (session.status === 'finalizing') {
      return (
        <Button
          onClick={() => onSubmitFinalization(session)}
          disabled={isSubmittingFinalize || !authState.isAuthenticated}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2"
        >
          {isSubmittingFinalize ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Finalizing...
            </div>
          ) : (
            <>Finalize Submit</>
          )}
        </Button>
      );
    }

    if (session.status === 'completed') {
      return (
        <Button
          onClick={() => onSelectSession(session)}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2"
        >
          📋 View Details
        </Button>
      );
    }

    return null;
  };

  const renderSessionCard = (session: DKGSession) => (
    <div key={session.id} className={`border border-gray-200 dark:border-gray-600 rounded-lg p-4 ${
      session.myRole === 'creator' 
        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30'
        : 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Session {session.id}</h4>
            <Badge className={getStatusColor(session.status)}>
              {getStatusText(session.status)}
            </Badge>
            <Badge className={session.myRole === 'creator' 
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
            }>
              {session.myRole === 'creator' ? 'Creator' : 'Participant'}
            </Badge>
{session.automationMode && (
              <Badge className={session.automationMode === 'automatic'
                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
              }>
                {session.automationMode === 'automatic' ? '🤖 Auto' : '👤 Manual'}
              </Badge>
            )}
          </div>
          
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <div>FROST ID: {frostIdMap[session.id] || 'Not assigned'}</div>
            <div>Participants: {session.currentParticipants}/{session.maxSigners}</div>
            <div>Threshold: {session.minSigners} of {session.maxSigners}</div>
            <div>Created: {session.createdAt.toLocaleDateString()}</div>
            {session.description && <div>Description: {session.description}</div>}
          </div>

          {session.status === 'round1' && !frostIdMap[session.id] && (
            <div className="mt-2">
              <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">
                ⚠️ FROST ID missing - Click refresh to sync with server
              </div>
            </div>
          )}
        </div>

        <div className="ml-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewMore(session)}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            👁️ View More
          </Button>
          {getActionButton(session)}
        </div>
      </div>
    </div>
  );

  let content;

  if (activeTab === 'active') {
    content = (
      <div className="space-y-6">
        {/* Sessions Created by Me */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Sessions Created by Me
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sessions.filter(s => s.myRole === 'creator' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).length} active sessions
            </div>
          </div>
          
          {sessions.filter(s => s.myRole === 'creator' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-400">No active sessions created by you</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Create a session to start coordinating DKG ceremonies
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.filter(s => s.myRole === 'creator' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).map(renderSessionCard)}
            </div>
          )}
        </Card>

        {/* Sessions Joined as Participant */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Sessions as Participant
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sessions.filter(s => s.myRole === 'participant' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status) && joinedSessions.has(s.id)).length} joined sessions
            </div>
          </div>
          
          {sessions.filter(s => s.myRole === 'participant' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status) && joinedSessions.has(s.id)).length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-400">No sessions joined as participant</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Join an existing session to participate in DKG ceremonies
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.filter(s => s.myRole === 'participant' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status) && joinedSessions.has(s.id)).map(renderSessionCard)}
            </div>
          )}
        </Card>
      </div>
    );
  } else {
    // History view
    content = (
      <div className="space-y-6">
        {/* Sessions Created by Me - History */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Sessions Created by Me
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sessions.filter(s => s.myRole === 'creator').length} total sessions
            </div>
          </div>
          
          {sessions.filter(s => s.myRole === 'creator').length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-400">No sessions created by you</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.filter(s => s.myRole === 'creator').map(renderSessionCard)}
            </div>
          )}
        </Card>

        {/* Sessions Joined as Participant - History */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Sessions Joined as Participant
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sessions.filter(s => s.myRole === 'participant' && joinedSessions.has(s.id)).length} total sessions
            </div>
          </div>
          
          {sessions.filter(s => s.myRole === 'participant' && joinedSessions.has(s.id)).length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-400">No sessions joined as participant</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.filter(s => s.myRole === 'participant' && joinedSessions.has(s.id)).map(renderSessionCard)}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Common return for both views with modal
  return (
    <>
      {content}
      
      {/* Automated Ceremony Modal */}
      <DKGAutomatedCeremonyModal
        isOpen={showAutomatedModal}
        session={selectedAutomatedSession}
        onClose={() => {
          setShowAutomatedModal(false);
          setSelectedAutomatedSession(null);
        }}
        onStartCeremony={onStartAutomatedCeremony || (async () => false)}
      />
    </>
  );
}