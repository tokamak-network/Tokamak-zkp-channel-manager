'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { CheckCircle, Copy, X, Users, Key, Download, Hash } from 'lucide-react';

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
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  if (!isOpen || !session) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
      case 'round1': return 'bg-[#4fc3f7]/20 text-[#4fc3f7] border border-[#4fc3f7]/30';
      case 'round2': return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      case 'finalizing': return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
      case 'completed': return 'bg-green-500/20 text-green-300 border border-green-500/30';
      case 'failed': return 'bg-red-500/20 text-red-300 border border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
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

  const copyToClipboard = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItems(prev => new Set(prev).add(itemId));
    setTimeout(() => {
      setCopiedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }, 2000);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 shadow-2xl shadow-[#4fc3f7]/20 max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1a2347] to-[#1a2347]/95 backdrop-blur-sm border-b border-[#4fc3f7]/30 p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isNewlyCreated && (
                <div className="flex items-center justify-center h-12 w-12 bg-green-500/20 border border-green-500/50 animate-pulse">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">
                    {isNewlyCreated ? 'Session Created!' : 'Session Details'}
                  </h2>
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium ${getStatusColor(session.status)}`}>
                    {getStatusText(session.status)}
                  </span>
                  {session.myRole && (
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium ${
                      session.myRole === 'creator' 
                        ? "bg-[#4fc3f7]/20 text-[#4fc3f7] border border-[#4fc3f7]/30"
                        : "bg-green-500/20 text-green-300 border border-green-500/30"
                    }`}>
                      {session.myRole === 'creator' ? 'Creator' : 'Participant'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Threshold: <span className="text-white font-medium">{session.minSigners}/{session.maxSigners}</span> signers
                  {session.currentParticipants > 0 && (
                    <span className="ml-3">• Participants: <span className="text-white font-medium">{session.currentParticipants}</span></span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-10 w-10 text-gray-400 hover:text-white hover:bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 hover:border-[#4fc3f7]/50 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isNewlyCreated && (
          <div className="mx-6 mt-6 p-4 bg-green-500/10 border border-green-500/30 backdrop-blur-sm animate-in slide-in-from-top duration-500">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-300 font-medium">Success!</p>
                <p className="text-sm text-green-200/80 mt-1">
                  Share the Session ID below with participants to start the DKG ceremony.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Session ID - Compact Single Line */}
          <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/20 p-4">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#4fc3f7] shrink-0" />
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider shrink-0">
                Session ID
              </label>
              <code className="text-xs font-mono border border-[#4fc3f7]/20 px-2 py-1.5 text-[#4fc3f7] truncate flex-1">
                {session.id}
              </code>
              <button
                onClick={() => copyToClipboard(session.id, 'session-id')}
                className="flex items-center justify-center h-8 w-8 bg-[#4fc3f7]/10 hover:bg-[#4fc3f7]/20 border border-[#4fc3f7]/30 hover:border-[#4fc3f7]/50 text-[#4fc3f7] transition-all shrink-0"
              >
                {copiedItems.has('session-id') ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* FROST Identifier - Only if exists */}
          {frostIdMap[session.id] && (
            <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/20 p-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#4fc3f7] shrink-0" />
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider shrink-0">
                  FROST ID
                </label>
                <code className="text-xs font-mono border border-[#4fc3f7]/20 px-2 py-1.5 text-[#4fc3f7] truncate flex-1">
                  {frostIdMap[session.id]}
                </code>
                <button
                  onClick={() => copyToClipboard(frostIdMap[session.id], 'frost-id')}
                  className="flex items-center justify-center h-8 w-8 bg-[#4fc3f7]/10 hover:bg-[#4fc3f7]/20 border border-[#4fc3f7]/30 hover:border-[#4fc3f7]/50 text-[#4fc3f7] transition-all shrink-0"
                >
                  {copiedItems.has('frost-id') ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}


          {/* Participants */}
          {session.roster && session.roster.length > 0 && (
            <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/20 p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#4fc3f7]" />
                Participants ({session.roster.length})
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#4fc3f7]/20 scrollbar-track-transparent">
                {session.roster.map(([uid, participantId, publicKey], index) => (
                  <div key={uid} className="flex items-center gap-3 p-3 border border-[#4fc3f7]/10 hover:border-[#4fc3f7]/30 transition-all">
                    <span className="flex items-center justify-center h-8 w-8 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 text-[#4fc3f7] text-xs font-bold shrink-0">
                      #{uid}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-400 mb-1">
                        ID: {participantId}
                      </div>
                      <div className="text-xs font-mono text-gray-300 truncate">
                        {publicKey}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(publicKey, `participant-${uid}`)}
                      className="flex items-center justify-center h-8 w-8 bg-[#4fc3f7]/10 hover:bg-[#4fc3f7]/20 border border-[#4fc3f7]/30 hover:border-[#4fc3f7]/50 text-[#4fc3f7] transition-all shrink-0"
                    >
                      {copiedItems.has(`participant-${uid}`) ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group Verifying Key (for completed sessions) */}
          {session.status === 'completed' && session.groupVerifyingKey && (
            <div className="bg-green-500/5 border border-green-500/30 p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-green-400" />
                Group Verifying Key
              </h3>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-black/40 border border-green-500/20 px-3 py-2 text-green-300 select-all flex-1 break-all">
                  {session.groupVerifyingKey}
                </code>
                <button
                  onClick={() => copyToClipboard(session.groupVerifyingKey!, 'group-key')}
                  className="flex items-center justify-center h-9 w-9 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-400 transition-all shrink-0"
                >
                  {copiedItems.has('group-key') ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-gradient-to-t from-[#1a2347] to-[#1a2347]/95 backdrop-blur-sm border-t border-[#4fc3f7]/30 p-6">
          <div className="flex gap-3">
            {isNewlyCreated && (
              <button
                onClick={() => copyToClipboard(session.id, 'footer-session-id')}
                className="flex-1 h-11 flex items-center justify-center gap-2 bg-[#028bee] hover:bg-[#0277d4] text-white font-semibold transition-all shadow-lg shadow-[#028bee]/20"
              >
                {copiedItems.has('footer-session-id') ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Session ID
                  </>
                )}
              </button>
            )}
            
            {session.status === 'completed' && onDownloadKeyShare && (
              <button
                onClick={onDownloadKeyShare}
                className="flex-1 h-11 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium transition-all"
              >
                <Download className="w-4 h-4" />
                Download Key Share
              </button>
            )}
            
            <button
              onClick={onClose}
              className="flex-1 h-11 flex items-center justify-center gap-2 bg-transparent hover:bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 hover:border-[#4fc3f7]/50 text-white font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}