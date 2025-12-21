'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Plus, Link2, ClipboardList, CheckCircle, X, Trash2, PenTool, Upload, Download, RefreshCw, FileText, Server, Zap, Settings, AlertCircle } from 'lucide-react';
import { initWasm } from '@/lib/frost-wasm';
import { DKG_CONFIG, shouldAutoConnect, debugLog } from '@/lib/dkg-config';

// Enhanced UI components
import { ThemeProvider } from '@/components/ui/theme-toggle';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { LoadingSpinner, LoadingCard } from '@/components/ui/loading-spinner';
import { RetryButton } from '@/components/ui/retry-button';
import { DKGQuickStart } from '@/components/dkg/DKGQuickStart';
import { DKGSessionGrid } from '@/components/dkg/DKGSessionGrid';
import { 
  get_signing_prerequisites,
  get_key_package_metadata,
  keccak256,
  sign_part1_commit,
  sign_part2_sign,
  get_auth_payload_sign_r1,
  get_auth_payload_sign_r2,
  sign_message as sign_message_wasm
} from '@/lib/wasm/pkg/tokamak_frost_wasm';
import { encodeAbiParameters, keccak256 as ethersKeccak256 } from 'viem';

// Import our new DKG components
import { DKGConnectionStatus } from '@/components/dkg/DKGConnectionStatus';
import { DKGSessionCreator } from '@/components/dkg/DKGSessionCreator';
import { DKGSessionJoiner } from '@/components/dkg/DKGSessionJoiner';
import { DKGSessionsList } from '@/components/dkg/DKGSessionsList';
import { DKGCommitmentModal } from '@/components/dkg/DKGCommitmentModal';
import { DKGSessionDetails } from '@/components/dkg/DKGSessionDetails';
import { DKGAutomationStatus } from '@/components/dkg/DKGAutomationStatus';
import { DKGErrorDisplay } from '@/components/dkg/DKGErrorDisplay';
import { DKGWasmStatus } from '@/components/dkg/DKGWasmStatus';
import { DKGSessionInfo } from '@/components/dkg/DKGSessionInfo';
import { DKGServerDeploymentGuide } from '@/components/dkg/DKGServerDeploymentGuide';

// Import our custom hooks
import { useDKGWebSocket } from '@/hooks/useDKGWebSocket';
import { useDKGRounds } from '@/hooks/useDKGRounds';
import { useAutomatedDKG } from '@/hooks/useAutomatedDKG';

// Import key utilities
import { decompressPublicKey, isCompressedKey } from '@/lib/key-utils';

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

function DKGManagementPageInner() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { showToast } = useToast();
  
  // UI state
  const [activeTab, setActiveTab] = useState('quick-start');
  const [serverUrl, setServerUrl] = useState(''); // Empty by default, user must enter URL manually
  const [selectedSession, setSelectedSession] = useState<DKGSession | null>(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newlyCreatedSession, setNewlyCreatedSession] = useState<DKGSession | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedSessionData, setImportedSessionData] = useState('');

  // Signing state
  const [keyPackage, setKeyPackage] = useState('');
  const [keyPackageFile, setKeyPackageFile] = useState<File | null>(null);
  const [availableKeyPackages, setAvailableKeyPackages] = useState<any[]>([]);
  const [selectedKeyPackageId, setSelectedKeyPackageId] = useState<string>('');
  const [signingGroupId, setSigningGroupId] = useState('');
  const [signingThreshold, setSigningThreshold] = useState('');
  const [signingGroupVk, setSigningGroupVk] = useState('');
  const [signingRoster, setSigningRoster] = useState<string[]>([]);
  const [messageToSign, setMessageToSign] = useState('');
  const [messageHash, setMessageHash] = useState('');
  const [signingSessionId, setSigningSessionId] = useState('');
  const signingSessionIdRef = useState({ current: '' });
  const [pendingSigningSessions, setPendingSigningSessions] = useState<any[]>([]);
  const [finalSignature, setFinalSignature] = useState('');
  const [finalSignatureData, setFinalSignatureData] = useState<any>(null);
  const signingState = useState({ current: {} as any });
  const [joiningSigningSession, setJoiningSigningSession] = useState<string | null>(null);
  const [showSignatureSuccessModal, setShowSignatureSuccessModal] = useState(false);
  
  // Signature creator state for keccak256(abi.encodePacked(channelId, finalStateRoot))
  const [channelId, setChannelId] = useState('');
  const [finalStateRoot, setFinalStateRoot] = useState('');
  const [computedHash, setComputedHash] = useState('');
  const [packedData, setPackedData] = useState('');

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

  // Initialize WASM module on mount and load imported sessions
  useEffect(() => {
    debugLog('Initializing FROST WASM module...');
    initWasm()
      .then(() => {
        debugLog('FROST WASM module initialized successfully');
        // Load available key packages from localStorage
        loadAvailableKeyPackages();
        // Load imported sessions
        loadImportedSessions();
      })
      .catch(err => {
        console.error('❌ Failed to initialize FROST WASM:', err);
        setError('Failed to initialize cryptographic module. Please refresh the page.');
        showToast({
          type: 'error',
          title: 'WASM initialization failed',
          message: 'Please refresh the page and try again',
          action: { label: 'Refresh', onClick: () => window.location.reload() }
        });
      });
  }, []);

  // Validate and clean localStorage data to prevent sync issues
  const validateAndCleanLocalStorage = () => {
    console.log('🧹 Validating and cleaning localStorage data...');
    const keysToRemove: string[] = [];
    
    // Define which keys contain JSON data vs plain strings
    const jsonKeys = ['dkg_key_package_', 'dkg_imported_session_'];
    const plainStringKeys = ['dkg_last_wallet_address', 'dkg_last_public_key', 'dkg_last_private_key'];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('dkg_')) {
        // Skip plain string keys - these don't need JSON validation
        if (plainStringKeys.includes(key)) {
          continue;
        }
        
        // Only validate JSON for keys that should contain JSON
        const isJsonKey = jsonKeys.some(prefix => key.startsWith(prefix));
        if (!isJsonKey) {
          continue; // Skip unknown dkg_ keys
        }
        
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          
          // Validate key package structure
          if (key.startsWith('dkg_key_package_')) {
            if (!data.session_id || !data.group_id || !data.key_package_hex || !data.group_public_key_hex) {
              console.warn(`🗑️ Removing corrupted key package: ${key}`, data);
              keysToRemove.push(key);
              continue;
            }
            
            // Validate hex strings are properly formatted
            if (!data.key_package_hex.match(/^[0-9a-fA-F]+$/) || 
                !data.group_public_key_hex.match(/^[0-9a-fA-F]+$/)) {
              console.warn(`🗑️ Removing key package with invalid hex: ${key}`, data);
              keysToRemove.push(key);
              continue;
            }
          }
          
          // Validate imported session structure
          if (key.startsWith('dkg_imported_session_')) {
            if (!data.id || !data.groupVerifyingKey) {
              console.warn(`🗑️ Removing corrupted imported session: ${key}`, data);
              keysToRemove.push(key);
              continue;
            }
          }
          
          // Check for stale data (older than 24 hours) - only for entries with timestamp
          if (data.timestamp) {
            const age = Date.now() - new Date(data.timestamp).getTime();
            if (age > 24 * 60 * 60 * 1000) {
              console.warn(`🗑️ Removing stale data: ${key} (age: ${Math.round(age / (60 * 60 * 1000))}h)`);
              keysToRemove.push(key);
              continue;
            }
          }
        } catch (e) {
          console.error(`🗑️ Removing unparseable localStorage entry: ${key}`, e);
          keysToRemove.push(key);
        }
      }
    }
    
    // Remove corrupted/stale entries
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`✅ Removed: ${key}`);
    });
    
    console.log(`🧹 Cleanup complete. Removed ${keysToRemove.length} entries.`);
  };

  // Load available key packages from localStorage
  const loadAvailableKeyPackages = () => {
    // First validate and clean localStorage
    validateAndCleanLocalStorage();
    
    const packages: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('dkg_key_package_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          
          // Double-check data integrity after cleanup
          if (data.session_id && data.group_id && data.key_package_hex && data.group_public_key_hex) {
            packages.push({
              id: key,
              sessionId: data.session_id,
              groupId: data.group_id,
              threshold: data.threshold ?? 0,
              total: data.total ?? 0,
              timestamp: data.timestamp,
              keyPackageHex: data.key_package_hex,
              groupPublicKeyHex: data.group_public_key_hex
            });
          }
        } catch (e) {
          console.error('Failed to parse key package after cleanup:', key);
          // Remove the corrupted entry immediately
          localStorage.removeItem(key);
        }
      }
    }
    setAvailableKeyPackages(packages.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
  };

  // Load imported sessions from localStorage and merge with hook sessions
  const [importedSessions, setImportedSessions] = useState<DKGSession[]>([]);
  
  const loadImportedSessions = () => {
    const loadedImportedSessions: DKGSession[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('dkg_imported_session_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          
          if (data.id && data.groupVerifyingKey) {
            // Convert the stored data back to DKGSession format
            const importedSession: DKGSession = {
              ...data,
              createdAt: new Date(data.createdAt),
              status: 'completed', // Imported sessions are always marked as completed
              myRole: data.myRole || 'participant'
            };
            
            loadedImportedSessions.push(importedSession);
          }
        } catch (e) {
          console.error('Failed to parse imported session:', key, e);
          // Remove the corrupted entry
          localStorage.removeItem(key);
        }
      }
    }

    if (loadedImportedSessions.length > 0) {
      console.log(`📥 Loaded ${loadedImportedSessions.length} imported session(s)`);
      setImportedSessions(loadedImportedSessions);
    }
  };

  // Merge imported sessions with hook sessions for display
  const allSessions = React.useMemo(() => {
    // Combine sessions from hook and imported sessions, avoiding duplicates
    const combined = [...sessions];
    
    importedSessions.forEach(importedSession => {
      // Check if this session already exists (by ID)
      if (!combined.find(s => s.id === importedSession.id)) {
        combined.push(importedSession);
      }
    });
    
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sessions, importedSessions]);

  // Load key package metadata when selected
  useEffect(() => {
    if (keyPackage.trim() !== '' && authState.publicKeyHex) {
      try {
        const metadata = JSON.parse(get_key_package_metadata(keyPackage));
        // Convert group_id to hex if it's not already
        let validGroupId = metadata.group_id;
        if (validGroupId && !/^[0-9a-fA-F]+$/.test(validGroupId.replace(/^0x/i, ''))) {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(validGroupId);
          validGroupId = Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          console.log('📝 Converted non-hex groupId to hex:', {
            original: metadata.group_id,
            converted: validGroupId
          });
        }
        setSigningGroupId(validGroupId);
        setSigningThreshold(metadata.threshold.toString());
        setSigningGroupVk(metadata.group_public_key);
        const pubkeys = Object.values(metadata.roster) as string[];
        if (!pubkeys.includes(authState.publicKeyHex)) {
          pubkeys.unshift(authState.publicKeyHex);
        }
        setSigningRoster(pubkeys);
        showToast({
          type: 'success',
          title: 'Key package loaded',
          message: 'Package metadata extracted successfully'
        });
      } catch (e: any) {
        showToast({
          type: 'error',
          title: 'Invalid key package',
          message: e.message
        });
      }
    }
  }, [keyPackage, authState.publicKeyHex]);

  // Helper function to convert ASCII to hex
  const asciiToHex = (str: string) => {
    const arr = new TextEncoder().encode(str);
    return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  // Calculate message hash properly for server
  const [messageHex, setMessageHex] = useState('');
  
  useEffect(() => {
    if (messageToSign) {
      const hex = asciiToHex(messageToSign);
      setMessageHex(hex);
    } else {
      setMessageHex('');
    }
  }, [messageToSign]);

  useEffect(() => {
    try {
      if (messageHex) {
        const hash = keccak256(messageHex); // Using WASM keccak256
        // Remove any "0x" prefix if present
        const cleanHash = hash.startsWith('0x') ? hash.slice(2) : hash;
        setMessageHash(cleanHash);
        console.log('🔍 Hash calculation debug:', {
          messageToSign,
          messageHex,
          rawHash: hash,
          cleanHash: cleanHash,
          messageHexLength: messageHex.length,
          hashLength: cleanHash.length,
          expected: 'hash should be 64 hex chars (32 bytes)'
        });
        
        // Test with known working example from WASM signing page
        if (messageToSign === 'hello frost') {
          const expectedHex = '68656c6c6f2066726f7374';
          const testHash = keccak256(expectedHex);
          const cleanTestHash = testHash.startsWith('0x') ? testHash.slice(2) : testHash;
          console.log('🧪 Test with known values:', {
            input: 'hello frost',
            expectedHex,
            actualHex: messageHex,
            hexMatch: messageHex === expectedHex,
            testHash: cleanTestHash
          });
        }
      } else {
        setMessageHash('');
      }
    } catch (e) {
      console.error('Hash calculation error:', e);
      setMessageHash('');
    }
  }, [messageHex]);

  // Calculate keccak256(abi.encodePacked(channelId, finalStateRoot)) hash
  useEffect(() => {
    try {
      if (channelId && finalStateRoot) {
        // Validate channelId is a valid number
        const channelIdNum = parseInt(channelId);
        if (isNaN(channelIdNum) || channelIdNum < 0) {
          setComputedHash('');
          return;
        }
        
        // Validate finalStateRoot is a valid hex string (32 bytes)
        const cleanStateRoot = finalStateRoot.startsWith('0x') ? finalStateRoot : `0x${finalStateRoot}`;
        if (!/^0x[a-fA-F0-9]{64}$/.test(cleanStateRoot)) {
          setComputedHash('');
          return;
        }

        // Use viem's encodeAbiParameters for proper abi.encodePacked equivalent
        // abi.encodePacked(uint256, bytes32) concatenates the values without padding
        const encoded = encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'bytes32' }],
          [BigInt(channelIdNum), cleanStateRoot as `0x${string}`]
        );
        
        // Remove the padding that encodeAbiParameters adds (we want packed encoding)
        // For uint256: take last 32 bytes, for bytes32: take as-is
        const channelIdHex = BigInt(channelIdNum).toString(16).padStart(64, '0');
        const stateRootHex = cleanStateRoot.slice(2);
        const packed = `0x${channelIdHex}${stateRootHex}` as `0x${string}`;
        
        const hash = ethersKeccak256(packed);
        setComputedHash(hash);
        setPackedData(packed);
      } else {
        setComputedHash('');
      }
    } catch (e) {
      setComputedHash('');
      setPackedData('');
    }
  }, [channelId, finalStateRoot]);

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
          const message = { type: 'ListPendingDKGSessions', payload: null };
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

  // Show signature success modal when signature is created
  useEffect(() => {
    if (finalSignature) {
      setShowSignatureSuccessModal(true);
    }
  }, [finalSignature]);

  // Listen for WebSocket messages and handle DKG rounds + Signing rounds
  useEffect(() => {
    if (!wsConnection) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle Round1All - all participants' Round 1 packages (DKG)
        if (message.type === 'Round1All' && message.payload?.session && message.payload?.packages) {
          console.log('📦 Handling Round1All message');
          handleRound1All(message.payload.session, message.payload.packages);
        }
        
        // Handle Round2All - encrypted Round 2 packages for this participant (DKG)
        if (message.type === 'Round2All' && message.payload?.session && message.payload?.packages) {
          console.log('📦 Handling Round2All message');
          handleRound2All(message.payload.session, message.payload.packages);
        }

        // Handle Signing messages
        if (message.type === 'SignSessionCreated') {
          const newSessionId = message.payload.session;
          setSigningSessionId(newSessionId);
          signingSessionIdRef[0].current = newSessionId;
          setSuccessMessage('✅ Signing session created!');
          console.log('🎉 Signing session created:', newSessionId);
          if (wsConnection) {
            wsConnection.send(JSON.stringify({ type: 'ListPendingSigningSessions', payload: null }));
          }
        }

        if (message.type === 'SignSessionAnnounced') {
          console.log('🎯 New signing session announced:', message.payload.session);
          setSuccessMessage('✅ New signing session announced');
          // Request updated session list from server for accurate data
          if (wsConnection) {
            console.log('🔄 Requesting updated signing sessions list after announcement');
            wsConnection.send(JSON.stringify({ type: 'ListPendingSigningSessions', payload: null }));
          }
        }

        if (message.type === 'SignSessionJoined') {
          console.log('✅ Successfully joined signing session:', message.payload.session);
          setJoiningSigningSession(null);
          setSuccessMessage(`✅ Joined signing session: ${message.payload.session}`);
          // Request updated session list from server to get accurate participant count
          if (wsConnection) {
            console.log('🔄 Requesting updated signing sessions list after join');
            wsConnection.send(JSON.stringify({ type: 'ListPendingSigningSessions', payload: null }));
          }
        }

        if (message.type === 'PendingSigningSessions') {
          setPendingSigningSessions(message.payload.sessions);
          console.log(`📋 Found ${message.payload.sessions.length} pending signing sessions`);
        }

        if (message.type === 'SignReadyRound1') {
          console.log('🚀 All participants joined. Starting Signing Round 1...');
          handleSigningRound1(message);
        }

        if (message.type === 'SignSigningPackage') {
          console.log('📦 Received signing package. Starting Round 2...');
          handleSigningRound2(message);
        }

        if (message.type === 'SignatureReady') {
          console.log('✅ Signature Ready!');
          setFinalSignature(message.payload.signature_bincode_hex);
          setFinalSignatureData({
            signature: message.payload.signature_bincode_hex,
            px: message.payload.px,
            py: message.payload.py,
            rx: message.payload.rx,
            ry: message.payload.ry,
            s: message.payload.s,
            message: message.payload.message,
          });
          setSuccessMessage('🎉 Threshold signature created successfully!');
        }

        // Handle server errors for signing sessions
        if (message.type === 'Error') {
          const serverError = message.payload?.message || message.payload || 'Unknown server error';
          console.error('❌ Server Error:', serverError);
          
          // Clear joining state on error
          if (joiningSigningSession !== null) {
            setJoiningSigningSession(null);
          }
          
          // Show the actual server error message
          setError(`Server Error: ${serverError}`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };

    wsConnection.addEventListener('message', handleMessage);

    return () => {
      wsConnection.removeEventListener('message', handleMessage);
    };
  }, [wsConnection, handleRound1All, handleRound2All, keyPackage, authState.dkgPrivateKey, authState.publicKeyHex]);

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
          type: 'AnnounceDKGSession',
          payload: {
            min_signers: params.minSigners,
            max_signers: params.maxSigners,
            group_id: `group_${Date.now()}`,
            participants: params.participants.map(p => p.uid),
            participants_pubs: params.participants.map(p => [
              p.uid, 
              {
                type: 'Secp256k1',
                key: p.publicKey
              }
            ])
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
    console.log('🎯 handleJoinSession called with sessionId:', sessionId);
    console.log('🎯 Current WebSocket state:', {
      connected: !!wsConnection,
      readyState: wsConnection?.readyState,
      authenticated: authState.isAuthenticated,
      hasPublicKey: !!authState.publicKeyHex,
      hasPrivateKey: !!authState.dkgPrivateKey
    });
    joinSession(sessionId);
  };

  const handleRefreshSession = (sessionId: string) => {
    if (wsConnection && authState.isAuthenticated) {
      const message = {
        type: 'JoinDKGSession',
        payload: { session: sessionId }
      };
      console.log('📤 Sending JoinDKGSession to refresh state:', message);
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
    // Use the same component as Download Key Share button
    setSelectedSession(session);
    setShowSessionDetails(true);
  };

  const handleDownloadKeyShare = (session?: DKGSession) => {
    const sessionToDownload = session || selectedSession;
    if (sessionToDownload) {
      // Extract uncompressed coordinates if the key is compressed
      let uncompressedKey = null;
      if (sessionToDownload.groupVerifyingKey) {
        if (isCompressedKey(sessionToDownload.groupVerifyingKey)) {
          const decompressed = decompressPublicKey(sessionToDownload.groupVerifyingKey);
          if (decompressed) {
            uncompressedKey = {
              px: '0x' + decompressed.px,
              py: '0x' + decompressed.py
            };
          }
        } else if (sessionToDownload.groupVerifyingKey.startsWith('04')) {
          // Already uncompressed, extract px and py
          uncompressedKey = {
            px: '0x' + sessionToDownload.groupVerifyingKey.slice(2, 66),
            py: '0x' + sessionToDownload.groupVerifyingKey.slice(66)
          };
        }
      }
      
      // Extract participant public keys from the roster
      const participantRoster = sessionToDownload.roster?.map(([participantId, identifier, publicKey]) => publicKey) || [];
      
      // Create a downloadable key share with uncompressed coordinates
      const keyShare = {
        session_id: sessionToDownload.id,
        group_verifying_key_compressed: sessionToDownload.groupVerifyingKey,
        group_verifying_key: uncompressedKey || {
          px: null,
          py: null,
          error: 'Could not decompress key'
        },
        my_role: sessionToDownload.myRole,
        participants: sessionToDownload.roster?.length || 0,
        participant_roster: participantRoster,
        threshold: `${sessionToDownload.minSigners}-of-${sessionToDownload.maxSigners}`,
        created_at: sessionToDownload.createdAt.toISOString()
      };

      const blob = new Blob([JSON.stringify(keyShare, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dkg_session_${sessionToDownload.id.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccessMessage('DKG session metadata downloaded successfully!');
    }
  };

  // New function to download individual key package for signing
  const handleDownloadKeyPackage = (session?: DKGSession) => {
    const sessionToDownload = session || selectedSession;
    if (!sessionToDownload) return;

    // Check if this user has a key package for this session
    const storageKey = `dkg_key_package_${sessionToDownload.id}`;
    const storedKeyPackage = localStorage.getItem(storageKey);
    
    if (!storedKeyPackage) {
      setError('No individual key package found. You must have participated in this DKG ceremony to download your key package.');
      return;
    }

    try {
      const keyPackageData = JSON.parse(storedKeyPackage);
      
      if (!keyPackageData.key_package_hex) {
        setError('Invalid key package data - missing key package hex');
        return;
      }

      // Extract uncompressed coordinates if available
      let uncompressedKey = null;
      if (sessionToDownload.groupVerifyingKey) {
        if (isCompressedKey(sessionToDownload.groupVerifyingKey)) {
          const decompressed = decompressPublicKey(sessionToDownload.groupVerifyingKey);
          if (decompressed) {
            uncompressedKey = {
              px: decompressed.px,
              py: decompressed.py
            };
          }
        } else if (sessionToDownload.groupVerifyingKey.startsWith('04')) {
          // Already uncompressed, extract px and py
          uncompressedKey = {
            px: sessionToDownload.groupVerifyingKey.slice(2, 66),
            py: sessionToDownload.groupVerifyingKey.slice(66)
          };
        }
      }

      // Create the individual key package file in the format expected by the signing page
      // This matches the format from the FROST reference implementation
      const keyPackageFile = {
        key_type: 'secp256k1', // Our implementation uses secp256k1
        encryptedKeyPackageHex: keyPackageData.key_package_hex, // The actual key package needed for signing
        finalGroupKeyCompressed: sessionToDownload.groupVerifyingKey || keyPackageData.group_public_key_hex,
        finalGroupKeyUncompressed: keyPackageData.group_public_key_uncompressed,
        px: uncompressedKey?.px,
        py: uncompressedKey?.py,
        salt: '2026', // Default salt used in our system
        session_id: sessionToDownload.id,
        group_id: keyPackageData.group_id || sessionToDownload.groupId,
        threshold: keyPackageData.threshold || sessionToDownload.minSigners,
        total_participants: keyPackageData.total || sessionToDownload.maxSigners,
        created_at: keyPackageData.timestamp || sessionToDownload.createdAt.toISOString()
      };

      const blob = new Blob([JSON.stringify(keyPackageFile, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Format: frost-key-{group_prefix}-{user_prefix}.json (matching the reference implementation)
      const groupPrefix = (sessionToDownload.groupVerifyingKey || keyPackageData.group_public_key_hex || '0000').slice(0, 4);
      const userPrefix = (authState.publicKeyHex || '0000').slice(0, 4);
      a.download = `frost-key-${groupPrefix}-${userPrefix}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccessMessage('Individual key package downloaded! Use this file in the signing page to participate in threshold signing.');
    } catch (error) {
      console.error('Error downloading key package:', error);
      setError('Failed to download key package: ' + (error as Error).message);
    }
  };

  const handleImportSession = () => {
    try {
      const sessionData = JSON.parse(importedSessionData);
      
      // Validate required fields
      if (!sessionData.session_id || !sessionData.group_verifying_key_compressed) {
        throw new Error('Invalid session data: missing required fields');
      }

      // Convert participant_roster to roster format expected by DKGSession
      const roster: Array<[number, string, string]> = [];
      if (sessionData.participant_roster && Array.isArray(sessionData.participant_roster)) {
        sessionData.participant_roster.forEach((pubkey: string, index: number) => {
          roster.push([index + 1, `participant_${index + 1}`, pubkey]);
        });
      }

      // Create a session object that matches our DKGSession interface
      const importedSession: DKGSession = {
        id: sessionData.session_id,
        creator: 'imported',
        minSigners: parseInt(sessionData.threshold?.split('-')[0]) || 0,
        maxSigners: parseInt(sessionData.threshold?.split('-')[2]) || sessionData.participants || 0,
        currentParticipants: sessionData.participants || 0,
        status: 'completed',
        groupId: sessionData.session_id, // Use session_id as groupId if not provided
        topic: 'imported',
        createdAt: sessionData.created_at ? new Date(sessionData.created_at) : new Date(),
        myRole: sessionData.my_role || 'participant',
        description: 'Imported session',
        participants: [],
        roster: roster,
        groupVerifyingKey: sessionData.group_verifying_key_compressed,
        automationMode: 'manual'
      };

      // Store in localStorage for persistence
      const storageKey = `dkg_imported_session_${sessionData.session_id}`;
      localStorage.setItem(storageKey, JSON.stringify({
        ...importedSession,
        imported: true,
        importedAt: new Date().toISOString()
      }));

      // Also store the key package data for signing
      if (sessionData.group_verifying_key || sessionData.group_verifying_key_compressed) {
        const keyPackageStorageKey = `dkg_key_package_imported_${sessionData.session_id}`;
        localStorage.setItem(keyPackageStorageKey, JSON.stringify({
          session_id: sessionData.session_id,
          group_id: sessionData.session_id,
          threshold: importedSession.minSigners,
          total: importedSession.maxSigners,
          timestamp: new Date().toISOString(),
          key_package_hex: '', // This would need to be provided separately for signing
          group_public_key_hex: sessionData.group_verifying_key_compressed,
          imported: true
        }));
      }

      setSuccessMessage(`✅ Session imported successfully: ${sessionData.session_id.slice(0, 8)}...`);
      setShowImportModal(false);
      setImportedSessionData('');
      
      // Refresh the page to show the imported session
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      setError(`Failed to import session: ${error instanceof Error ? error.message : 'Invalid JSON format'}`);
    }
  };

  const handleImportFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportedSessionData(content);
        showToast({
          type: 'success',
          title: 'File loaded',
          message: `${file.name} loaded successfully`
        });
      };
      reader.onerror = () => {
        setError('Failed to read file');
      };
      reader.readAsText(file);
    }
  };


  // Signing ceremony handlers
  const handleSigningRound1 = async (message: any) => {
    try {
      const { nonces_hex, commitments_hex } = JSON.parse(sign_part1_commit(keyPackage));
      signingState[0].current.nonces = nonces_hex;

      const myRosterEntry = message.payload.roster.find((p: [number, string, any]) => {
        // Handle both old string format and new RosterPublicKey object format
        const pubkey = typeof p[2] === 'string' ? p[2] : p[2].key;
        
        // Enhanced matching: case-insensitive and prefix-agnostic
        const normalizeKey = (key: string) => key.replace(/^0x/i, '').toLowerCase();
        return normalizeKey(pubkey) === normalizeKey(authState.publicKeyHex || '');
      });
      
      if (!myRosterEntry) {
        console.error('🔍 Roster matching failed:', {
          myPublicKey: authState.publicKeyHex,
          rosterEntries: message.payload.roster.map((p: any) => ({
            suid: p[0],
            idHex: p[1],
            pubkey: typeof p[2] === 'string' ? p[2] : p[2]
          }))
        });
        throw new Error("Could not find myself in session roster");
      }
      const myIdHex = myRosterEntry[1];
      signingState[0].current.identifier = myIdHex;
      signingState[0].current.group_id = message.payload.group_id;
      signingState[0].current.msg32_hex = message.payload.msg_keccak32_hex;

      const payload_hex = get_auth_payload_sign_r1(
        signingSessionIdRef[0].current,
        message.payload.group_id,
        myIdHex,
        commitments_hex
      );
      const signature = sign_message_wasm(authState.dkgPrivateKey!, payload_hex);

      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'SignRound1Submit',
          payload: {
            session: signingSessionIdRef[0].current,
            id_hex: myIdHex,
            commitments_bincode_hex: commitments_hex,
            signature_hex: signature,
          }
        }));
      }
      setSuccessMessage('✅ Round 1 commitments submitted');
    } catch (e: any) {
      setError(`Signing Round 1 failed: ${e.message}`);
    }
  };

  const handleSigningRound2 = async (message: any) => {
    try {
      const signature_share_hex = sign_part2_sign(
        keyPackage,
        signingState[0].current.nonces,
        message.payload.signing_package_bincode_hex
      );

      const payload_hex = get_auth_payload_sign_r2(
        signingSessionIdRef[0].current,
        signingState[0].current.group_id,
        signingState[0].current.identifier,
        signature_share_hex,
        signingState[0].current.msg32_hex
      );
      const signature = sign_message_wasm(authState.dkgPrivateKey!, payload_hex);

      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'SignRound2Submit',
          payload: {
            session: signingSessionIdRef[0].current,
            id_hex: signingState[0].current.identifier,
            signature_share_bincode_hex: signature_share_hex,
            signature_hex: signature,
          }
        }));
      }
      setSuccessMessage('✅ Round 2 signature share submitted');
    } catch (e: any) {
      setError(`Signing Round 2 failed: ${e.message}`);
    }
  };

  const handleLoadKeyPackage = (packageId: string) => {
    const pkg = availableKeyPackages.find(p => p.id === packageId);
    if (pkg) {
      setKeyPackage(pkg.keyPackageHex);
      setSelectedKeyPackageId(packageId);
      setSuccessMessage(`✅ Loaded key package for ${pkg.groupId}`);
    }
  };

  // Load key package and join session in one action (avoids state timing issues)
  const handleLoadAndJoinSession = (packageId: string, sessionId: string) => {
    const pkg = availableKeyPackages.find(p => p.id === packageId);
    if (!pkg) {
      setError('Key package not found');
      return;
    }

    // Set the key package state for future use
    setKeyPackage(pkg.keyPackageHex);
    setSelectedKeyPackageId(packageId);
    
    // Load metadata from key package
    try {
      const metadata = JSON.parse(get_key_package_metadata(pkg.keyPackageHex));
      // Convert group_id to hex if it's not already
      let validGroupId = metadata.group_id;
      if (validGroupId && !/^[0-9a-fA-F]+$/.test(validGroupId.replace(/^0x/i, ''))) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(validGroupId);
        validGroupId = Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        console.log('📝 Converted non-hex groupId to hex:', {
          original: metadata.group_id,
          converted: validGroupId
        });
      }
      setSigningGroupId(validGroupId);
      setSigningThreshold(metadata.threshold.toString());
      setSigningGroupVk(metadata.group_public_key);
    } catch (e) {
      console.warn('Could not load key package metadata:', e);
    }

    // Join immediately using the key package directly (not from state)
    try {
      setJoiningSigningSession(sessionId);
      signingSessionIdRef[0].current = sessionId;
      const prereqs = JSON.parse(get_signing_prerequisites(pkg.keyPackageHex));
      
      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'JoinSignSession',
          payload: {
            session: sessionId,
            signer_id_bincode_hex: prereqs.signer_id_bincode_hex,
            verifying_share_bincode_hex: prereqs.verifying_share_bincode_hex,
          }
        }));
      }
      console.log(`📤 Loaded key package and joining signing session: ${sessionId}`);
      setSuccessMessage(`Loaded key package and joining session...`);
    } catch (e: any) {
      setError(`Failed to join session: ${e.message}`);
      setJoiningSigningSession(null);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setKeyPackageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const data = JSON.parse(text);
          if (data.key_package_hex) {
            setKeyPackage(data.key_package_hex);
            setSuccessMessage(`✅ Loaded key package from ${file.name}`);
          } else {
            throw new Error('Invalid key package format');
          }
        } catch (error) {
          setError('Failed to load key package file');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleAnnounceSigningSession = () => {
    if (keyPackage.trim() === '') {
      setError('Please load a key package first');
      return;
    }
    
    // Validate authentication state before proceeding
    if (!authState.isAuthenticated || !authState.publicKeyHex) {
      setError('Please authenticate first');
      return;
    }
    
    // Determine which message source to use
    let finalMessage, finalMessageHex;
    
    if (packedData && computedHash) {
      // Use channel state message (channelId + finalStateRoot)
      finalMessage = packedData.slice(2); // Remove 0x prefix for server
      finalMessageHex = computedHash.slice(2); // Remove 0x prefix for server
      console.log('📦 Using channel state message:', {
        channelId,
        finalStateRoot,
        packedData,
        computedHash,
        finalMessage,
        finalMessageHex
      });
    } else if (messageToSign && messageHash) {
      // Use general text message
      finalMessage = messageHex;
      finalMessageHex = messageHash;
      console.log('📝 Using general text message:', {
        messageToSign,
        messageHex,
        messageHash,
        finalMessage,
        finalMessageHex
      });
    } else {
      setError('Please enter a message to sign or provide channel ID and final state root');
      return;
    }

    // Validate message format (allow 0x prefix)
    if (!finalMessage || !finalMessageHex) {
      setError('Missing message or message hash');
      return;
    }
    
    // Remove 0x prefix for validation if present
    const cleanMessage = finalMessage.replace(/^0x/i, '');
    const cleanMessageHex = finalMessageHex.replace(/^0x/i, '');
    
    if (!cleanMessage.match(/^[0-9a-fA-F]+$/) || cleanMessage.length === 0) {
      console.error('Invalid message format:', finalMessage);
      setError('Invalid message format. Must be a valid hex string.');
      return;
    }
    
    if (!cleanMessageHex.match(/^[0-9a-fA-F]+$/) || cleanMessageHex.length === 0) {
      console.error('Invalid message hex format:', finalMessageHex);
      setError('Invalid message hex format. Must be a valid hex string.');
      return;
    }
    
    console.log('✅ Message format validation passed:', {
      messageLength: cleanMessage.length,
      messageHexLength: cleanMessageHex.length
    });

    const thresholdNum = parseInt(signingThreshold);
    if (isNaN(thresholdNum) || thresholdNum < 1) {
      setError('Invalid threshold value');
      return;
    }

    // Validate roster data
    if (!signingRoster || signingRoster.length === 0) {
      setError('No participants in signing roster');
      return;
    }

    // Validate all public keys in roster
    const invalidKeys = signingRoster.filter(pubkey => {
      if (!pubkey) return true;
      const cleanKey = pubkey.replace(/^0x/i, '');
      return !cleanKey.match(/^[0-9a-fA-F]+$/) || cleanKey.length === 0;
    });
    
    if (invalidKeys.length > 0) {
      setError(`Invalid public keys in roster: ${invalidKeys.length} keys`);
      console.error('Invalid roster keys:', invalidKeys);
      return;
    }
    
    console.log('✅ Roster validation passed:', {
      totalKeys: signingRoster.length,
      validKeys: signingRoster.length - invalidKeys.length
    });

    const participants = signingRoster.map((_, i) => i + 1);
    const participants_pubs = signingRoster.map((pubkey, i) => [
      i + 1, 
      {
        type: 'Secp256k1',
        key: pubkey
      }
    ]);

    // Validate group ID and VK (allow 0x prefix)
    if (!signingGroupId || !signingGroupVk) {
      setError('Missing group ID or verification key');
      return;
    }
    
    // Remove 0x prefix for validation if present
    const cleanGroupId = signingGroupId.replace(/^0x/i, '');
    const cleanGroupVk = signingGroupVk.replace(/^0x/i, '');
    
    if (!cleanGroupId.match(/^[0-9a-fA-F]+$/) || cleanGroupId.length === 0) {
      console.error('Invalid group ID format:', signingGroupId);
      setError('Invalid group ID format. Must be a valid hex string.');
      return;
    }
    
    if (!cleanGroupVk.match(/^[0-9a-fA-F]+$/) || cleanGroupVk.length === 0) {
      console.error('Invalid verification key format:', signingGroupVk);
      setError('Invalid verification key format. Must be a valid hex string.');
      return;
    }
    
    console.log('✅ Group ID and VK validation passed:', {
      groupIdLength: cleanGroupId.length,
      vkLength: cleanGroupVk.length
    });

    // Log comprehensive validation info before sending
    console.log('✅ Message validation complete:', {
      authState: {
        isAuthenticated: authState.isAuthenticated,
        publicKeyHex: authState.publicKeyHex?.substring(0, 20) + '...'
      },
      messageValidation: {
        finalMessage: finalMessage.substring(0, 40) + '...',
        finalMessageHex: finalMessageHex.substring(0, 40) + '...',
        finalMessageLength: finalMessage.length,
        finalMessageHexLength: finalMessageHex.length,
        isValidHex: finalMessage.match(/^[0-9a-fA-F]+$/) && finalMessageHex.match(/^[0-9a-fA-F]+$/)
      },
      sessionData: {
        groupId: signingGroupId.substring(0, 20) + '...',
        threshold: thresholdNum,
        participantsCount: participants.length,
        groupVkLength: signingGroupVk.length
      },
      roster: signingRoster.map(key => key.substring(0, 20) + '...')
    });

    if (wsConnection) {
      const message = {
        type: 'AnnounceSignSession',
        payload: {
          group_id: signingGroupId,
          threshold: thresholdNum,
          participants,
          participants_pubs,
          group_vk_sec1_hex: signingGroupVk,
          message: finalMessage,
          message_hex: finalMessageHex,
        }
      };
      
      try {
        const messageStr = JSON.stringify(message);
        console.log('📤 Sending signing session message:', {
          messageLength: messageStr.length,
          payloadKeys: Object.keys(message.payload),
          participantsPubsValid: participants_pubs.every(([id, pubkey]) => 
            typeof id === 'number' && typeof pubkey === 'object' && pubkey.type === 'Secp256k1' && pubkey.key.match(/^[0-9a-fA-F]+$/)
          )
        });
        
        wsConnection.send(messageStr);
        console.log('✅ Signing session message sent successfully');
      } catch (e) {
        console.error('❌ Failed to send signing session message:', e);
        setError('Failed to send message. Please try again.');
        return;
      }
    }
  };

  const handleJoinSigningSession = (session: string) => {
    if (keyPackage.trim() === '') {
      setError('Please load a key package first');
      return;
    }
    try {
      setJoiningSigningSession(session);
      signingSessionIdRef[0].current = session;
      const prereqs = JSON.parse(get_signing_prerequisites(keyPackage));
      
      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'JoinSignSession',
          payload: {
            session,
            signer_id_bincode_hex: prereqs.signer_id_bincode_hex,
            verifying_share_bincode_hex: prereqs.verifying_share_bincode_hex,
          }
        }));
      }
      console.log(`📤 Joining signing session: ${session}`);
    } catch (e: any) {
      setError(`Failed to join session: ${e.message}`);
    }
  };

  const handleDownloadSignature = () => {
    if (!finalSignatureData) return;

    const signatureJSON = {
      signature_bincode_hex: finalSignatureData.signature,
      message: finalSignatureData.message,
      message_hex: "",
      rx: finalSignatureData.rx,
      ry: finalSignatureData.ry,
      z: finalSignatureData.s,
      px: finalSignatureData.px,
      py: finalSignatureData.py,
      group_id: signingGroupId,
      threshold: signingThreshold,
      created_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(signatureJSON, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frost_signature_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSuccessMessage('✅ Signature downloaded successfully!');
  };


  if (!isConnected) {
    return (
      <Layout title="DKG Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="p-8 max-w-md bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7] animate-fade-in">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 rounded-full flex items-center justify-center mx-auto animate-bounce-in">
                <Zap className="w-8 h-8 text-[#4fc3f7]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Connect Your Wallet
                </h3>
                <p className="text-gray-300 mb-4">
                  Connect your wallet to participate in distributed key generation ceremonies
                </p>
              </div>
              <ConnectButton />
              <div className="text-xs text-gray-500 space-y-1">
                <p>• Secure threshold signature creation</p>
                <p>• No private keys stored on server</p>
                <p>• Full decentralized ceremony</p>
              </div>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Layout title="DKG Management">
        <div className="max-w-7xl mx-auto space-y-6 p-4 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  DKG Management
                </h1>
              </div>
              <p className="text-gray-300">
                Simple, guided experience for threshold signature creation
              </p>
            </div>

          </div>

        {/* WASM Status Indicator */}
        <DKGWasmStatus />

        {/* Statistics */}
        <Card className="p-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">
              {allSessions.length} DKG Session(s) • {allSessions.filter(s => s.status === 'waiting').length} Active
              <br />
              Created: {allSessions.filter(s => s.myRole === 'creator').length} • Joined: {allSessions.filter(s => s.myRole === 'participant').length}
            </div>
            {allSessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearAllSessions();
                  // Also clear imported sessions state
                  setImportedSessions([]);
                }}
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
          />
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
        <div className="flex space-x-1 bg-[#0a1930] border border-[#4fc3f7]/30 p-1 rounded-lg">
          {[
            { id: 'quick-start', label: 'Quick Start', icon: Zap },
            { id: 'sessions', label: 'DKG Sessions', icon: ClipboardList },
            { id: 'server', label: 'Server Deployment', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                onClick={() => {
                  setActiveTab(tab.id);
                }}
                className="flex-1 justify-center text-sm relative transition-all hover:scale-105"
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'quick-start' && (
          <DKGQuickStart
            connectionStatus={connectionStatus}
            authState={{
              ...authState,
              publicKeyHex: authState.publicKeyHex ?? undefined
            }}
            isCreatingSession={isCreatingSession}
            onCreateSession={handleCreateSession}
            onJoinSession={handleJoinSession}
            onConnectToServer={handleConnectToServer}
            onAuthenticate={authenticate}
            onGetPublicKey={getDeterministicPublicKey}
            onSwitchToSessionsTab={() => setActiveTab('sessions')}
            sessions={allSessions}
            pendingSigningSessions={pendingSigningSessions}
            isJoiningSession={isJoiningSession}
            serverUrl={serverUrl}
            setServerUrl={setServerUrl}
          />
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-6">
            {/* Import Session Button */}
            <Card className="p-4 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Upload className="w-5 h-5 text-[#4fc3f7]" />
                  <div>
                    <h3 className="text-lg font-medium text-white">Import Session</h3>
                    <p className="text-sm text-gray-400">Import a previously downloaded DKG session</p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowImportModal(true)}
                  className="bg-[#028bee] hover:bg-[#0277d4]"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Session
                </Button>
              </div>
            </Card>

            {/* Download Types Help */}
            <Card className="p-4 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30">
              <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <Download className="w-5 h-5 text-[#4fc3f7]" />
                Download Options
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                    <Download className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-400">Session Metadata</h4>
                    <p className="text-gray-400 mt-1">Downloads session info for importing/sharing. Contains group public key and participant roster.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center flex-shrink-0">
                    <Download className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-green-400">Key Package</h4>
                    <p className="text-gray-400 mt-1">Downloads your individual key package for threshold signing. Only available if you participated in the DKG ceremony.</p>
                  </div>
                </div>
              </div>
            </Card>

            <DKGSessionGrid
              sessions={allSessions}
              address={address}
              onJoinSession={handleJoinSession}
              onViewDetails={handleViewMore}
              onStartAutomation={startAutomatedCeremony}
              onDownloadKey={handleDownloadKeyShare}
              onDownloadKeyPackage={handleDownloadKeyPackage}
              isJoiningSession={isJoiningSession}
              authState={authState}
              wsConnection={wsConnection}
            />
          </div>
        )}

        {activeTab === 'server' && (
          <DKGServerDeploymentGuide 
            onSuccessMessage={setSuccessMessage}
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
            publicKeyHex: authState.publicKeyHex ?? undefined
          }}
          onClose={closeCommitmentModal}
          onSubmit={handleSubmitCommitment}
        />

        {/* Import Session Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
              onClick={() => setShowImportModal(false)}
            />
            <div className="relative z-10 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-2 border-[#4fc3f7] rounded-lg shadow-2xl w-full max-w-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
              <div className="p-6">
                <h2 className="text-xl font-bold text-white mb-4">Import DKG Session</h2>
                <textarea
                  value={importedSessionData}
                  onChange={(e) => setImportedSessionData(e.target.value)}
                  placeholder="Paste your DKG session JSON data here..."
                  className="w-full h-32 p-3 bg-gray-900 border border-gray-700 text-white"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 border border-gray-600 text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportSession}
                    className="px-4 py-2 bg-blue-600 text-white"
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </Layout>
      
      {/* Session Details Modal */}
      {showSessionDetails && selectedSession && (
        <DKGSessionDetails
          session={selectedSession}
          onClose={() => setShowSessionDetails(false)}
          onDownloadKeyShare={handleDownloadKeyShare}
        />
      )}
    </>
  );
}

export default function DKGManagementPage() {
  return <DKGManagementPageInner />;
}
