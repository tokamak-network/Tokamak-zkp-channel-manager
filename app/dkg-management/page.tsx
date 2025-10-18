'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Import our new DKG components
import { DKGConnectionStatus } from '@/components/dkg/DKGConnectionStatus';
import { DKGSessionCreator } from '@/components/dkg/DKGSessionCreator';
import { DKGSessionJoiner } from '@/components/dkg/DKGSessionJoiner';
import { DKGSessionsList } from '@/components/dkg/DKGSessionsList';
import { DKGCommitmentModal } from '@/components/dkg/DKGCommitmentModal';
import { DKGSessionDetails } from '@/components/dkg/DKGSessionDetails';

// Import our custom hooks
import { useDKGWebSocket } from '@/hooks/useDKGWebSocket';
import { useDKGRounds } from '@/hooks/useDKGRounds';

// Types
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
  myRole: 'creator' | 'participant';
  description?: string;
  participants: any[];
  roster: Array<[number, string, string]>;
  groupVerifyingKey?: string;
}

interface DKGParticipant {
  uid: number;
  publicKey: string;
}

export default function DKGManagementPage() {
  const { address, isConnected } = useAccount();
  
  // UI state
  const [activeTab, setActiveTab] = useState('active');
  const [serverUrl, setServerUrl] = useState('ws://127.0.0.1:9000/ws');
  const [selectedSession, setSelectedSession] = useState<DKGSession | null>(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newlyCreatedSession, setNewlyCreatedSession] = useState<DKGSession | null>(null);

  // Use our custom hooks
  const {
    wsConnection,
    connectionStatus,
    authState,
    requestChallenge,
    getDeterministicPublicKey,
    authenticate,
    clearAuth,
    sessions,
    frostIdMap,
    isJoiningSession,
    joinSession,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    connectToServer,
    clearAllSessions,
    setPendingCreateSessionParams
  } = useDKGWebSocket(address, setIsCreatingSession, setNewlyCreatedSession);

  const {
    isSubmittingRound1,
    isSubmittingRound2,
    isSubmittingFinalize,
    showCommitmentModal,
    selectedSessionForCommitment,
    submitRound1,
    submitRound2,
    submitFinalization,
    openCommitmentModal,
    closeCommitmentModal
  } = useDKGRounds(wsConnection, authState, frostIdMap, setSuccessMessage, setError);

  // Handler functions
  const handleConnectToServer = () => {
    connectToServer(serverUrl);
  };

  const handleCreateSession = async (params: {
    minSigners: number;
    maxSigners: number;
    participants: DKGParticipant[];
  }) => {
    if (!wsConnection) {
      setError('Must be connected to server to create sessions');
      return;
    }

    setIsCreatingSession(true);
    setError('');

    try {
      // Validate participants
      if (params.participants.length === 0) {
        setError('Cannot create session without participants');
        setIsCreatingSession(false);
        return;
      }

      if (params.participants.length < params.minSigners) {
        setError(`Cannot create session: need at least ${params.minSigners} participants`);
        setIsCreatingSession(false);
        return;
      }

      // Store parameters for when SessionCreated message is received
      setPendingCreateSessionParams(params);

      const message = {
        type: 'AnnounceSession',
        payload: {
          min_signers: params.minSigners,
          max_signers: params.maxSigners,
          group_id: `group_${Date.now()}`,
          participants: params.participants.map(p => p.uid),
          participants_pubs: params.participants.map(p => [p.uid, p.publicKey])
        }
      };

      console.log('Creating session with:', message);
      console.log('Participants UIDs:', params.participants.map(p => p.uid));
      console.log('Participants Public Keys:', params.participants.map(p => p.publicKey));
      
      wsConnection.send(JSON.stringify(message));
      
      // The session will be added when we receive the SessionCreated message
      
    } catch (error) {
      console.error('Session creation error:', error);
      setError('Failed to create session: ' + (error as Error).message);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    joinSession(sessionId);
  };

  const handleRefreshSession = (sessionId: string) => {
    if (wsConnection && authState.isAuthenticated) {
      const message = {
        type: 'JoinSession',
        payload: { session: sessionId }
      };
      console.log('📤 Sending JoinSession to refresh state:', message);
      wsConnection.send(JSON.stringify(message));
    }
  };

  const handleSubmitCommitment = (commitment: string) => {
    if (selectedSessionForCommitment) {
      submitRound1(selectedSessionForCommitment, commitment);
    }
  };

  const handleDownloadKeyShare = () => {
    if (selectedSession) {
      // Create a downloadable key share
      const keyShare = {
        session_id: selectedSession.id,
        group_verifying_key: selectedSession.groupVerifyingKey,
        my_role: selectedSession.myRole,
        participants: selectedSession.roster?.length || 0,
        threshold: `${selectedSession.minSigners}-of-${selectedSession.maxSigners}`,
        created_at: selectedSession.createdAt.toISOString()
      };

      const blob = new Blob([JSON.stringify(keyShare, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `share_${selectedSession.id.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccessMessage('🔑 Key share downloaded successfully!');
    }
  };

  if (!isConnected) {
    return (
      <Layout title="DKG Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Connect Your Wallet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You need to connect your wallet to participate in DKG ceremonies
            </p>
            <ConnectButton />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="DKG Management">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              DKG Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Distributed Key Generation for FROST Threshold Signatures
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">DKG Participant</Badge>
            {sessions.some(s => s.creator === address) && (
              <Badge variant="default">Session Creator</Badge>
            )}
          </div>
        </div>

        {/* Statistics */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sessions.length} DKG Session(s) • {sessions.filter(s => s.status === 'waiting').length} Active
              <br />
              Created: {sessions.filter(s => s.myRole === 'creator').length} • Joined: {sessions.filter(s => s.myRole === 'participant').length}
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
        </Card>

        {/* Connection Status */}
        <DKGConnectionStatus
          connectionStatus={connectionStatus}
          serverUrl={serverUrl}
          setServerUrl={setServerUrl}
          connectToServer={handleConnectToServer}
          authState={authState}
          onRequestChallenge={requestChallenge}
          onGetPublicKey={getDeterministicPublicKey}
          onAuthenticate={authenticate}
          onClearAuth={clearAuth}
        />

        {/* Global Messages */}
        {successMessage && (
          <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400 font-medium">✅ Success:</span>
              <p className="text-green-700 dark:text-green-300 text-sm">{successMessage}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSuccessMessage('')}
                className="ml-auto text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
              >
                ✕
              </Button>
            </div>
          </Card>
        )}

        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400 font-medium">❌ Error:</span>
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

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {[
            { id: 'active', label: 'Active Sessions', icon: '🔥' },
            { id: 'create', label: 'Create Session', icon: '➕' },
            { id: 'join', label: 'Join Session', icon: '🔗' },
            { id: 'history', label: 'History', icon: '📋' }
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 justify-center"
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'active' && (
          <DKGSessionsList
            sessions={sessions}
            address={address}
            activeTab={activeTab}
            frostIdMap={frostIdMap}
            onSelectSession={setSelectedSession}
            onRefreshSession={handleRefreshSession}
            onSubmitRound1={openCommitmentModal}
            onSubmitRound2={submitRound2}
            onSubmitFinalization={submitFinalization}
            isSubmittingRound1={isSubmittingRound1}
            isSubmittingRound2={isSubmittingRound2}
            isSubmittingFinalize={isSubmittingFinalize}
            authState={authState}
            wsConnection={wsConnection}
          />
        )}

        {activeTab === 'create' && (
          <DKGSessionCreator
            connectionStatus={connectionStatus}
            authState={authState}
            isCreatingSession={isCreatingSession}
            onCreateSession={handleCreateSession}
          />
        )}

        {activeTab === 'join' && (
          <DKGSessionJoiner
            connectionStatus={connectionStatus}
            authState={authState}
            isJoiningSession={isJoiningSession}
            successMessage={successMessage}
            onJoinSession={handleJoinSession}
            onDismissSuccess={() => setSuccessMessage('')}
          />
        )}

        {activeTab === 'history' && (
          <DKGSessionsList
            sessions={sessions}
            address={address}
            activeTab={activeTab}
            frostIdMap={frostIdMap}
            onSelectSession={(session) => {
              setSelectedSession(session);
              setShowSessionDetails(true);
            }}
            onRefreshSession={handleRefreshSession}
            onSubmitRound1={openCommitmentModal}
            onSubmitRound2={submitRound2}
            onSubmitFinalization={submitFinalization}
            isSubmittingRound1={isSubmittingRound1}
            isSubmittingRound2={isSubmittingRound2}
            isSubmittingFinalize={isSubmittingFinalize}
            authState={authState}
            wsConnection={wsConnection}
          />
        )}

        {/* Modals */}
        <DKGCommitmentModal
          isOpen={showCommitmentModal}
          session={selectedSessionForCommitment}
          isSubmitting={isSubmittingRound1}
          onClose={closeCommitmentModal}
          onSubmit={handleSubmitCommitment}
        />

        {showSessionDetails && (
          <DKGSessionDetails
            session={selectedSession}
            onClose={() => {
              setShowSessionDetails(false);
              setSelectedSession(null);
            }}
            onDownloadKeyShare={handleDownloadKeyShare}
          />
        )}

        {/* Session Creation Success Modal */}
        {newlyCreatedSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg mx-4 shadow-xl">
              <div className="text-center">
                <div className="mb-4">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30">
                    <span className="text-2xl">🎉</span>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Session Created Successfully!
                </h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Your DKG session has been created. Share this Session ID with participants:
                  </p>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono text-gray-900 dark:text-gray-100 select-all">
                        {newlyCreatedSession.id}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(newlyCreatedSession.id);
                          setSuccessMessage('Session ID copied to clipboard!');
                        }}
                        className="ml-2"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <p><strong>Status:</strong> Waiting for participants</p>
                    <p><strong>Threshold:</strong> {newlyCreatedSession.minSigners} of {newlyCreatedSession.maxSigners} signatures</p>
                    <p><strong>Your Role:</strong> Session Creator</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setNewlyCreatedSession(null)}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedSession(newlyCreatedSession);
                      setShowSessionDetails(true);
                      setNewlyCreatedSession(null);
                    }}
                    className="flex-1"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}