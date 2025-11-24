'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Plus, Link2, ClipboardList, CheckCircle, X, Trash2 } from 'lucide-react';
import { initWasm } from '@/lib/frost-wasm';
import { DKG_CONFIG, getDKGServerUrl, shouldAutoConnect, debugLog } from '@/lib/dkg-config';

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
import { DKGWasmStatus } from '@/components/dkg/DKGWasmStatus';
import { DKGSessionInfo } from '@/components/dkg/DKGSessionInfo';

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
  const [activeTab, setActiveTab] = useState('sessions');
  const [serverUrl, setServerUrl] = useState(getDKGServerUrl()); // Use config
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
    setPendingCreateSessionParams
  } = useDKGWebSocket(address, setIsCreatingSession, setNewlyCreatedSession);

  const {
    isSubmittingRound1,
    isSubmittingRound2,
    isSubmittingFinalize,
    wasmReady,
    showCommitmentModal,
    selectedSessionForCommitment,
    submitRound1,
    submitRound2,
    submitFinalization,
    openCommitmentModal,
    closeCommitmentModal,
    handleRound1All,
    handleRound2All,
  } = useDKGRounds(wsConnection, authState, frostIdMap, setSuccessMessage, setError);

  // Initialize WASM module on mount
  useEffect(() => {
    debugLog('Initializing FROST WASM module...');
    initWasm()
      .then(() => {
        debugLog('FROST WASM module initialized successfully');
      })
      .catch(err => {
        console.error('❌ Failed to initialize FROST WASM:', err);
        setError('Failed to initialize cryptographic module. Please refresh the page.');
      });
  }, []);

  // Auto-connect to DKG server on mount (if enabled in config)
  useEffect(() => {
    if (shouldAutoConnect() && connectionStatus === 'disconnected' && isConnected) {
      debugLog('Auto-connecting to DKG server:', serverUrl);
      const timer = setTimeout(() => {
        connectToServer(serverUrl);
      }, 1000); // Small delay to ensure wallet is ready
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectionStatus, serverUrl, connectToServer]);

  // Auto-refresh sessions periodically when connected and authenticated
  useEffect(() => {
    if (connectionStatus === 'connected' && authState.isAuthenticated && wsConnection) {
      debugLog('Setting up auto-refresh for sessions');
      
      const refreshSessions = () => {
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          debugLog('Auto-refreshing session list');
          const message = { type: 'ListPendingDKGSessions' };
          wsConnection.send(JSON.stringify(message));
        }
      };

      // Refresh immediately
      refreshSessions();
      
      // Then refresh periodically
      const interval = setInterval(refreshSessions, DKG_CONFIG.SESSION_REFRESH_INTERVAL);
      
      return () => clearInterval(interval);
    }
  }, [connectionStatus, authState.isAuthenticated, wsConnection]);

  // Listen for WebSocket messages and handle DKG rounds
  useEffect(() => {
    if (!wsConnection) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle Round1All - all participants' Round 1 packages
        if (message.type === 'Round1All' && message.payload?.session && message.payload?.packages) {
          console.log('📦 Handling Round1All message');
          handleRound1All(message.payload.session, message.payload.packages);
        }
        
        // Handle Round2All - encrypted Round 2 packages for this participant
        if (message.type === 'Round2All' && message.payload?.session && message.payload?.packages) {
          console.log('📦 Handling Round2All message');
          handleRound2All(message.payload.session, message.payload.packages);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };

    wsConnection.addEventListener('message', handleMessage);

    return () => {
      wsConnection.removeEventListener('message', handleMessage);
    };
  }, [wsConnection, handleRound1All, handleRound2All]);

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

  const handleSubmitCommitment = (publicPackage: string, secretPackage: string) => {
    if (selectedSessionForCommitment) {
      console.log('📦 Commitment modal submitted:', {
        sessionId: selectedSessionForCommitment.id.slice(0, 8),
        publicLength: publicPackage.length,
        secretLength: secretPackage.length
      });
      submitRound1(selectedSessionForCommitment, publicPackage, secretPackage);
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
      
      setSuccessMessage('Key share downloaded successfully!');
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
      
      setSuccessMessage('Key share downloaded successfully!');
    }
  };

  const handleClearAllData = () => {
    // Confirm before clearing
    const confirmed = window.confirm(
      '⚠️ Clear All DKG Data?\n\n' +
      'This will permanently delete:\n' +
      '• All DKG sessions from localStorage\n' +
      '• All joined session records\n' +
      '• Wallet keypair cache\n' +
      '• Cannot be undone!\n\n' +
      'Are you sure you want to continue?'
    );

    if (confirmed) {
      console.log('🗑️  Clearing all DKG data from localStorage...');
      
      // Clear DKG sessions and joined sessions
      clearAllSessions();
      
      // Also clear any other DKG-related localStorage items
      localStorage.removeItem('dkg_last_wallet_address');
      localStorage.removeItem('dkg_last_public_key');
      localStorage.removeItem('dkg_last_private_key');
      
      // Show success message
      setSuccessMessage('✅ All DKG data cleared successfully! Refresh recommended.');
      
      console.log('✅ All DKG localStorage data cleared');
      
      // Optionally refresh the page after a short delay
      setTimeout(() => {
        if (window.confirm('Data cleared! Would you like to refresh the page now?')) {
          window.location.reload();
        }
      }, 1000);
    }
  };

  if (!isConnected) {
    return (
      <Layout title="DKG Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              Connect Your Wallet
            </h3>
            <p className="text-gray-300 mb-4">
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
      <div className="max-w-7xl mx-auto space-y-6 p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              DKG Management
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllData}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-300 dark:border-red-700 flex items-center gap-2"
                title="Clear all DKG data from localStorage"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Data
              </Button>
            </h1>
            <p className="text-gray-300 mt-1">
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

        {/* WASM Status Indicator */}
        <DKGWasmStatus isReady={wasmReady} />

        {/* Statistics */}
        <Card className="p-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">
              {sessions.length} DKG Session(s) • {sessions.filter(s => s.status === 'waiting').length} Active
              <br />
              Created: {sessions.filter(s => s.myRole === 'creator').length} • Joined: {sessions.filter(s => s.myRole === 'participant').length}
            </div>
            {sessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllSessions}
                className="text-red-400 hover:bg-red-900/20"
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
          authState={{
            isAuthenticated: authState.isAuthenticated,
            userId: authState.userId ?? null,
            publicKeyHex: authState.publicKeyHex ?? null,
            challenge: authState.challenge ?? null
          }}
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
          />
        )}

        {/* Global Messages */}
        {successMessage && (
          <Card className="p-4 bg-green-900/20 border-green-500/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">Success:</span>
              <p className="text-green-300 text-sm">{successMessage}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSuccessMessage('')}
                className="ml-auto text-green-400 hover:bg-green-900/30"
              >
                <X className="w-4 h-4" />
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
        <div className="flex space-x-1 bg-[#0a1930] border border-[#4fc3f7]/30 p-1">
          {[
            { id: 'sessions', label: 'Sessions', icon: ClipboardList },
            { id: 'create', label: 'Create Session', icon: Plus },
            { id: 'join', label: 'Join Session', icon: Link2 }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 justify-center"
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
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
              onJoinSession={handleJoinSession}
              isSubmittingRound1={isSubmittingRound1}
              isSubmittingRound2={isSubmittingRound2}
              isSubmittingFinalize={isSubmittingFinalize}
              isJoiningSession={isJoiningSession}
              authState={{
                isAuthenticated: authState.isAuthenticated
              }}
              wsConnection={wsConnection}
            />
          </div>
        )}

        {activeTab === 'create' && (
          <DKGSessionCreator
            connectionStatus={connectionStatus}
            authState={{
              isAuthenticated: authState.isAuthenticated,
              publicKeyHex: authState.publicKeyHex || undefined
            }}
            isCreatingSession={isCreatingSession}
            onCreateSession={handleCreateSession}
          />
        )}

        {activeTab === 'join' && (
          <DKGSessionJoiner
            connectionStatus={connectionStatus}
            authState={{
              isAuthenticated: authState.isAuthenticated
            }}
            isJoiningSession={isJoiningSession}
            successMessage={successMessage}
            error={error}
            onJoinSession={handleJoinSession}
            onDismissSuccess={() => setSuccessMessage('')}
          />
        )}

        {/* Modals */}
        <DKGCommitmentModal
          isOpen={showCommitmentModal}
          session={selectedSessionForCommitment}
          isSubmitting={isSubmittingRound1}
          frostIdMap={frostIdMap}
          authState={{
            isAuthenticated: authState.isAuthenticated,
            publicKeyHex: authState.publicKeyHex || undefined
          }}
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