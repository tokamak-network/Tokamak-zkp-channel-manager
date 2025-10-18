'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DKGConnectionStatusProps {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  serverUrl: string;
  setServerUrl: (url: string) => void;
  connectToServer: () => void;
  authState: {
    isAuthenticated: boolean;
    userId: string | null;
    publicKeyHex: string | null;
    challenge: string | null;
  };
  onRequestChallenge: () => void;
  onGetPublicKey: () => void;
  onAuthenticate: () => void;
  onClearAuth: () => void;
}

export function DKGConnectionStatus({
  connectionStatus,
  serverUrl,
  setServerUrl,
  connectToServer,
  authState,
  onRequestChallenge,
  onGetPublicKey,
  onAuthenticate,
  onClearAuth
}: DKGConnectionStatusProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">DKG Server Connection</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Status: <Badge className={connectionStatus === 'connected' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}>
              {connectionStatus}
            </Badge>
          </p>
          {connectionStatus === 'disconnected' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Connect to DKG server to create or join sessions
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Server URL (e.g., ws://127.0.0.1:9000/ws)"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="w-80"
          />
          <Button 
            onClick={connectToServer}
            disabled={connectionStatus === 'connecting'}
          >
            {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
      </div>

      {/* Authentication Status */}
      {connectionStatus === 'connected' && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Authentication: <Badge className={authState.isAuthenticated ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'}>
                  {authState.isAuthenticated ? 'Authenticated' : 'Required'}
                </Badge>
                {authState.userId && (
                  <span className="ml-2">User ID: {authState.userId}</span>
                )}
              </p>
              {authState.publicKeyHex && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Your ECDSA Public Key</h4>
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border">
                    <span className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all select-all cursor-pointer">{authState.publicKeyHex}</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Share this 33-byte compressed SEC1 public key with DKG session creators</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {!authState.publicKeyHex && (
                <Button 
                  onClick={onGetPublicKey}
                  variant="outline"
                  size="sm"
                >
                  Get My Public Key
                </Button>
              )}
              {!authState.isAuthenticated && (
                <>
                  <Button 
                    onClick={onRequestChallenge}
                    disabled={!!authState.challenge}
                    size="sm"
                  >
                    {authState.challenge ? 'Challenge Received' : 'Request Challenge'}
                  </Button>
                  {authState.challenge && (
                    <Button 
                      onClick={onAuthenticate}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Authenticate
                    </Button>
                  )}
                </>
              )}
              {authState.isAuthenticated && (
                <Button 
                  onClick={onClearAuth}
                  variant="outline"
                  className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Clear Auth
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}