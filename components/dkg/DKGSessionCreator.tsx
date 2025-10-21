'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DKGParticipant {
  uid: number;
  publicKey: string;
}

interface DKGSessionCreatorProps {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  authState: {
    isAuthenticated: boolean;
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
  const [automationMode, setAutomationMode] = useState<'manual' | 'automatic'>('automatic');

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
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Create DKG Session</h2>
      
      {!canCreateSessions ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">You must be connected to a DKG server to create sessions</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Status: {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Connect to the server above to start coordinating DKG ceremonies
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Session Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Min Signers
              </label>
              <Input
                type="number"
                min="2"
                max={maxSigners}
                value={minSigners}
                onChange={(e) => setMinSigners(parseInt(e.target.value) || 2)}
                placeholder="Minimum required signatures"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Max Signers
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
              />
            </div>
          </div>

          {/* Automation Mode Selection */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
              DKG Ceremony Mode
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  automationMode === 'automatic'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => setAutomationMode('automatic')}
              >
                <div className="flex items-center mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                    automationMode === 'automatic' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                  }`}>
                    {automationMode === 'automatic' && (
                      <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                    )}
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">🤖 Automatic</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 ml-7">
                  All DKG rounds are handled automatically. Participants just need to join - the ceremony runs without manual intervention.
                </p>
              </div>
              
              <div
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  automationMode === 'manual'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => setAutomationMode('manual')}
              >
                <div className="flex items-center mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                    automationMode === 'manual' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                  }`}>
                    {automationMode === 'manual' && (
                      <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                    )}
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">👤 Manual</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 ml-7">
                  Participants manually submit each DKG round. Provides full control over the ceremony process.
                </p>
              </div>
            </div>
          </div>

          {/* Participants Section */}
          <div>
            <h3 className="font-medium mb-3 text-gray-900 dark:text-gray-100">
              Participants ({participants.length}/{maxSigners})
            </h3>
            
            {/* Add Participant */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Public Key (0x...)"
                  value={newParticipantPublicKey}
                  onChange={(e) => setNewParticipantPublicKey(e.target.value)}
                  className="font-mono text-sm"
                />
                {newParticipantPublicKey && participants.some(p => p.publicKey.toLowerCase() === newParticipantPublicKey.toLowerCase()) && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    ⚠️ This public key has already been added
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
              >
                Add Participant
              </Button>
            </div>

            {/* Participants List */}
            {participants.length > 0 && (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.uid} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Badge variant="outline">#{participant.uid}</Badge>
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">
                      {participant.publicKey}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveParticipant(participant.uid)}
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleCreateSession}
              disabled={participants.length < minSigners || isCreatingSession || connectionStatus !== 'connected'}
              className="min-w-[200px]"
            >
              {isCreatingSession ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </div>
              ) : (
                connectionStatus === 'connected' ? 'Create Session' : 'Create Session (Demo)'
              )}
            </Button>
          </div>

          {/* Session Configuration Preview */}
          {participants.length >= minSigners && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">Session Configuration</h4>
              <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <p>• Threshold: {minSigners} of {maxSigners} signatures required</p>
                <p>• Participants: {participants.length}/{maxSigners} registered</p>
                <p>• Role: You will be the session creator</p>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}