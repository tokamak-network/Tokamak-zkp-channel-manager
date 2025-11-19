'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Plus, Trash2, AlertCircle, Info, Clipboard, AlertTriangle } from 'lucide-react';

interface DKGParticipant {
  uid: number;
  publicKey: string;
}

interface DKGSessionCreatorProps {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  authState: {
    isAuthenticated: boolean;
    publicKeyHex?: string;
  };
  isCreatingSession: boolean;
  onCreateSession: (params: {
    minSigners: number;
    maxSigners: number;
    participants: DKGParticipant[];
    automationMode: 'manual' | 'automatic';
  }) => void;
}

export function DKGSessionCreator({
  connectionStatus,
  authState,
  isCreatingSession,
  onCreateSession
}: DKGSessionCreatorProps) {
  const [minSigners, setMinSigners] = useState(2);
  const [maxSigners, setMaxSigners] = useState(3);
  const [participants, setParticipants] = useState<DKGParticipant[]>([]);
  const [newParticipantPublicKey, setNewParticipantPublicKey] = useState('');
  const [automationMode] = useState<'manual' | 'automatic'>('manual'); // Always manual - automated mode requires separate spawner service

  const handleAddParticipant = () => {
    if (!newParticipantPublicKey || participants.length >= maxSigners) {
      return;
    }

    // Check for duplicate public keys
    const isDuplicate = participants.some(p => p.publicKey.toLowerCase() === newParticipantPublicKey.toLowerCase());
    if (isDuplicate) {
      alert('This public key has already been added. Duplicate public keys are not allowed.');
      return;
    }

    // Simple session-local UID assignment (1, 2, 3, ...)
    const uniqueUid = participants.length + 1;
    
    const newParticipant: DKGParticipant = {
      uid: uniqueUid,
      publicKey: newParticipantPublicKey
    };
    setParticipants(prev => [...prev, newParticipant]);
    setNewParticipantPublicKey('');
  };
  
  const handleAddMyself = () => {
    if (!authState.publicKeyHex) {
      alert('Please authenticate first to add your own public key');
      return;
    }
    
    const isDuplicate = participants.some(p => p.publicKey.toLowerCase() === authState.publicKeyHex!.toLowerCase());
    if (isDuplicate) {
      alert('Your public key is already in the participants list');
      return;
    }
    
    if (participants.length >= maxSigners) {
      alert('Cannot add more participants - max signers limit reached');
      return;
    }
    
    const uniqueUid = participants.length + 1;
    const newParticipant: DKGParticipant = {
      uid: uniqueUid,
      publicKey: authState.publicKeyHex
    };
    setParticipants(prev => [...prev, newParticipant]);
  };

  const handleRemoveParticipant = (uid: number) => {
    setParticipants(prev => prev.filter(p => p.uid !== uid));
  };

  const handleCreateSession = () => {
    onCreateSession({
      minSigners,
      maxSigners,
      participants,
      automationMode
    });
    
    // Reset form after successful creation
    setTimeout(() => {
      setParticipants([]);
      setNewParticipantPublicKey('');
    }, 500);
  };

  const canCreateSessions = connectionStatus === 'connected'; // Must be connected to server

  return (
    <Card className="p-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30">
      <h2 className="text-2xl font-bold mb-6 text-white">Create DKG Session</h2>
      
      {/* Workflow Info Card */}
      {canCreateSessions && (
        <Card className="p-4 mb-6 bg-blue-900/20 border-blue-500/30">
          <h3 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-1.5">
            <Clipboard className="w-4 h-4" />
            How to Create a Multi-Party Session
          </h3>
          <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
            <li>Set your threshold configuration (min/max signers)</li>
            <li><strong className="text-blue-300">Click "Add Myself as Participant"</strong> to add your own public key</li>
            <li><strong className="text-blue-300">Get public keys from other participants</strong> and add them using the input field below</li>
            <li>Once all {'{maxSigners}'} participants are added, click "Create Session"</li>
            <li>Share the Session ID with all participants so they can join</li>
          </ol>
          <p className="text-xs text-yellow-400 mt-2 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Important: All participant public keys must be added BEFORE creating the session. Only wallets in the roster can join!
          </p>
        </Card>
      )}
      
      {!canCreateSessions ? (
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-2 font-medium">You must be connected to a DKG server to create sessions</p>
          <p className="text-sm text-gray-400">
            Status: {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Connect to the server above to start coordinating DKG ceremonies
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Session Parameters */}
          <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/20 p-5 rounded">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-[#4fc3f7]" />
              Threshold Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Min Signers (Threshold)
                </label>
                <Input
                  type="number"
                  min="2"
                  max={maxSigners}
                  value={minSigners}
                  onChange={(e) => setMinSigners(parseInt(e.target.value) || 2)}
                  placeholder="Minimum required signatures"
                  className="bg-black/40 border-[#4fc3f7]/30 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum signatures needed</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Max Signers (Total Participants)
                </label>
                <Input
                  type="number"
                  min={minSigners}
                  max="10"
                  value={maxSigners}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value) || 3;
                    setMaxSigners(newMax);
                    if (minSigners > newMax) setMinSigners(newMax);
                  }}
                  placeholder="Maximum participants"
                  className="bg-black/40 border-[#4fc3f7]/30 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">Total number of participants</p>
              </div>
            </div>
          </div>

          {/* Automation Mode - Hidden (always manual mode) */}
          {/* Automatic mode requires a separate spawner service on port 9000 which is not deployed */}

          {/* Participants Section */}
          <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/20 p-5 rounded">
            <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
              <User className="w-5 h-5 text-[#4fc3f7]" />
              Participants ({participants.length}/{maxSigners})
            </h3>
            
            {/* Quick Add Myself Button */}
            <div className="mb-4">
              <Button
                onClick={handleAddMyself}
                disabled={
                  !authState.publicKeyHex || 
                  participants.length >= maxSigners ||
                  participants.some(p => p.publicKey.toLowerCase() === authState.publicKeyHex?.toLowerCase())
                }
                className="w-full bg-[#028bee] hover:bg-[#0277d4] text-white flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" />
                Add Myself as Participant
              </Button>
              {!authState.publicKeyHex && (
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Authenticate first to add your own public key
                </p>
              )}
            </div>
            
            {/* Add Participant */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Participant Public Key (compressed format)"
                  value={newParticipantPublicKey}
                  onChange={(e) => setNewParticipantPublicKey(e.target.value)}
                  className="font-mono text-sm bg-black/40 border-[#4fc3f7]/30 text-white placeholder:text-gray-500"
                />
                {newParticipantPublicKey && participants.some(p => p.publicKey.toLowerCase() === newParticipantPublicKey.toLowerCase()) && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    This public key has already been added
                  </p>
                )}
              </div>
              <Button
                onClick={handleAddParticipant}
                disabled={
                  !newParticipantPublicKey || 
                  participants.length >= maxSigners ||
                  participants.some(p => p.publicKey.toLowerCase() === newParticipantPublicKey.toLowerCase())
                }
                className="bg-[#4fc3f7] hover:bg-[#028bee] text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>

            {/* Participants List */}
            {participants.length > 0 ? (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.uid} className="flex items-center gap-3 p-3 bg-black/30 border border-[#4fc3f7]/10 hover:border-[#4fc3f7]/30 rounded transition-all">
                    <Badge className="bg-[#4fc3f7]/20 text-[#4fc3f7] border-[#4fc3f7]/30">
                      #{participant.uid}
                    </Badge>
                    <span className="font-mono text-xs text-gray-300 flex-1 truncate">
                      {participant.publicKey}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveParticipant(participant.uid)}
                      className="text-red-400 border-red-500/30 hover:bg-red-900/20 hover:border-red-500/50 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">
                No participants added yet. Add at least {minSigners} participants to create a session.
              </div>
            )}
          </div>

          {/* Session Configuration Preview */}
          {participants.length >= minSigners && (
            <div className="bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 p-4 rounded">
              <h4 className="font-semibold mb-3 text-[#4fc3f7] flex items-center gap-2">
                <Info className="w-4 h-4" />
                Session Ready
              </h4>
              <div className="text-sm space-y-2 text-gray-300">
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#4fc3f7] rounded-full"></span>
                  Threshold: <span className="font-semibold text-white">{minSigners}</span> of <span className="font-semibold text-white">{maxSigners}</span> signatures required
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#4fc3f7] rounded-full"></span>
                  Participants: <span className="font-semibold text-white">{participants.length}/{maxSigners}</span> registered
                </p>
                {/* Mode display hidden - always manual */}
              </div>
            </div>
          )}

          {/* Create Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleCreateSession}
              disabled={participants.length < minSigners || isCreatingSession || connectionStatus !== 'connected'}
              className="min-w-[200px] bg-[#028bee] hover:bg-[#0277d4] text-white font-semibold h-11 shadow-lg shadow-[#028bee]/20"
            >
              {isCreatingSession ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating Session...
                </div>
              ) : (
                'Create Session'
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}