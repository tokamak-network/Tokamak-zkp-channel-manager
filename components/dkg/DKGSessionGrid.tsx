'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Clock, 
  Play, 
  Pause, 
  CheckCircle, 
  AlertCircle, 
  RotateCcw,
  Eye,
  UserPlus,
  Zap,
  Settings,
  MoreHorizontal,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { StatusLight } from '@/components/ui/status-indicator';
import { CopyButton, CopyableText } from '@/components/ui/copy-button';
import { useToast } from '@/components/ui/toast';

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

interface DKGSessionGridProps {
  sessions: DKGSession[];
  address?: string;
  onJoinSession: (sessionId: string) => void;
  onViewDetails: (session: DKGSession) => void;
  onStartAutomation: (sessionId: string) => void;
  onRefreshSession: (sessionId: string) => void;
  onDownloadKey: (session: DKGSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  isJoiningSession: boolean;
  authState: any;
  wsConnection: WebSocket | null;
}

export function DKGSessionGrid({
  sessions,
  address,
  onJoinSession,
  onViewDetails,
  onStartAutomation,
  onRefreshSession,
  onDownloadKey,
  onDeleteSession,
  isJoiningSession,
  authState,
  wsConnection
}: DKGSessionGridProps) {
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30';
      case 'round1': return 'text-orange-400 bg-orange-400/20 border-orange-400/30';
      case 'round2': return 'text-blue-400 bg-blue-400/20 border-blue-400/30';
      case 'finalizing': return 'text-purple-400 bg-purple-400/20 border-purple-400/30';
      case 'completed': return 'text-green-400 bg-green-400/20 border-green-400/30';
      case 'failed': return 'text-red-400 bg-red-400/20 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/20 border-gray-400/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting': return Clock;
      case 'round1': 
      case 'round2': 
      case 'finalizing': return Play;
      case 'completed': return CheckCircle;
      case 'failed': return AlertCircle;
      default: return Clock;
    }
  };

  const canJoinSession = (session: DKGSession) => {
    // Check if user is in the session participants list (by public key)
    const userPublicKey = authState.publicKeyHex;
    const isInParticipantsList = userPublicKey && session.participants.some(
      participant => participant.publicKey === userPublicKey
    );
    
    return session.status === 'waiting' && 
           session.currentParticipants < session.maxSigners &&
           authState.isAuthenticated &&
           isInParticipantsList && // Only show join if user is in the roaster
           session.myRole !== 'participant'; // Don't show join if already joined
  };

  const canStartAutomation = (session: DKGSession) => {
    return session.myRole === 'creator' && 
           session.status === 'waiting' &&
           session.currentParticipants >= session.minSigners;
  };

  const canDownloadKey = (session: DKGSession) => {
    return session.status === 'completed' && session.groupVerifyingKey;
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const handleBulkAction = (action: string) => {
    if (selectedSessions.size === 0) {
      showToast({
        type: 'warning',
        title: 'No sessions selected',
        message: 'Please select sessions first'
      });
      return;
    }

    switch (action) {
      case 'refresh':
        selectedSessions.forEach(sessionId => onRefreshSession(sessionId));
        showToast({
          type: 'success',
          title: `Refreshing ${selectedSessions.size} session(s)`
        });
        break;
      case 'delete':
        if (onDeleteSession && confirm(`Delete ${selectedSessions.size} selected session(s)?`)) {
          selectedSessions.forEach(sessionId => onDeleteSession(sessionId));
          setSelectedSessions(new Set());
        }
        break;
    }
  };

  if (sessions.length === 0) {
    return (
      <Card className="p-12 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30">
        <div className="text-center">
          <div className="w-20 h-20 bg-[#4fc3f7]/10 border-2 border-dashed border-[#4fc3f7]/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-[#4fc3f7]/50" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No DKG Sessions</h3>
          <p className="text-gray-400 mb-6">Create a new session or join an existing one to get started</p>
          <div className="flex items-center justify-center gap-4">
            <Button 
              onClick={() => showToast({ type: 'info', title: 'Switch to Create tab to start a new session' })}
              className="bg-[#028bee] hover:bg-[#0277d4]"
            >
              <Play className="w-4 h-4 mr-2" />
              Create Session
            </Button>
            <Button 
              variant="outline"
              onClick={() => showToast({ type: 'info', title: 'Switch to Join tab to find existing sessions' })}
              className="border-[#4fc3f7]/30 hover:border-[#4fc3f7]"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Join Session
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bulk Actions */}
      {selectedSessions.size > 0 && (
        <Card className="p-4 bg-[#4fc3f7]/10 border-[#4fc3f7]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className="bg-[#4fc3f7]/20 text-[#4fc3f7]">
                {selectedSessions.size} selected
              </Badge>
              <span className="text-sm text-gray-300">
                Choose an action for selected sessions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('refresh')}
                className="border-[#4fc3f7]/30"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              {onDeleteSession && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSessions(new Set())}
                className="text-gray-400"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {sessions.map((session) => {
          const StatusIcon = getStatusIcon(session.status);
          const statusColors = getStatusColor(session.status);
          const isSelected = selectedSessions.has(session.id);
          const progress = session.maxSigners > 0 ? (session.currentParticipants / session.maxSigners) * 100 : 0;

          return (
            <Card
              key={session.id}
              className={`
                relative p-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#4fc3f7]/20 cursor-pointer
                ${isSelected ? 'border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/30' : 'border-[#4fc3f7]/30 hover:border-[#4fc3f7]/60'}
              `}
              onClick={() => toggleSessionSelection(session.id)}
            >
              {/* Selection Indicator */}
              <div className="absolute top-4 right-4">
                <div className={`
                  w-5 h-5 rounded-full border-2 transition-all
                  ${isSelected ? 'bg-[#4fc3f7] border-[#4fc3f7]' : 'border-gray-500'}
                `}>
                  {isSelected && <CheckCircle className="w-3 h-3 text-white m-0.5" />}
                </div>
              </div>

              {/* Header */}
              <div className="mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-5 h-5 ${statusColors.split(' ')[0]}`} />
                    <Badge className={`${statusColors} text-xs font-medium`}>
                      {session.status}
                    </Badge>
                    {session.myRole === 'creator' && (
                      <Badge variant="outline" className="text-xs border-yellow-400/30 text-yellow-400">
                        Creator
                      </Badge>
                    )}
                  </div>
                  {session.automationMode === 'automatic' && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs text-purple-300">
                      <Zap className="w-3 h-3" />
                      Auto
                    </div>
                  )}
                </div>

                {/* Session ID */}
                <div className="mb-2">
                  <CopyableText 
                    text={session.id}
                    truncate={true}
                    maxLength={12}
                    className="text-white font-mono"
                  />
                </div>

                {/* Group ID */}
                <div className="text-sm text-gray-400">
                  Group: {session.groupId}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Participants</span>
                  <span className="text-xs font-medium text-white">
                    {session.currentParticipants}/{session.maxSigners}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#0a1930] border border-[#4fc3f7]/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#4fc3f7] to-[#028bee] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Threshold Info */}
              <div className="mb-4 text-sm text-gray-300">
                <div className="flex items-center gap-4">
                  <span>Threshold: {session.minSigners}-of-{session.maxSigners}</span>
                  <span>•</span>
                  <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div 
                className="flex items-center gap-2 mt-4"
                onClick={(e) => e.stopPropagation()} // Prevent card selection when clicking buttons
              >
                {canJoinSession(session) && (
                  <Button
                    size="sm"
                    onClick={() => onJoinSession(session.id)}
                    disabled={isJoiningSession}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Join
                  </Button>
                )}

                {canStartAutomation(session) && (
                  <Button
                    size="sm"
                    onClick={() => onStartAutomation(session.id)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    Start
                  </Button>
                )}

                {canDownloadKey(session) && (
                  <Button
                    size="sm"
                    onClick={() => onDownloadKey(session)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails(session)}
                  className="border-[#4fc3f7]/30 hover:border-[#4fc3f7]"
                >
                  <Eye className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRefreshSession(session.id)}
                  className="text-gray-400 hover:text-white"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              {/* Status Indicator at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-60">
                {session.status === 'completed' && (
                  <div className="h-full bg-gradient-to-r from-green-400 to-green-600" />
                )}
                {session.status === 'failed' && (
                  <div className="h-full bg-gradient-to-r from-red-400 to-red-600" />
                )}
                {['round1', 'round2', 'finalizing'].includes(session.status) && (
                  <div className="h-full bg-gradient-to-r from-[#4fc3f7] to-[#028bee] animate-pulse" />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Statistics */}
      <Card className="p-4 bg-gradient-to-r from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30">
        <div className="flex items-center justify-between text-sm text-gray-300">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span>{sessions.filter(s => s.status === 'completed').length} Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#4fc3f7] rounded-full animate-pulse" />
              <span>{sessions.filter(s => ['round1', 'round2', 'finalizing'].includes(s.status)).length} Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <span>{sessions.filter(s => s.status === 'waiting').length} Waiting</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span>{sessions.filter(s => s.status === 'failed').length} Failed</span>
            </div>
          </div>
          <div className="text-white font-medium">
            Total: {sessions.length} sessions
          </div>
        </div>
      </Card>
    </div>
  );
}