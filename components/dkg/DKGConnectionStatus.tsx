'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Wifi, WifiOff, ClipboardCopy, Check, Lightbulb, CheckCircle } from 'lucide-react';

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <Card className="p-4 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/50">
      {/* Simple Status Display (when connected) */}
      {connectionStatus === 'connected' && !showAdvanced && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wifi className="w-5 h-5 text-green-400" />
            <div>
              <h3 className="font-semibold text-white">Connected to DKG Server</h3>
              <p className="text-sm text-gray-400">
                Ready to create or join sessions
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-gray-400 hover:text-white"
          >
            Advanced
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Show connection UI when disconnected OR when advanced is toggled */}
      {(connectionStatus !== 'connected' || showAdvanced) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {connectionStatus === 'connected' ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <h3 className="font-semibold text-white">DKG Server Connection</h3>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>Status:</span>
                  <Badge className={connectionStatus === 'connected' ? 'bg-green-500/20 text-green-300 border-green-500/30' : connectionStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}>
                    {connectionStatus}
                  </Badge>
                </div>
              </div>
            </div>
            {showAdvanced && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAdvanced(false)}
                className="text-gray-400 hover:text-white"
              >
                Hide
                <ChevronUp className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>

          {connectionStatus !== 'connected' && (
            <div className="flex gap-2">
              <Input
                placeholder="Server URL (e.g., ws://127.0.0.1:9000/ws)"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="flex-1 bg-[#0a1930] border-[#4fc3f7]/30 text-white"
              />
              <Button 
                onClick={connectToServer}
                disabled={connectionStatus === 'connecting'}
                className="bg-[#028bee] hover:bg-[#0277d4]"
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          )}

          {showAdvanced && connectionStatus === 'connected' && (
            <div className="mt-3 p-3 bg-[#0a1930]/50 rounded border border-[#4fc3f7]/20">
              <p className="text-xs text-gray-400 mb-2">Server URL:</p>
              <code className="text-xs text-[#4fc3f7]">{serverUrl}</code>
            </div>
          )}
        </div>
      )}

      {/* Authentication Status */}
      {connectionStatus === 'connected' && (
        <div className="mt-4 pt-4 border-t border-[#4fc3f7]/30">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-3">
                <span>Authentication:</span>
                <Badge className={authState.isAuthenticated ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'}>
                  {authState.isAuthenticated ? 'Authenticated ✓' : 'Required'}
                </Badge>
              </div>
              
              {authState.publicKeyHex && (
                <div className="mt-3 p-3 bg-green-900/20 rounded border border-green-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-green-300 text-sm">Your ECDSA Public Key</h4>
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(authState.publicKeyHex!);
                        setCopied(true);
                          setTimeout(() => {
                          setCopied(false);
                          }, 2000);
                      }}
                      className="bg-[#028bee] hover:bg-[#0277d4] text-white h-6 text-xs px-2 flex items-center gap-1"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <ClipboardCopy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-[#0a1930] p-2 rounded border border-green-500/20">
                    <span className="font-mono text-xs text-green-400 break-all select-all cursor-pointer">{authState.publicKeyHex}</span>
                  </div>
                  <p className="text-xs text-yellow-400 mt-2 font-semibold flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Share this with the session creator so they can add you to the roster BEFORE creating the session
                  </p>
                  
                  {/* Show ready status - Below public key */}
                  {authState.isAuthenticated && (
                    <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="text-sm text-green-300 flex items-center gap-2 font-semibold">
                        <CheckCircle className="w-5 h-5" />
                        Ready to Join Sessions!
                      </div>
                    </div>
                  )}
                  
                  {/* Show authenticating status - Below public key */}
                  {!authState.isAuthenticated && (
                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="text-sm text-yellow-300 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-semibold">Authenticating... Please wait!</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2 ml-4">
              {/* Only show "Get My Public Key" button if not authenticated yet */}
              {!authState.isAuthenticated && !authState.publicKeyHex && (
                <Button 
                  onClick={onGetPublicKey}
                  size="sm"
                  className="bg-[#028bee] hover:bg-[#0277d4]"
                >
                  Get My Public Key
                </Button>
              )}
              
              {/* Show authenticated status */}
              {/* {authState.isAuthenticated && (
                <div className="text-sm text-green-300 flex items-center gap-2">
                  ✓ Ready
                </div>
              )} */}
              
              {/* Advanced: Show clear auth button */}
              {authState.isAuthenticated && showAdvanced && (
                <Button 
                  onClick={onClearAuth}
                  variant="outline"
                  size="sm"
                  className="text-red-400 border-red-500/30 hover:bg-red-900/20"
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