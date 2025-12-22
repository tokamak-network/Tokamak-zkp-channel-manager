'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatFrostId } from '@/lib/utils';
// import { DKGAutomatedCeremonyModal } from './DKGAutomatedCeremonyModal'; // Disabled - requires spawner service
import { Crown, Users, RefreshCw, Lock, LockKeyhole, FileText, Eye, AlertTriangle, User, Link2, ClipboardList, Upload } from 'lucide-react';

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
  _serverMissing?: boolean;
  _isJoining?: boolean; // Temporary flag to show joining state in UI
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
  onSubmitRound1?: (session: DKGSession) => void;  // Optional: automatic mode doesn't need this
  onSubmitRound2?: (session: DKGSession) => void;  // Optional: automatic mode doesn't need this
  onSubmitFinalization?: (session: DKGSession) => void;  // Optional: automatic mode doesn't need this
  onStartAutomatedCeremony?: (sessionId: string) => Promise<boolean>;
  onJoinSession?: (sessionId: string) => void;
  isSubmittingRound1: boolean;
  isSubmittingRound2: boolean;
  isSubmittingFinalize: boolean;
  isJoiningSession?: boolean;
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
  onJoinSession,
  isSubmittingRound1,
  isSubmittingRound2,
  isSubmittingFinalize,
  isJoiningSession,
  authState,
  wsConnection
}: DKGSessionsListProps) {
  // const [showAutomatedModal, setShowAutomatedModal] = useState(false); // Disabled
  // const [selectedAutomatedSession, setSelectedAutomatedSession] = useState<DKGSession | null>(null); // Disabled
  const [autoRefreshAttempts, setAutoRefreshAttempts] = useState<Record<string, number>>({});
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-refresh FROST IDs for sessions that are missing them
  useEffect(() => {
    // Initial delay before starting auto-refresh
    const initialTimer = setTimeout(() => {
      sessions.forEach(session => {
        // If session is in round1 or waiting and FROST ID is missing, trigger initial refresh
        if (
          (session.status === 'round1' || session.status === 'waiting') && 
          !frostIdMap[session.id] && 
          joinedSessions.has(session.id) &&
          wsConnection &&
          wsConnection.readyState === WebSocket.OPEN
        ) {
          console.log(`🔄 Initial FROST ID sync for session ${session.id.slice(0, 8)}`);
          onRefreshSession(session.id);
        }
      });
    }, 2000); // Wait 2 seconds after component mount/update

    // Periodic auto-refresh for sessions still missing FROST ID
    const intervalTimer = setInterval(() => {
      sessions.forEach(session => {
        const attempts = autoRefreshAttempts[session.id] || 0;
        
        // Auto-refresh if:
        // 1. Session is in round1 or waiting status
        // 2. FROST ID is still missing
        // 3. User has joined the session
        // 4. WebSocket is connected
        // 5. Haven't exceeded max retry attempts (20 attempts = ~60 seconds)
        if (
          (session.status === 'round1' || session.status === 'waiting') && 
          !frostIdMap[session.id] && 
          joinedSessions.has(session.id) &&
          wsConnection &&
          wsConnection.readyState === WebSocket.OPEN &&
          attempts < 20
        ) {
          console.log(`🔄 Auto-refreshing FROST ID for session ${session.id.slice(0, 8)} (attempt ${attempts + 1}/20)`);
          onRefreshSession(session.id);
          
          // Track attempts to avoid infinite loops
          setAutoRefreshAttempts(prev => ({
            ...prev,
            [session.id]: attempts + 1
          }));
        }
      });
    }, 3000); // Check every 3 seconds
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [sessions, frostIdMap, joinedSessions, wsConnection, onRefreshSession, autoRefreshAttempts]);

  // Reset auto-refresh attempts when FROST ID is successfully obtained
  useEffect(() => {
    Object.keys(frostIdMap).forEach(sessionId => {
      if (autoRefreshAttempts[sessionId]) {
        setAutoRefreshAttempts(prev => {
          const updated = { ...prev };
          delete updated[sessionId];
          return updated;
        });
        console.log(`✅ FROST ID obtained for session ${sessionId.slice(0, 8)}, stopping auto-refresh`);
      }
    });
  }, [frostIdMap, autoRefreshAttempts]);
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
    
    // NOTE: Automated mode disabled - requires separate spawner service on port 9000
    // All sessions now use manual mode only

    // Manual session actions
    
    // Waiting status - show Join button if not joined yet
    if (session.status === 'waiting') {
      const isCreator = session.myRole === 'creator';
      const hasJoined = joinedSessions.has(session.id);
      
      // If 0 participants OR user hasn't joined, show Join button
      // This ensures we always show Join button when currentParticipants is 0
      const shouldShowJoinButton = session.currentParticipants === 0 || !hasJoined;
      
      console.log('🔍 Session Join Button Logic:', {
        sessionId: session.id.slice(0, 8),
        status: session.status,
        currentParticipants: session.currentParticipants,
        maxSigners: session.maxSigners,
        isCreator,
        hasJoined,
        shouldShowJoinButton,
        hasOnJoinSession: !!onJoinSession
      });
      
      if (shouldShowJoinButton && onJoinSession) {
        return (
          <Button
            onClick={() => {
              console.log('🚀 Join Session button clicked for:', session.id);
              console.log('📤 Calling onJoinSession with sessionId:', session.id);
              onJoinSession(session.id);
            }}
            disabled={isJoiningSession || !authState.isAuthenticated}
            className={`w-full font-semibold h-10 shadow-md hover:shadow-lg transition-all disabled:opacity-50 ${
              isCreator 
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-400' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              {isJoiningSession ? 'Joining...' : (isCreator ? 'Join Your Session' : 'Join This Session')}
            </div>
          </Button>
        );
      }
      
      // Already joined (currentParticipants > 0 and user has joined), waiting for others
      // Check if this session is currently being joined (optimistic update)
      if (session._isJoining) {
        return (
          <div className="w-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-semibold h-10 rounded-md flex items-center justify-center gap-2 border border-blue-300 dark:border-blue-700 animate-pulse">
            <Link2 className="w-4 h-4" />
            Joining Session...
          </div>
        );
      }
      
        return (
        <div className="w-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-semibold h-10 rounded-md flex items-center justify-center gap-2 border border-amber-300 dark:border-amber-700">
          <Users className="w-4 h-4 animate-pulse" />
          Waiting for All Participants... ({session.currentParticipants}/{session.maxSigners})
          </div>
        );
    }

    // Note: Refresh button is now shown in the card layout itself
    if (session.status === 'round1' && !frostIdMap[session.id]) {
      return null; // Refresh button is in the card layout
    }

    if (session.status === 'round1' && frostIdMap[session.id]) {
      // If onSubmitRound1 is not provided, DKG is automatic
      if (!onSubmitRound1) {
        return (
          <div className="w-full text-center py-3 px-4 bg-blue-500/20 border border-blue-500/30 rounded-md">
            <div className="flex items-center justify-center gap-2 text-blue-300">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Round 1 processing automatically...</span>
            </div>
          </div>
        );
      }
      
      return (
        <Button
          onClick={() => onSubmitRound1(session)}
          disabled={isSubmittingRound1 || !authState.isAuthenticated}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isSubmittingRound1 ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Submitting...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Submit Round 1 Commitment
            </div>
          )}
        </Button>
      );
    }

    if (session.status === 'round2') {
      // If onSubmitRound2 is not provided, DKG is automatic
      if (!onSubmitRound2) {
        return (
          <div className="w-full text-center py-3 px-4 bg-purple-500/20 border border-purple-500/30 rounded-md">
            <div className="flex items-center justify-center gap-2 text-purple-300">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Round 2 processing automatically...</span>
            </div>
          </div>
        );
      }
      
      return (
        <Button
          onClick={() => onSubmitRound2(session)}
          disabled={isSubmittingRound2 || !authState.isAuthenticated}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold h-10 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isSubmittingRound2 ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Submitting...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <LockKeyhole className="w-4 h-4" />
              Submit Round 2 Encrypted Share
            </div>
          )}
        </Button>
      );
    }

    if (session.status === 'finalizing') {
      // If onSubmitFinalization is not provided, DKG is automatic
      if (!onSubmitFinalization) {
        return (
          <div className="w-full text-center py-3 px-4 bg-green-500/20 border border-green-500/30 rounded-md">
            <div className="flex items-center justify-center gap-2 text-green-300">
              <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Finalizing automatically...</span>
            </div>
          </div>
        );
      }
      
      return (
        <Button
          onClick={() => onSubmitFinalization(session)}
          disabled={isSubmittingFinalize || !authState.isAuthenticated}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-10 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isSubmittingFinalize ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Finalizing...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Finalize & Generate Keys
            </div>
          )}
        </Button>
      );
    }

    if (session.status === 'completed') {
      return (
        <Button
          onClick={() => onSelectSession(session)}
          className="w-full bg-[#4fc3f7] hover:bg-[#4fc3f7]/90 text-white font-semibold h-10 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Post Key On-Chain
        </Button>
      );
    }

    return null;
  };

  const renderSessionCard = (session: DKGSession) => (
    <div key={session.id} className={`border-2 rounded-xl p-5 transition-all hover:shadow-lg ${
      session._serverMissing
        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 opacity-80'
        : session.myRole === 'creator' 
        ? 'bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800'
        : 'bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-green-900/20 border-green-200 dark:border-green-800'
    }`}>
      {/* Server Missing Warning - Only show for non-completed sessions */}
      {session._serverMissing && session.status !== 'completed' && (
        <div className="mb-4 p-3 bg-orange-100 dark:bg-orange-900/40 border-2 border-orange-400 dark:border-orange-600 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-orange-900 dark:text-orange-100">
                Session Not Found on Server
              </p>
              <p className="text-xs text-orange-800 dark:text-orange-200 mt-1">
                This session was lost from the server (likely due to restart). You may need to restart the DKG ceremony.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header with badges */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge className={`${getStatusColor(session.status)} text-xs font-semibold px-3 py-1`}>
              {getStatusText(session.status)}
            </Badge>
            <Badge className={`flex items-center gap-1.5 ${session.myRole === 'creator' 
              ? "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300 border-blue-300 dark:border-blue-600"
              : "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-300 border-green-300 dark:border-green-600"
              }`}>
              {session.myRole === 'creator' ? (
                  <>
                  <Crown className="w-3 h-3" />
                  Creator
                  </>
                ) : (
                  <>
                  <Users className="w-3 h-3" />
                  Participant
                  </>
                )}
              </Badge>
            {/* Automation mode badge hidden - all sessions are manual now */}
          </div>
          <h4 className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">
            {session.id}
          </h4>
        </div>
          </div>
          
      {/* FROST ID Warning (prominent if missing) */}
      {session.status === 'round1' && !frostIdMap[session.id] && (
        <div className="mb-4 p-3 bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-lg animate-pulse">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                Syncing FROST Identifier... {autoRefreshAttempts[session.id] ? `(${autoRefreshAttempts[session.id]}/20)` : ''}
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                {autoRefreshAttempts[session.id] >= 20 
                  ? '⚠️ Max attempts reached. Session may not exist on server. Try "Refresh Session" or create a new session.'
                  : 'Auto-refreshing every 3 seconds. If this persists, click "Refresh Session" below or check server logs.'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Session Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">FROST ID</p>
          <p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {frostIdMap[session.id] ? formatFrostId(frostIdMap[session.id]) : (
              <span className="text-orange-600 dark:text-orange-400">Not assigned</span>
            )}
          </p>
        </div>
        <div className={`bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 border border-gray-200 dark:border-gray-700 transition-all ${
          session._isJoining ? 'ring-2 ring-blue-400 ring-offset-2 animate-pulse' : ''
        }`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            Participants
            {session._isJoining && (
              <span className="text-blue-500 text-xs">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block"></div>
              </span>
            )}
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {session.currentParticipants}/{session.maxSigners}
          </p>
        </div>
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Threshold</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {session.minSigners || 0} of {session.maxSigners || 0}
          </p>
        </div>
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Created</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isMounted ? new Date(session.createdAt).toISOString().split('T')[0] : '-'}
          </p>
              </div>
            </div>

      {session.description && (
        <div className="mb-4 p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
          <p className="text-sm text-gray-900 dark:text-gray-100">{session.description}</p>
        </div>
      )}

      {/* Action Buttons - Stacked professionally */}
      <div className="flex flex-col gap-2 pt-3 border-t border-gray-300 dark:border-gray-600">
        {/* Top row - View More button only */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewMore(session)}
          className="w-full text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2 h-9"
        >
          <Eye className="w-4 h-4" />
          View Session Details
        </Button>
        
        {/* Refresh button for round1 sessions without FROST ID */}
        {session.status === 'round1' && !frostIdMap[session.id] && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRefreshSession(session.id)}
            className="w-full text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/30 border-orange-300 dark:border-orange-600 flex items-center justify-center gap-2 h-9"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Session
          </Button>
        )}
        
        {/* Primary action button (full width, below View More) */}
          {getActionButton(session)}
      </div>
    </div>
  );

  let content;

  if (activeTab === 'sessions') {
    // Only show sessions if authenticated
    if (!authState.isAuthenticated) {
      content = (
        <Card className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-2">You must be authenticated to view sessions</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Please authenticate using "Get My Public Key" above to see your DKG sessions
            </p>
          </div>
        </Card>
      );
    } else {
      // Show all sessions (no filtering)
      const allSessions = sessions;
      
      // Debug logging
      console.log('🔍 DKG Sessions Debug:', {
        totalSessions: sessions.length,
        sessionIds: sessions.map(s => s.id),
        sessionDetails: sessions.map(s => ({ 
          id: s.id.slice(0, 8), 
          myRole: s.myRole,
          creator: s.creator?.slice(0, 10),
          status: s.status,
          participants: s.currentParticipants + '/' + s.maxSigners
        })),
        creatorCount: sessions.filter(s => s.myRole === 'creator').length,
        participantJoinedCount: sessions.filter(s => s.myRole === 'participant' && joinedSessions.has(s.id)).length,
        availableCount: sessions.filter(s => !s.myRole || (s.myRole === 'participant' && !joinedSessions.has(s.id))).length,
        joinedSessionsSet: Array.from(joinedSessions)
      });
      
      content = (
        <div className="space-y-6">
          {/* Debug Info Card */}
          <details className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-300 dark:border-gray-600">
            <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">
              🐛 Debug Info: Session Filtering ({sessions.length} total sessions)
            </summary>
            <div className="mt-3 space-y-2 text-xs font-mono">
              <div className="bg-white dark:bg-gray-900 p-3 rounded">
                <p className="text-gray-700 dark:text-gray-300 mb-2"><strong>Total Sessions:</strong> {sessions.length}</p>
                <p className="text-green-600 dark:text-green-400"><strong>Creator Sessions:</strong> {sessions.filter(s => s.myRole === 'creator').length}</p>
                <p className="text-blue-600 dark:text-blue-400"><strong>Joined as Participant:</strong> {sessions.filter(s => s.myRole === 'participant' && joinedSessions.has(s.id)).length}</p>
                <p className="text-orange-600 dark:text-orange-400"><strong>Available to Join:</strong> {sessions.filter(s => !s.myRole || (s.myRole === 'participant' && !joinedSessions.has(s.id))).length}</p>
            </div>
              <div className="bg-white dark:bg-gray-900 p-3 rounded max-h-60 overflow-y-auto">
                {sessions.map((s, idx) => (
                  <div key={s.id} className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-gray-900 dark:text-gray-100">
                      <strong>{idx + 1}. {s.id.slice(0, 12)}...</strong>
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      myRole: <span className={s.myRole ? 'text-green-500' : 'text-red-500'}>{s.myRole || 'undefined'}</span>
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      creator: {s.creator?.slice(0, 12)}...
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      status: {s.status}, participants: {s.currentParticipants}/{s.maxSigners}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </details>

          {/* Sessions Created by Me */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                Sessions Created by Me
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {sessions.filter(s => s.myRole === 'creator').length} session{sessions.filter(s => s.myRole === 'creator').length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {sessions.filter(s => s.myRole === 'creator').length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-600 dark:text-gray-400">No sessions created by you</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Create your first DKG session using the "Create Session" tab
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.filter(s => s.myRole === 'creator').map(renderSessionCard)}
              </div>
            )}
          </Card>

          {/* Sessions Joined as Participant */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Sessions Joined as Participant
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {sessions.filter(s => s.myRole === 'participant' && joinedSessions.has(s.id)).length} session{sessions.filter(s => s.myRole === 'participant' && joinedSessions.has(s.id)).length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {sessions.filter(s => s.myRole === 'participant' && joinedSessions.has(s.id)).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-600 dark:text-gray-400">No sessions joined as participant</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Join a session using the "Join Session" tab or the button on session cards
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.filter(s => s.myRole === 'participant' && joinedSessions.has(s.id)).map(renderSessionCard)}
              </div>
            )}
          </Card>

          {/* Available Sessions (not yet joined) */}
          {sessions.filter(s => !s.myRole || (s.myRole === 'participant' && !joinedSessions.has(s.id))).length > 0 && (
            <Card className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-green-500" />
                  Available Sessions to Join
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {sessions.filter(s => !s.myRole || (s.myRole === 'participant' && !joinedSessions.has(s.id))).length} session{sessions.filter(s => !s.myRole || (s.myRole === 'participant' && !joinedSessions.has(s.id))).length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 These are sessions created by others. You can join them if there are open slots.
                </p>
              </div>
              <div className="space-y-3">
                {sessions.filter(s => !s.myRole || (s.myRole === 'participant' && !joinedSessions.has(s.id))).map(renderSessionCard)}
              </div>
            </Card>
          )}
        </div>
      );
    }
  }

  // Return directly
  return (
    <>
      {content}
      
      {/* Automated Ceremony Modal - Disabled (requires separate spawner service) */}
    </>
  );
}