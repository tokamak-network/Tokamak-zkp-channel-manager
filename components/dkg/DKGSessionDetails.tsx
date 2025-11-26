'use client';

import { Clipboard, Users, CheckCircle2, Key, ChevronDown, ChevronUp } from 'lucide-react';
import { formatFrostId } from '@/lib/utils';
import { useState } from 'react';

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
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  
  if (!session) return null;

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

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[100] p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal - Matching App Theme */}
      <div className="relative z-[101] bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 shadow-2xl shadow-[#4fc3f7]/20 w-full max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-none sm:rounded-lg animate-in slide-in-from-bottom-4 duration-300">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1a2347] to-[#1a2347]/95 backdrop-blur-sm border-b border-[#4fc3f7]/30 p-4 sm:p-6 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                Session Details
              </h2>
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium mt-2 ${getStatusColor(session.status)}`}>
                {getStatusText(session.status)}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 text-gray-400 hover:text-white hover:bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 hover:border-[#4fc3f7]/50 transition-all shrink-0"
            >
              <span className="text-lg">✕</span>
            </button>
          </div>
        </div>
        
        <div className="p-4 sm:p-6">

          {/* Essential Information - Always Visible */}
          <div className="space-y-3 sm:space-y-4">
            {/* Quick Summary Card */}
            <div className="p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Your Role</div>
                  <div className="text-sm font-semibold text-white">
                    {session.myRole === 'creator' ? '👑 Creator' : '👤 Participant'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Participants</div>
                  <div className="text-sm font-semibold text-[#4fc3f7]">
                    {session.currentParticipants}/{session.maxSigners}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Threshold</div>
                  <div className="text-sm font-semibold text-[#4fc3f7]">
                    {session.minSigners}-of-{session.maxSigners}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Created</div>
                  <div className="text-sm font-semibold text-white">
                    {session.createdAt.toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Details - Collapsible */}
            <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/20 rounded-lg p-4">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="w-full flex items-center justify-between text-left hover:bg-[#4fc3f7]/10 p-2 -m-2 rounded transition-colors"
              >
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Clipboard className="w-4 h-4 text-[#4fc3f7]" />
                  Technical Details
                </h3>
                {showTechnicalDetails ? (
                  <ChevronUp className="w-5 h-5 text-[#4fc3f7]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#4fc3f7]" />
                )}
              </button>
              
              {showTechnicalDetails && (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 p-3 bg-black/30 border border-[#4fc3f7]/10 rounded">
                    <span className="text-gray-400 font-medium">Session ID:</span>
                    <span className="font-mono text-xs sm:text-sm text-[#4fc3f7] break-all">
                      {session.id}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 p-3">
                    <span className="text-gray-400 font-medium">Group ID:</span>
                    <span className="font-mono text-xs text-gray-300 break-all">
                      {session.groupId}
                    </span>
                  </div>
                  {session.topic && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 p-3 bg-black/30 border border-[#4fc3f7]/10 rounded">
                      <span className="text-gray-400 font-medium">Topic:</span>
                      <span className="text-gray-300 break-all">{session.topic}</span>
                    </div>
                  )}
                  {session.description && (
                    <div className="p-2">
                      <span className="text-gray-400 font-medium block mb-1">Description:</span>
                      <p className="text-gray-300 text-xs p-2 rounded border border-[#4fc3f7]/20 bg-black/20">
                        {session.description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Participants - Collapsible */}
            {session.roster && session.roster.length > 0 && (
              <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/20 rounded-lg p-4">
                <button
                  onClick={() => setShowParticipants(!showParticipants)}
                  className="w-full flex items-center justify-between text-left hover:bg-[#4fc3f7]/10 p-2 -m-2 rounded transition-colors"
                >
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#4fc3f7]" />
                    Participants ({session.roster.length})
                  </h3>
                  {showParticipants ? (
                    <ChevronUp className="w-5 h-5 text-[#4fc3f7]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#4fc3f7]" />
                  )}
                </button>
                
                {showParticipants && (
                  <div className="mt-4 space-y-2 max-h-48 sm:max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#4fc3f7]/20 scrollbar-track-transparent">
                    {session.roster.map(([uid, idHex, ecdsaPubHex]) => (
                      <div key={uid} className="p-3 border border-[#4fc3f7]/10 rounded-lg bg-black/20 hover:border-[#4fc3f7]/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 text-[#4fc3f7] text-xs font-bold rounded">
                            #{uid}
                          </span>
                          <span className="text-sm font-medium text-white">
                            Participant {uid}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-col">
                            <span className="text-gray-400 mb-0.5">FROST ID:</span>
                            <span className="font-mono text-gray-300 break-all">{formatFrostId(idHex)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-400 mb-0.5">Public Key:</span>
                            <span className="font-mono text-gray-300 break-all">{ecdsaPubHex}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Session Results - Always Visible for Completed Sessions */}
            {session.status === 'completed' && (
              <div className="p-4 border-2 border-green-500/30 bg-green-500/5 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <h3 className="font-semibold text-green-300">
                    ✅ DKG Ceremony Completed
                  </h3>
                </div>
                <p className="text-sm text-green-200/90 mb-4">
                  The threshold signature scheme is active with {session.minSigners}-of-{session.maxSigners} signing capability.
                </p>

                {session.groupVerifyingKey && (
                  <div className="p-3 bg-black/40 rounded border border-green-500/20">
                    <div className="text-xs text-gray-400 mb-1 font-medium flex items-center gap-2">
                      <Key className="w-3 h-3 text-green-400" />
                      Group Verification Key
                    </div>
                    <span className="font-mono text-xs text-green-300 break-all select-all block">
                      {session.groupVerifyingKey}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 bg-gradient-to-t from-[#1a2347] to-[#1a2347]/95 backdrop-blur-sm border-t border-[#4fc3f7]/30 p-4 sm:p-6 -m-4 sm:-m-6 mt-6 sm:mt-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {session.status === 'completed' && (
                <button
                  onClick={onDownloadKeyShare}
                  disabled={!session.groupVerifyingKey}
                  className="flex-1 h-10 sm:h-11 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium transition-all text-sm sm:text-base rounded"
                >
                  <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Download Key Share
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 h-10 sm:h-11 flex items-center justify-center gap-2 bg-transparent hover:bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 hover:border-[#4fc3f7]/50 text-white font-medium transition-all text-sm sm:text-base rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}