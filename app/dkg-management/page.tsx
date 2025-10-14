'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';

interface DKGSession {
  id: string;
  creator: string;
  minSigners: number;
  maxSigners: number;
  currentParticipants: number;
  status: 'waiting' | 'round1' | 'round2' | 'finalizing' | 'completed' | 'failed';
  groupId: string;
  createdAt: Date;
  myRole: 'creator' | 'participant';
  description?: string;
  participants: number[];
  participantsPubs: Array<[number, string]>;
}

interface ParticipantStatus {
  uid: number;
  address: string;
  nickname?: string;
  status: 'joined' | 'round1_complete' | 'round2_complete' | 'finalized';
  publicKey?: string;
  idHex?: string;
  ecdsaPubHex?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  challenge?: string;
  accessToken?: string;
  userId?: number;
  publicKeyHex?: string;
}

export default function DKGManagementPage() {
  const { address, isConnected } = useAccount();
  const { hasChannels, isParticipant } = useUserRolesDynamic();
  const [sessions, setSessions] = useState<DKGSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<DKGSession | null>(null);
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [authState, setAuthState] = useState<AuthState>({ isAuthenticated: false });

  // UI State
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'active' | 'history'>('create');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'active' | 'completed' | 'my_created'>('all');

  // Form states for creating new DKG session
  const [minSigners, setMinSigners] = useState(2);
  const [maxSigners, setMaxSigners] = useState(3);
  const [groupId, setGroupId] = useState('');
  const [description, setDescription] = useState('');
  const [serverUrl, setServerUrl] = useState('ws://127.0.0.1:9043/ws');
  const [sessionToJoin, setSessionToJoin] = useState('');
  const [participantsList, setParticipantsList] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Anyone can create DKG sessions (works in demo mode)
  // Joining requires connection for real coordination
  const canCreateSessions = true;
  const canJoinSessions = isConnected;

  useEffect(() => {
    // Load existing sessions from localStorage and migrate old format
    const savedSessions = localStorage.getItem('dkg-sessions');
    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions);
        const migratedSessions = parsedSessions
          .map((session: any) => {
            // Check if this is an old format session
            if (session.threshold !== undefined && session.totalParticipants !== undefined) {
              // Migrate old format to new format
              return {
                ...session,
                minSigners: session.threshold,
                maxSigners: session.totalParticipants,
                participants: session.participants || Array.from({ length: session.totalParticipants }, (_, i) => i + 1),
                participantsPubs: session.participantsPubs || Array.from({ length: session.totalParticipants }, (_, i) => [i + 1, '0x' + '04'.repeat(33)]),
                createdAt: new Date(session.createdAt),
                // Remove old fields
                threshold: undefined,
                totalParticipants: undefined
              };
            }
            // New format session
            return {
              ...session,
              createdAt: new Date(session.createdAt)
            };
          })
          .filter((session: any) => session.minSigners && session.maxSigners); // Filter out invalid sessions
        
        setSessions(migratedSessions);
        
        // Save migrated sessions back to localStorage
        if (migratedSessions.length !== parsedSessions.length) {
          localStorage.setItem('dkg-sessions', JSON.stringify(migratedSessions));
        }
      } catch (error) {
        console.error('Error loading sessions from localStorage:', error);
        // Clear corrupted data
        localStorage.removeItem('dkg-sessions');
        setSessions([]);
      }
    }
  }, []);

  const connectToServer = async () => {
    if (wsConnection) {
      wsConnection.close();
    }

    setConnectionStatus('connecting');
    setError('');
    
    try {
      const ws = new WebSocket(serverUrl);
      
      ws.onopen = () => {
        setConnectionStatus('connected');
        setWsConnection(ws);
        setError('');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (err) {
          console.error('Failed to parse server message:', err);
          setError('Invalid message from server');
        }
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
        setWsConnection(null);
        if (event.code !== 1000) { // Not a normal closure
          setError(`Connection closed unexpectedly (code: ${event.code})`);
        }
      };

      ws.onerror = () => {
        setConnectionStatus('disconnected');
        setWsConnection(null);
        setError('Failed to connect to DKG server. Make sure the server is running.');
      };

      // Set a timeout for connection
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          setConnectionStatus('disconnected');
          setError('Connection timeout. Server may not be running.');
        }
      }, 5000);

    } catch (error) {
      setConnectionStatus('disconnected');
      setError(`Connection error: ${error}`);
      console.error('Failed to connect to DKG server:', error);
    }
  };

  const handleServerMessage = (message: any) => {
    console.log('Received server message:', message);
    
    switch (message.type) {
      case 'Challenge':
        setAuthState(prev => ({ ...prev, challenge: message.payload.challenge }));
        break;
        
      case 'LoginOk':
        setAuthState(prev => ({ 
          ...prev, 
          isAuthenticated: true,
          accessToken: message.payload.access_token,
          userId: message.payload.user_id
        }));
        setError('');
        break;
        
      case 'SessionCreated':
        const newSession: DKGSession = {
          id: message.payload.session,
          creator: address!,
          minSigners,
          maxSigners,
          currentParticipants: 1,
          status: 'waiting',
          groupId: groupId || `group_${Date.now()}`,
          createdAt: new Date(),
          myRole: 'creator',
          description: description,
          participants: parseParticipantsList(),
          participantsPubs: generateParticipantsPubs()
        };
        setSessions(prev => [...prev, newSession]);
        setSelectedSession(newSession);
        setIsCreatingSession(false);
        setError('');
        
        // Save to localStorage
        const updatedSessions = [...sessions, newSession];
        localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
        break;
        
      case 'Error':
        setError(`Server error: ${message.payload.message || 'Unknown error'}`);
        setIsCreatingSession(false);
        break;
      
      case 'Info':
        console.log('Server info:', message.payload.message);
        break;

      case 'ReadyRound1':
        if (selectedSession) {
          setSelectedSession(prev => prev ? { ...prev, status: 'round1' } : null);
          const roster = message.payload.roster;
          const participantsData = roster.map((item: any) => ({
            uid: item[0],
            address: '', // We don't have address from roster
            status: 'joined' as const,
            idHex: item[1],
            ecdsaPubHex: item[2]
          }));
          setParticipants(participantsData);
        }
        break;

      case 'Round1All':
        if (selectedSession) {
          setSelectedSession(prev => prev ? { ...prev, status: 'round2' } : null);
        }
        break;

      case 'ReadyRound2':
        if (selectedSession) {
          setSelectedSession(prev => prev ? { ...prev, status: 'round2' } : null);
        }
        break;

      case 'Round2All':
        if (selectedSession) {
          setSelectedSession(prev => prev ? { ...prev, status: 'finalizing' } : null);
        }
        break;

      case 'Finalized':
        if (selectedSession) {
          setSelectedSession(prev => prev ? { ...prev, status: 'completed' } : null);
        }
        break;
    }
  };

  const parseParticipantsList = (): number[] => {
    if (!participantsList.trim()) {
      // Generate default participant IDs
      return Array.from({ length: maxSigners }, (_, i) => i + 1);
    }
    return participantsList.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
  };

  const generateParticipantsPubs = (): Array<[number, string]> => {
    const participants = parseParticipantsList();
    // For demo, we'll use placeholder public keys
    // In real implementation, these should be actual ECDSA public keys
    return participants.map(uid => [
      uid,
      address || '0x' + '04'.repeat(33) // Placeholder compressed pubkey
    ]);
  };

  const requestChallenge = async () => {
    if (!wsConnection) return;
    const message = { type: 'RequestChallenge' };
    wsConnection.send(JSON.stringify(message));
  };

  const authenticateWithServer = async () => {
    if (!wsConnection || !authState.challenge || !address) return;
    
    // In a real implementation, you would sign the challenge with the user's private key
    // For demo purposes, we'll simulate the authentication
    const message = {
      type: 'Login',
      payload: {
        challenge: authState.challenge,
        pubkey_hex: address, // This should be the actual ECDSA public key
        signature_hex: '0x' + '00'.repeat(64) // Placeholder signature
      }
    };
    wsConnection.send(JSON.stringify(message));
  };

  const createDKGSession = async () => {
    setError('');
    
    if (!canCreateSessions) {
      setError('You do not have permission to create sessions.');
      return;
    }

    if (minSigners >= maxSigners) {
      setError('Min signers must be less than max signers.');
      return;
    }

    if (minSigners < 2) {
      setError('Min signers must be at least 2.');
      return;
    }

    if (maxSigners < 3) {
      setError('Must have at least 3 max signers.');
      return;
    }

    if (!authState.isAuthenticated && wsConnection && connectionStatus === 'connected') {
      setError('Must authenticate with server first.');
      return;
    }

    setIsCreatingSession(true);

    try {
      const participants = parseParticipantsList();
      const participantsPubs = generateParticipantsPubs();
      
      const message = {
        type: 'AnnounceSession',
        payload: {
          min_signers: minSigners,
          max_signers: maxSigners,
          group_id: groupId || `group_${Date.now()}`,
          participants,
          participants_pubs: participantsPubs
        }
      };

      if (wsConnection && connectionStatus === 'connected') {
        console.log('Creating DKG session:', message);
        wsConnection.send(JSON.stringify(message));
        
        setTimeout(() => {
          if (isCreatingSession) {
            setError('Server response timeout. Session creation may have failed.');
            setIsCreatingSession(false);
          }
        }, 10000);
      } else {
        console.log('Demo mode: Creating DKG session:', message);
        setTimeout(() => {
          simulateSessionCreated(message.payload);
        }, 1500);
      }

    } catch (error) {
      setError(`Failed to create session: ${error}`);
      setIsCreatingSession(false);
    }
  };

  // Demo function to simulate session creation when server is not available
  const simulateSessionCreated = (originalMessage: any) => {
    const newSession: DKGSession = {
      id: `session_${Date.now()}`,
      creator: address!,
      minSigners,
      maxSigners,
      currentParticipants: 1,
      status: 'waiting',
      groupId: originalMessage.group_id,
      createdAt: new Date(),
      myRole: 'creator',
      description: description || 'DKG Key Generation Ceremony',
      participants: originalMessage.participants || parseParticipantsList(),
      participantsPubs: originalMessage.participants_pubs || generateParticipantsPubs()
    };
    
    setSessions(prev => [...prev, newSession]);
    setSelectedSession(newSession);
    setIsCreatingSession(false);
    setError('');
    
    // Save to localStorage
    const updatedSessions = [...sessions, newSession];
    localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
  };

  const joinDKGSession = async () => {
    if (!wsConnection || !canJoinSessions || !sessionToJoin) return;

    if (!authState.isAuthenticated) {
      setError('Must authenticate with server first.');
      return;
    }

    const message = {
      type: 'JoinSession',
      payload: {
        session: sessionToJoin
      }
    };

    wsConnection.send(JSON.stringify(message));
  };

  const clearAllSessions = () => {
    localStorage.removeItem('dkg-sessions');
    setSessions([]);
    setSelectedSession(null);
    setError('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-100 text-yellow-800';
      case 'round1': return 'bg-blue-100 text-blue-800';
      case 'round2': return 'bg-purple-100 text-purple-800';
      case 'finalizing': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return 'Waiting for Participants';
      case 'round1': return 'Round 1: Commitments';
      case 'round2': return 'Round 2: Secret Shares';
      case 'finalizing': return 'Finalizing Keys';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  };

  if (!isConnected) {
    return (
      <Layout 
        title="DKG Management" 
        subtitle="Distributed Key Generation for Threshold Signatures"
      >
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Please connect your wallet to access DKG management.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="DKG Management" 
      subtitle="Distributed Key Generation for Threshold Signatures"
    >
      <div className="space-y-6">
      {/* Session Summary */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Badge variant="outline">DKG Participant</Badge>
          {sessions.some(s => s.creator === address) && (
            <Badge variant="default">Session Creator</Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {sessions.length} DKG Session(s) • {sessions.filter(s => s.status === 'waiting').length} Active
          </div>
          {sessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllSessions}
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Clear All Sessions
            </Button>
          )}
        </div>
      </div>

      {/* Authentication Status */}
      {connectionStatus === 'connected' && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Authentication Status</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Status: <Badge className={authState.isAuthenticated ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'}>
                  {authState.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                </Badge>
                {authState.userId && (
                  <span className="ml-2">User ID: {authState.userId}</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {!authState.isAuthenticated && (
                <>
                  <Button 
                    onClick={requestChallenge}
                    disabled={!!authState.challenge}
                    size="sm"
                  >
                    {authState.challenge ? 'Challenge Received' : 'Request Challenge'}
                  </Button>
                  {authState.challenge && (
                    <Button 
                      onClick={authenticateWithServer}
                      size="sm"
                    >
                      Authenticate
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          {authState.challenge && !authState.isAuthenticated && (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
              <p>Challenge: {authState.challenge.slice(0, 20)}...</p>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                In production, sign this challenge with your ECDSA private key
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'create', label: 'Create Session', icon: '➕' },
            { id: 'join', label: 'Join Session', icon: '🔗' },
            { id: 'active', label: 'Active Sessions', icon: '⚡' },
            { id: 'history', label: 'History', icon: '📋' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Connection Status */}
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
              placeholder="Server URL (e.g., ws://127.0.0.1:9043/ws)"
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
        
        {/* Demo Mode Notice */}
        {connectionStatus === 'disconnected' && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Demo Mode Available</h4>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              You can test the DKG interface without a server connection. Session creation will work in demo mode.
            </p>
          </div>
        )}
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <span className="text-red-600 dark:text-red-400 font-medium">⚠️ Error:</span>
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setError('')}
              className="ml-auto text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
            >
              ✕
            </Button>
          </div>
        </Card>
      )}

      {/* Tab Content */}
      {activeTab === 'active' && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active DKG Sessions</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sessions.filter(s => ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).length} active sessions
            </div>
          </div>
          
          {sessions.filter(s => ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No active DKG sessions</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Create or join a session to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.filter(s => ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).map((session) => (
                <div key={session.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Session {session.id.slice(0, 8)}...</h4>
                        <Badge className={getStatusColor(session.status)}>
                          {getStatusText(session.status)}
                        </Badge>
                        <Badge variant="outline">{session.myRole}</Badge>
                        {session.creator === address && (
                          <Badge variant="outline">Creator</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="font-medium">Signers:</span><br />
                          {session.minSigners}/{session.maxSigners}
                        </div>
                        <div>
                          <span className="font-medium">Participants:</span><br />
                          {session.currentParticipants}/{session.maxSigners}
                        </div>
                        <div>
                          <span className="font-medium">Description:</span><br />
                          {session.description || 'DKG Ceremony'}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span><br />
                          {session.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSession(session)}
                      >
                        View Details
                      </Button>
                      {session.creator === address && session.status === 'waiting' && (
                        <Button
                          size="sm"
                          disabled={session.currentParticipants < session.maxSigners}
                        >
                          Start DKG
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Create Session Tab */}
      {activeTab === 'create' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Create DKG Session</h2>
          
          {/* Session Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Description (Optional)</label>
            <Input
              placeholder="Brief description of this DKG ceremony"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Help participants understand the purpose of this key generation ceremony
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Min Signers (t)</label>
              <Input
                type="number"
                value={minSigners}
                onChange={(e) => setMinSigners(parseInt(e.target.value) || 2)}
                min={2}
                max={maxSigners - 1}
                className={minSigners >= maxSigners ? 'border-red-500 dark:border-red-400' : ''}
              />
              {minSigners >= maxSigners && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Min signers must be less than max signers
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Max Signers (n)</label>
              <Input
                type="number"
                value={maxSigners}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 3;
                  setMaxSigners(value);
                  // Auto-adjust min signers if it becomes invalid
                  if (minSigners >= value) {
                    setMinSigners(Math.max(2, value - 1));
                  }
                }}
                min={3}
                max={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Group ID</label>
              <Input
                placeholder="Auto-generated if empty"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Participants (comma-separated UIDs)</label>
            <Input
              placeholder="e.g., 1,2,3 (leave empty for auto-generation)"
              value={participantsList}
              onChange={(e) => setParticipantsList(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Participant user IDs. If empty, will generate sequential IDs (1,2,3...)
            </p>
          </div>
          
          <div className="flex items-end">
            <Button 
              onClick={createDKGSession}
              disabled={isCreatingSession || minSigners >= maxSigners}
              className="w-full"
            >
              {isCreatingSession ? 'Creating Session...' : 
               connectionStatus === 'connected' ? 'Create Session' : 'Create Session (Demo)'}
            </Button>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">Session Configuration</h4>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <p>• Min/Max Signers: {minSigners} of {maxSigners} signatures required</p>
              <p>• Description: {description || 'DKG Key Generation Ceremony'}</p>
              <p>• Role: You will be the session creator and coordinator</p>
              <p>• Group ID: {groupId || 'Auto-generated'}</p>
              <p>• Participants: {participantsList || `Auto-generated (1-${maxSigners})`}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Join Session Tab */}
      {activeTab === 'join' && (
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
              <div className="flex gap-4 mb-4">
                <Input
                  placeholder="Session ID provided by creator"
                  value={sessionToJoin}
                  onChange={(e) => setSessionToJoin(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={joinDKGSession}
                  disabled={!sessionToJoin}
                >
                  Join Session
                </Button>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2 text-amber-800 dark:text-amber-200">Before Joining</h4>
                <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <p>• Ensure you have the correct session ID from the creator</p>
                  <p>• Verify you are connected to the correct DKG server</p>
                  <p>• Have your ECDSA keypair ready for authentication</p>
                  <p>• Understand your role and responsibilities in this session</p>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">DKG Session History</h2>
            <div className="flex gap-2">
              <Select value={sessionFilter} onValueChange={(value: any) => setSessionFilter(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="completed">Completed Only</SelectItem>
                  <SelectItem value="my_created">Created by Me</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No DKG sessions yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Create or join a session to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">Session {session.id.slice(0, 8)}...</h3>
                        <Badge className={getStatusColor(session.status)}>
                          {getStatusText(session.status)}
                        </Badge>
                        <Badge variant="outline">{session.myRole}</Badge>
                        {session.creator === address && (
                          <Badge variant="outline">Creator</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="font-medium">Description:</span><br />
                          {session.description || 'DKG Ceremony'}
                        </div>
                        <div>
                          <span className="font-medium">Signers:</span><br />
                          {session.minSigners}/{session.maxSigners}
                        </div>
                        <div>
                          <span className="font-medium">Group ID:</span><br />
                          {session.groupId.slice(0, 12)}...
                        </div>
                        <div>
                          <span className="font-medium">Created:</span><br />
                          {session.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSession(session)}
                      >
                        View Details
                      </Button>
                      {session.status === 'completed' && (
                        <Button variant="outline" size="sm">
                          Download Keys
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}


      {/* Session Details Modal */}
      {selectedSession && (
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>DKG Session Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Session ID</label>
                  <code className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-2 rounded block">
                    {selectedSession.id}
                  </code>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <Badge className={getStatusColor(selectedSession.status)}>
                    {getStatusText(selectedSession.status)}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Participants</label>
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div key={participant.uid} className="flex justify-between items-center p-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">UID: {participant.uid}</span>
                        {participant.address && (
                          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{participant.address.slice(0, 10)}...{participant.address.slice(-8)}</span>
                        )}
                        {participant.idHex && (
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-500">ID: {participant.idHex.slice(0, 8)}...</span>
                        )}
                      </div>
                      <Badge variant="outline">{participant.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {selectedSession.status === 'completed' && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Generated Artifacts</label>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full">
                      Download Group Info (group.json)
                    </Button>
                    <Button variant="outline" className="w-full">
                      Download Key Share (share_{selectedSession.id.slice(0, 8)}.json)
                    </Button>
                  </div>
                </div>
              )}

              {selectedSession.creator === address && selectedSession.status !== 'completed' && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Creator Controls</h4>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        // Cancel session logic
                        setSelectedSession(null);
                      }}
                    >
                      Cancel Session
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Instructions */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-900/20">
        <h3 className="font-semibold mb-2 text-blue-800 dark:text-blue-200">DKG Process Overview</h3>
        <div className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
          <p><strong>1. Setup:</strong> Leader creates a session with threshold (t) and total participants (n)</p>
          <p><strong>2. Join:</strong> Participants join using the session ID</p>
          <p><strong>3. Round 1:</strong> All parties generate and share commitments</p>
          <p><strong>4. Round 2:</strong> Parties create encrypted secret shares for each other</p>
          <p><strong>5. Finalize:</strong> Each party computes their key share and group public key</p>
          <p><strong>6. Result:</strong> Distributed key generation complete - ready for threshold signing</p>
        </div>
      </Card>
      </div>
    </Layout>
  );
}