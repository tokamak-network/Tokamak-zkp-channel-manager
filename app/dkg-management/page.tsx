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
import { DKGSessionDetailsModal } from '@/components/dkg/DKGSessionDetailsModal';
import { DKGAutomationStatus } from '@/components/dkg/DKGAutomationStatus';
import { DKGErrorDisplay } from '@/components/dkg/DKGErrorDisplay';
import { DKGConsoleSettings } from '@/components/dkg/DKGConsoleSettings';

// Import our custom hooks
import { useDKGWebSocket } from '@/hooks/useDKGWebSocket';
import { useDKGRounds } from '@/hooks/useDKGRounds';
import { useAutomatedDKG } from '@/hooks/useAutomatedDKG';

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
  myRole?: 'creator' | 'participant';
  description?: string;
  participants: any[];
  roster: Array<[number, string, string]>;
  groupVerifyingKey?: string;
  automationMode?: 'manual' | 'automatic';
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
  const [showConsoleSettings, setShowConsoleSettings] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<DKGSession | null>(null);

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
    joinedSessions,
    isJoiningSession,
    joinSession,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    connectToServer,
    clearAllSessions,
    setPendingCreateSessionParams,
    sessionTimeouts,
    formatRemainingTime
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

  // Automated DKG ceremony flow
  const {
    isAutomationEnabled,
    activeAutomations,
    manualSubmitRound1,
    manualSubmitRound2,
    manualSubmitFinalization,
    startAutomatedCeremony
  } = useAutomatedDKG(
    wsConnection,
    authState,
    sessions,
    frostIdMap,
    setSuccessMessage,
    setError
  );

  // Handler functions
  const handleConnectToServer = () => {
    connectToServer(serverUrl);
  };

  const handleCreateSession = async (params: {
    minSigners: number;
    maxSigners: number;
    participants: DKGParticipant[];
    automationMode: 'manual' | 'automatic';
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

      // Use setTimeout to ensure the state update completes before sending the WebSocket message
      setTimeout(() => {
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
        
        wsConnection.send(JSON.stringify(message));
      }, 0);
      
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

  const handleViewMore = (session: DKGSession) => {
    setSelectedSessionForModal(session);
    setShowDetailsModal(true);
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

  const handleDownloadKeyShareFromModal = () => {
    if (selectedSessionForModal) {
      // Create a downloadable key share
      const keyShare = {
        session_id: selectedSessionForModal.id,
        group_verifying_key: selectedSessionForModal.groupVerifyingKey,
        my_role: selectedSessionForModal.myRole,
        participants: selectedSessionForModal.roster?.length || 0,
        threshold: `${selectedSessionForModal.minSigners}-of-${selectedSessionForModal.maxSigners}`,
        created_at: selectedSessionForModal.createdAt.toISOString()
      };

      const blob = new Blob([JSON.stringify(keyShare, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `share_${selectedSessionForModal.id.slice(0, 8)}.json`;
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
            {/* Console settings toggle (development or debug mode) */}
            {(process.env.NODE_ENV === 'development' || showConsoleSettings) && (
              <DKGConsoleSettings />
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

        {/* Automation Status */}
        {connectionStatus === 'connected' && authState.isAuthenticated && (
          <DKGAutomationStatus
            isAutomationEnabled={isAutomationEnabled}
            activeAutomations={activeAutomations}
            sessionTimeouts={sessionTimeouts}
            formatRemainingTime={formatRemainingTime}
          />
        )}

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
          <DKGErrorDisplay
            error={error}
            onDismiss={() => setError('')}
            onRetry={() => {
              // Add retry logic based on the current connection state
              if (connectionStatus === 'disconnected') {
                handleConnectToServer();
              } else if (!authState.isAuthenticated) {
                requestChallenge();
              }
            }}
          />
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
            joinedSessions={joinedSessions}
            onSelectSession={setSelectedSession}
            onViewMore={handleViewMore}
            onRefreshSession={handleRefreshSession}
            onSubmitRound1={openCommitmentModal}
            onSubmitRound2={submitRound2}
            onSubmitFinalization={submitFinalization}
            onStartAutomatedCeremony={startAutomatedCeremony}
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
            joinedSessions={joinedSessions}
            onSelectSession={(session) => {
              setSelectedSession(session);
              setShowSessionDetails(true);
            }}
            onViewMore={handleViewMore}
            onRefreshSession={handleRefreshSession}
            onSubmitRound1={openCommitmentModal}
            onSubmitRound2={submitRound2}
            onSubmitFinalization={submitFinalization}
            onStartAutomatedCeremony={startAutomatedCeremony}
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
        <DKGSessionDetailsModal
          session={newlyCreatedSession}
          isOpen={!!newlyCreatedSession}
          onClose={() => setNewlyCreatedSession(null)}
          frostIdMap={frostIdMap}
          isNewlyCreated={true}
        />

        {/* Session Details Modal */}
        <DKGSessionDetailsModal
          session={selectedSessionForModal}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedSessionForModal(null);
          }}
          onDownloadKeyShare={handleDownloadKeyShareFromModal}
          frostIdMap={frostIdMap}
          isNewlyCreated={false}
        />
      </div>
    </Layout>
  );
}