'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Plus, Link2, ClipboardList, CheckCircle, X, Trash2, PenTool, Upload, Download, RefreshCw, FileText, Server } from 'lucide-react';
import { initWasm } from '@/lib/frost-wasm';
import { DKG_CONFIG, shouldAutoConnect, debugLog } from '@/lib/dkg-config';
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
import { DKGConsoleSettings } from '@/components/dkg/DKGConsoleSettings';
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

export default function DKGManagementPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  
  // UI state
  const [activeTab, setActiveTab] = useState('sessions');
  const [serverUrl, setServerUrl] = useState(''); // Empty by default, user must enter URL manually
  const [selectedSession, setSelectedSession] = useState<DKGSession | null>(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newlyCreatedSession, setNewlyCreatedSession] = useState<DKGSession | null>(null);
  const [showConsoleSettings, setShowConsoleSettings] = useState(false);

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
        // Load available key packages from localStorage
        loadAvailableKeyPackages();
      })
      .catch(err => {
        console.error('❌ Failed to initialize FROST WASM:', err);
        setError('Failed to initialize cryptographic module. Please refresh the page.');
      });
  }, []);

  // Validate and clean localStorage data to prevent sync issues
  const validateAndCleanLocalStorage = () => {
    console.log('🧹 Validating and cleaning localStorage data...');
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('dkg_')) {
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
          
          // Check for stale data (older than 24 hours)
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
        setSuccessMessage('✅ Key package loaded successfully!');
      } catch (e: any) {
        setError(`Invalid key package: ${e.message}`);
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

  const handleDownloadKeyShare = () => {
    if (selectedSession) {
      // Extract uncompressed coordinates if the key is compressed
      let uncompressedKey = null;
      if (selectedSession.groupVerifyingKey) {
        if (isCompressedKey(selectedSession.groupVerifyingKey)) {
          const decompressed = decompressPublicKey(selectedSession.groupVerifyingKey);
          if (decompressed) {
            uncompressedKey = {
              px: '0x' + decompressed.px,
              py: '0x' + decompressed.py
            };
          }
        } else if (selectedSession.groupVerifyingKey.startsWith('04')) {
          // Already uncompressed, extract px and py
          uncompressedKey = {
            px: '0x' + selectedSession.groupVerifyingKey.slice(2, 66),
            py: '0x' + selectedSession.groupVerifyingKey.slice(66)
          };
        }
      }
      
      // Create a downloadable key share with uncompressed coordinates
      const keyShare = {
        session_id: selectedSession.id,
        group_verifying_key_compressed: selectedSession.groupVerifyingKey,
        group_verifying_key: uncompressedKey || {
          px: null,
          py: null,
          error: 'Could not decompress key'
        },
        my_role: selectedSession.myRole,
        participants: selectedSession.roster?.length || 0,
        threshold: `${selectedSession.minSigners}-of-${selectedSession.maxSigners}`,
        created_at: selectedSession.createdAt.toISOString()
      };

      const blob = new Blob([JSON.stringify(keyShare, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dkg_key_${selectedSession.id.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccessMessage('Key share downloaded successfully with uncompressed coordinates!');
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
      
      // Clear all key packages
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('dkg_key_package_')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('✅ All DKG localStorage data cleared');
      
      // Force reload to reset all state
      window.location.reload();
      
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
            { id: 'sessions', label: 'DKG Sessions', icon: ClipboardList },
            { id: 'create', label: 'Create DKG', icon: Plus },
            { id: 'join', label: 'Join DKG', icon: Link2 },
            { id: 'signing', label: 'Signing Sessions', icon: PenTool, badge: pendingSigningSessions.length },
            { id: 'server', label: 'Server Deployment', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'signing') {
                    loadAvailableKeyPackages();
                    if (wsConnection && authState.isAuthenticated) {
                      wsConnection.send(JSON.stringify({ type: 'ListPendingSigningSessions', payload: null }));
                    }
                  }
                }}
                className="flex-1 justify-center text-sm relative"
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#028bee] text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-lg shadow-[#028bee]/50 animate-pulse">
                    {tab.badge}
                  </span>
                )}
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
              onSubmitRound1={undefined}  // Disabled: Now automatic via WebSocket
              onSubmitRound2={undefined}  // Disabled: Now automatic via WebSocket
              onSubmitFinalization={undefined}  // Disabled: Now automatic via WebSocket
              onStartAutomatedCeremony={startAutomatedCeremony}
              onJoinSession={handleJoinSession}
              isSubmittingRound1={false}
              isSubmittingRound2={false}
              isSubmittingFinalize={false}
              isJoiningSession={isJoiningSession}
              authState={authState}
              wsConnection={wsConnection}
            />
          </div>
        )}

        {activeTab === 'create' && (
          <DKGSessionCreator
            connectionStatus={connectionStatus}
            authState={{
              isAuthenticated: authState.isAuthenticated,
              publicKeyHex: authState.publicKeyHex ?? undefined
            }}
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
            error={error}
            onJoinSession={handleJoinSession}
            onDismissSuccess={() => setSuccessMessage('')}
          />
        )}

        {activeTab === 'signing' && (
          <div className="space-y-6">
            {/* Pending Signing Sessions */}
            <Card className="p-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 flex items-center justify-center">
                    <PenTool className="w-5 h-5 text-[#4fc3f7]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Pending Signing Sessions</h3>
                    <p className="text-sm text-gray-400">
                      {pendingSigningSessions.length > 0 
                        ? `${pendingSigningSessions.length} session${pendingSigningSessions.length !== 1 ? 's' : ''} waiting for participants` 
                        : 'No pending sessions'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (wsConnection) {
                      wsConnection.send(JSON.stringify({ type: 'ListPendingSigningSessions', payload: null }));
                    }
                  }}
                  variant="outline"
                  size="sm"
                  disabled={!wsConnection}
                  className="bg-[#028bee] hover:bg-[#0277d4] text-white border-[#028bee]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {pendingSigningSessions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-[#4fc3f7]/10 border-2 border-dashed border-[#4fc3f7]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PenTool className="w-8 h-8 text-[#4fc3f7]/50" />
                  </div>
                  <p className="text-gray-300 mb-2 font-medium">No Signing Sessions Available</p>
                  <p className="text-gray-400 text-sm">Create a new session or wait for others to announce one</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingSigningSessions.map((session: any) => {
                    // Try to match key packages - handle both hex and non-hex group IDs
                    const matchingPkg = availableKeyPackages.find(pkg => {
                      // Direct match
                      if (pkg.groupId === session.group_id) return true;
                      
                      // If session.group_id is hex, try converting pkg.groupId to hex
                      if (/^[0-9a-fA-F]+$/.test(session.group_id)) {
                        const encoder = new TextEncoder();
                        const bytes = encoder.encode(pkg.groupId);
                        const pkgGroupIdHex = Array.from(bytes)
                          .map(b => b.toString(16).padStart(2, '0'))
                          .join('');
                        return pkgGroupIdHex === session.group_id;
                      }
                      
                      // If pkg.groupId is hex, try converting session.group_id to hex
                      if (/^[0-9a-fA-F]+$/.test(pkg.groupId)) {
                        const encoder = new TextEncoder();
                        const bytes = encoder.encode(session.group_id);
                        const sessionGroupIdHex = Array.from(bytes)
                          .map(b => b.toString(16).padStart(2, '0'))
                          .join('');
                        return pkg.groupId === sessionGroupIdHex;
                      }
                      
                      return false;
                    });
                    const hasKey = keyPackage || matchingPkg;
                    const progress = (session.joined.length / session.participants.length) * 100;
                    
                    return (
                      <Card key={session.session} className="p-5 bg-[#0a1930] border-[#4fc3f7]/30 hover:border-[#4fc3f7]/60 transition-all">
                        <div className="space-y-4">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-[#4fc3f7]/20 text-[#4fc3f7] border-[#4fc3f7]/30 text-xs">
                                  Session
                                </Badge>
                                <p className="text-white font-mono text-sm">{session.session.slice(0, 18)}...</p>
                              </div>
                              <p className="text-gray-300 font-medium mb-1">Group: {session.group_id}</p>
                              <div className="bg-[#0f1729]/50 border border-[#4fc3f7]/20 p-3 mt-2">
                                <p className="text-xs text-gray-400 mb-1">Message to Sign:</p>
                                <p className="text-white text-sm">{session.message}</p>
                              </div>
                            </div>
                            {hasKey ? (
                              <div className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-medium">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Key Available
                              </div>
                            ) : (
                              <div className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium">
                                <X className="w-3.5 h-3.5" />
                                No Key
                              </div>
                            )}
                          </div>

                          {/* Progress Bar */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-400">Participants</span>
                              <span className="text-xs font-medium text-white">
                                {session.joined.length}/{session.participants.length}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[#0f1729] border border-[#4fc3f7]/20 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-[#4fc3f7] to-[#028bee] transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Action Button */}
                          {!hasKey ? (
                            <Button
                              disabled
                              className="w-full bg-gray-600 cursor-not-allowed"
                              size="sm"
                            >
                              No Key Package Available
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                // Auto-load key package if needed, then join
                                if (!keyPackage && matchingPkg) {
                                  // Use the combined function that loads and joins atomically
                                  handleLoadAndJoinSession(matchingPkg.id, session.session);
                                } else {
                                  handleJoinSigningSession(session.session);
                                }
                              }}
                              disabled={joiningSigningSession !== null || !authState.isAuthenticated}
                              className="w-full bg-[#028bee] hover:bg-[#0277d4]"
                              size="sm"
                            >
                              {joiningSigningSession === session.session ? 'Joining...' : 'Join Session'}
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Signature Creator Section */}
            <Card className="p-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-500/20 border border-purple-500/50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Channel State Signature Creator</h3>
                  <p className="text-sm text-gray-400">Generate keccak256(abi.encodePacked(channelId, finalStateRoot)) for signing</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Channel ID
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                      placeholder="Enter channel ID (e.g., 1)"
                      className="w-full px-3 py-2 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-md text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Final State Root
                    </label>
                    <input
                      type="text"
                      value={finalStateRoot}
                      onChange={(e) => setFinalStateRoot(e.target.value)}
                      placeholder="0x... (32 bytes hex)"
                      className="w-full px-3 py-2 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-md text-white placeholder-gray-500 font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Hash Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Computed Hash (keccak256)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={computedHash}
                      readOnly
                      placeholder="Hash will appear here when both fields are valid"
                      className="w-full px-3 py-2 bg-[#0f1729] border border-[#4fc3f7]/50 rounded-md text-green-400 placeholder-gray-500 font-mono text-sm"
                    />
                    {computedHash && (
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(computedHash);
                          setSuccessMessage('Hash copied to clipboard!');
                        }}
                        size="sm"
                        variant="ghost"
                        className="absolute right-2 top-1 h-8 px-2 text-green-400 hover:bg-green-500/20"
                      >
                        Copy
                      </Button>
                    )}
                  </div>
                  {computedHash && (
                    <p className="text-xs text-gray-400 mt-1">
                      ✅ This hash can be used as the message in the signing session below
                    </p>
                  )}
                </div>

                {/* Quick Set Button */}
                {computedHash && packedData && (
                  <Button
                    onClick={() => {
                      setMessageToSign(packedData);
                      setSuccessMessage('Packed data set as message to sign!');
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    Use This Hash as Message to Sign
                  </Button>
                )}

                {/* Help text */}
                <div className="p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-300 mb-2">How to use:</h4>
                  <ul className="text-xs text-blue-200/90 space-y-1">
                    <li>• Enter the channel ID (number) and final state root (32-byte hex)</li>
                    <li>• The app will compute keccak256(abi.encodePacked(channelId, finalStateRoot))</li>
                    <li>• Use the computed hash as the message in the signing session below</li>
                    <li>• This creates a signature that can be used for channel state verification</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Create New Signing Session Section */}
            <Card className="p-6 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#028bee]/20 border border-[#028bee]/50 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-[#028bee]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Create New Signing Session</h3>
                  <p className="text-sm text-gray-400">Select a key package and create a signing session</p>
                </div>
              </div>

              {/* Key Package Selection */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-white mb-4">1. Select Key Package</h4>
              
              {availableKeyPackages.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-[#4fc3f7]/30">
                  <PenTool className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">No key packages found</p>
                  <p className="text-gray-400 text-sm">Complete a DKG ceremony first to generate key packages</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    {availableKeyPackages.map((pkg) => (
                      <Card
                        key={pkg.id}
                        className={`p-4 cursor-pointer transition-all ${
                          selectedKeyPackageId === pkg.id
                            ? 'bg-[#4fc3f7]/20 border-[#4fc3f7]'
                            : 'bg-[#0a1930] border-[#4fc3f7]/30 hover:border-[#4fc3f7]/50'
                        }`}
                        onClick={() => handleLoadKeyPackage(pkg.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{pkg.groupId}</p>
                            <p className="text-gray-400 text-sm">
                              Threshold: {pkg.threshold || 0}-of-{pkg.total || 0} | 
                              Created: {new Date(pkg.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                          {selectedKeyPackageId === pkg.id && (
                            <CheckCircle className="w-5 h-5 text-[#4fc3f7]" />
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="border-t border-[#4fc3f7]/30 pt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Or upload key package file
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-md text-white"
                    />
                  </div>
                </div>
              )}
              </div>

              {/* Create Signing Session Form */}
            {keyPackage && (
                <div className="border-t border-[#4fc3f7]/30 pt-6">
                  <h4 className="text-md font-semibold text-white mb-4">2. Create Signing Session</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Group ID (from DKG)
                    </label>
                    <input
                      type="text"
                      value={signingGroupId}
                      disabled
                      className="w-full px-3 py-2 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-md text-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Message to Sign
                    </label>
                    <input
                      type="text"
                      value={messageToSign}
                      onChange={(e) => setMessageToSign(e.target.value)}
                      placeholder="Enter message to sign..."
                        className="w-full px-3 py-2 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-md text-white placeholder-gray-500 font-mono text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Threshold
                      </label>
                      <input
                        type="text"
                        value={signingThreshold}
                        disabled
                        className="w-full px-3 py-2 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-md text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Participants
                      </label>
                      <input
                        type="text"
                        value={signingRoster.length}
                        disabled
                        className="w-full px-3 py-2 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-md text-gray-400"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleAnnounceSigningSession}
                    disabled={!connectionStatus || connectionStatus !== 'connected' || !authState.isAuthenticated || !messageHash}
                      className="w-full bg-[#028bee] hover:bg-[#0277d4]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Signing Session
                  </Button>
                </div>
                </div>
              )}
            </Card>

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


        {/* Signature Success Modal */}
        {showSignatureSuccessModal && finalSignature && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop with stronger blur */}
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
              onClick={() => setShowSignatureSuccessModal(false)}
            />
            
            {/* Modal */}
            <div className="relative z-[201] bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-2 border-[#4fc3f7] shadow-2xl shadow-[#4fc3f7]/50 w-full max-w-2xl rounded-lg animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
              {/* Header */}
              <div className="p-8 text-center border-b border-[#4fc3f7]/30">
                <div className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-[#4fc3f7]/20 border-2 border-[#4fc3f7] rounded-full animate-pulse">
                  <CheckCircle className="w-12 h-12 text-[#4fc3f7]" />
                </div>
                <h2 className="text-4xl font-bold text-white mb-3">
                  Signature Created Successfully
                </h2>
                <p className="text-lg text-gray-300">
                  Your threshold signature has been generated and is ready to use
                </p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Signature Display */}
                <div className="bg-[#0f1729]/50 p-4 rounded-lg border border-[#4fc3f7]/30">
                  <label className="block text-sm font-medium text-[#4fc3f7] mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Final Signature (bincode hex)
                  </label>
                  <textarea
                    readOnly
                    value={finalSignature}
                    rows={4}
                    className="w-full px-4 py-3 bg-[#0a1930] border border-[#4fc3f7]/50 rounded-md text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {/* Download Button - Primary Action */}
                  <Button 
                    onClick={() => {
                      handleDownloadSignature();
                      setShowSignatureSuccessModal(false);
                    }}
                    className="w-full h-16 bg-[#028bee] hover:bg-[#0277d4] text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                  >
                    <Download className="w-6 h-6 mr-3" />
                    Download Signature JSON
                  </Button>

                  {/* Next Steps Info */}
                  <div className="p-4 bg-[#4fc3f7]/10 border border-[#4fc3f7]/30 rounded-lg">
                    <p className="text-sm text-gray-200 text-center font-medium">
                      <strong className="text-[#4fc3f7]">Next Step:</strong> Use this signature file in the "Sign Proof" page to submit to the blockchain
                    </p>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => setShowSignatureSuccessModal(false)}
                    className="w-full h-12 bg-transparent hover:bg-[#4fc3f7]/10 border border-[#4fc3f7]/50 hover:border-[#4fc3f7] text-white font-medium rounded transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}