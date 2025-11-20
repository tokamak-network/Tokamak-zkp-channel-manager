'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { XCircle, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';

interface DKGSessionJoinerProps {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  authState: {
    isAuthenticated: boolean;
  };
  isJoiningSession: boolean;
  successMessage: string;
  error: string;
  onJoinSession: (sessionId: string) => void;
  onDismissSuccess: () => void;
}

export function DKGSessionJoiner({
  connectionStatus,
  authState,
  isJoiningSession,
  successMessage,
  error,
  onJoinSession,
  onDismissSuccess
}: DKGSessionJoinerProps) {
  const [sessionToJoin, setSessionToJoin] = useState('');

  const handleJoinSession = () => {
    if (sessionToJoin.trim()) {
      onJoinSession(sessionToJoin.trim());
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Join DKG Session</h2>
      
      {connectionStatus !== 'connected' ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">You must be connected to a DKG server to join sessions</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Connect to the server above to participate in existing DKG ceremonies
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-6">
            <Input
              placeholder="Session ID provided by creator (e.g., e2bb7be0-f196-4ce5-8a48-f9e892b6d88b)"
              value={sessionToJoin}
              onChange={(e) => setSessionToJoin(e.target.value)}
              className="flex-1 font-mono text-sm"
              disabled={isJoiningSession}
            />
            <Button 
              onClick={handleJoinSession}
              disabled={!sessionToJoin || isJoiningSession || !authState.isAuthenticated}
              className="min-w-[140px]"
            >
              {isJoiningSession ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Joining...
                </div>
              ) : (
                'Join Session'
              )}
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {successMessage}
              </p>
            </div>
          )}

          {/* Prerequisites Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
            <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Prerequisites
            </h4>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <p className={`flex items-center gap-2 ${authState.isAuthenticated ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {authState.isAuthenticated ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                Authentication: {authState.isAuthenticated ? 'Completed' : 'Required'}
              </p>
              <p className={`flex items-center gap-2 ${connectionStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {connectionStatus === 'connected' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                Server Connection: {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </p>
              <p>• Your public key must be registered in the session by the creator</p>
              <p>• You must be one of the designated participants</p>
            </div>
          </div>
          
          {/* What Happens After Joining */}
          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              What Happens After Joining
            </h4>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <p>1. <strong>Waiting Phase:</strong> You'll wait for all other participants to join</p>
              <p>2. <strong>Round 1:</strong> DKG starts automatically when everyone is present</p>
              <p>3. <strong>Round 2:</strong> Secret sharing phase (encrypted)</p>
              <p>4. <strong>Finalization:</strong> Key generation completes</p>
              <p className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <strong>Important:</strong> DKG rounds cannot start until ALL participants have joined the session
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}