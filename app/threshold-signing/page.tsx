'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { Layout } from '@/components/Layout';
import { FileUp, MessageSquare, CheckCircle, Clock, Users, Download, RefreshCw, X } from 'lucide-react';
import { 
  initWasm, 
  signRound1Commit, 
  signRound2Sign, 
  getSigningPrerequisites, 
  getAuthPayloadSignR1, 
  getAuthPayloadSignR2, 
  signMessageECDSA
} from '@/lib/frost-wasm';
import { useDKGWebSocket } from '@/hooks/useDKGWebSocket';
import { getDKGServerUrl, shouldAutoConnect, debugLog } from '@/lib/dkg-config';
import { DKGConnectionStatus } from '@/components/dkg/DKGConnectionStatus';
import { SigningSessionModal } from '@/components/SigningSessionModal';

interface SigningSession {
  id: string;
  group_id: string;
  threshold: number;
  participants: number[];
  participants_pubs: Array<[number, string]>;
  group_vk_sec1_hex: string;
  message: string;
  message_hex: string;
  status: string;
  current_participants: number;
  round: number;
  created_at?: Date;
}

interface SigningState {
  nonces: string;
  identifier: string;
  group_id: string;
  msg32_hex: string;
}

interface FinalSignature {
  signature: string;
  message: string;
  rx: string;
  ry: string;
  s: string;
  px: string;
  py: string;
}

export default function ThresholdSigningPage() {
  const { address, isConnected } = useAccount();
  
  // State management
  const [activeTab, setActiveTab] = useState<'create' | 'sessions'>('sessions');
  const [signingSessions, setSigningSessions] = useState<SigningSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<SigningSession | null>(null);
  const [serverUrl, setServerUrl] = useState(getDKGServerUrl());
  const [showSigningModal, setShowSigningModal] = useState(false);
  const [selectedKeyPackageForModal, setSelectedKeyPackageForModal] = useState<any>(null);
  
  // Use the DKG WebSocket hook for connection management
  const {
    wsConnection,
    connectionStatus,
    authState,
    requestChallenge,
    getDeterministicPublicKey,
    authenticate,
    clearAuth,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    connectToServer,
  } = useDKGWebSocket(address);
  
  // Key package management
  const [keyPackage, setKeyPackage] = useState('');
  const [availableKeyPackages, setAvailableKeyPackages] = useState<Array<{id: string, groupId: string, keyPackageHex: string, threshold?: number, total?: number, groupPublicKeyHex?: string, type?: string, imported?: boolean}>>([]);
  const [selectedKeyPackageId, setSelectedKeyPackageId] = useState('');
  
  
  // Create session form
  const [messageToSign, setMessageToSign] = useState('');
  const [messageHash, setMessageHash] = useState('');
  const [signingGroupId, setSigningGroupId] = useState('');
  const [signingThreshold, setSigningThreshold] = useState('2');
  const [signingGroupVk, setSigningGroupVk] = useState('');
  const [signingRoster, setSigningRoster] = useState<string[]>(['', '', '']);
  
  // Signing state
  const [joiningSigningSession, setJoiningSigningSession] = useState('');
  const [joinedSigningSessions, setJoinedSigningSessions] = useState<Set<string>>(new Set());
  const signingSessionIdRef = useRef<string>('');
  const signingState = useRef<SigningState>({
    nonces: '',
    identifier: '',
    group_id: '',
    msg32_hex: ''
  });
  const [finalSignatureData, setFinalSignatureData] = useState<FinalSignature | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);

  // Initialize WASM
  useEffect(() => {
    debugLog('Initializing FROST WASM module...');
    initWasm()
      .then(() => {
        debugLog('FROST WASM module initialized successfully');
        loadAvailableKeyPackages();
      })
      .catch(err => {
        console.error('❌ Failed to initialize FROST WASM:', err);
        setError('Failed to initialize cryptographic module. Please refresh the page.');
      });
  }, []);

  // Load available key packages from localStorage
  const loadAvailableKeyPackages = () => {
    console.log('🔍 [DEBUG] Loading available key packages from localStorage...');
    const packages: any[] = [];
    const totalKeys = localStorage.length;
    console.log('🔍 [DEBUG] Total localStorage keys:', totalKeys);
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      // Load actual key packages (for signing)
      if (key?.startsWith('dkg_key_package_')) {
        console.log('🔍 [DEBUG] Found key package:', key);
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          const pkg = {
            id: key,
            sessionId: data.session_id,
            groupId: data.group_id,
            threshold: data.threshold ?? 0,
            total: data.total ?? 0,
            timestamp: data.timestamp,
            keyPackageHex: data.key_package_hex,
            groupPublicKeyHex: data.group_public_key_hex,
            type: 'key_package'
          };
          console.log('🔍 [DEBUG] Parsed key package:', {
            id: pkg.id,
            groupId: pkg.groupId,
            threshold: pkg.threshold,
            total: pkg.total,
            timestamp: pkg.timestamp
          });
          packages.push(pkg);
        } catch (e) {
          console.error('Failed to parse key package:', key, e);
        }
      }
      
    }
    
    const sortedPackages = packages.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    console.log('✅ [DEBUG] Loaded packages:', sortedPackages.length, 'total');
    console.log('🔍 [DEBUG] Key packages:', sortedPackages.filter(p => p.type === 'key_package').length);
    console.log('🔍 [DEBUG] All packages details:', sortedPackages.map(p => ({
      type: p.type,
      id: p.id,
      groupId: p.groupId,
      threshold: p.threshold,
      total: p.total
    })));
    
    setAvailableKeyPackages(sortedPackages);
  };

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

  // Request pending signing sessions after authentication
  useEffect(() => {
    if (connectionStatus === 'connected' && authState.isAuthenticated && wsConnection) {
      console.log('🔄 Requesting pending signing sessions');
      // Add a small delay to ensure the connection is fully ready
      setTimeout(() => {
        requestPendingSigningSessions();
      }, 500);
    }
  }, [connectionStatus, authState.isAuthenticated, wsConnection]);

  // Function to request pending signing sessions
  const requestPendingSigningSessions = () => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      console.log('📋 Requesting list of pending signing sessions');
      console.log('🔍 Current auth state:', {
        isAuthenticated: authState.isAuthenticated,
        publicKeyHex: authState.publicKeyHex?.substring(0, 20) + '...',
        userId: authState.userId
      });
      console.log('🔍 Current signing sessions count:', signingSessions.length);
      console.log('🔍 WebSocket ready state:', wsConnection.readyState);
      wsConnection.send(JSON.stringify({ type: 'ListPendingSigningSessions', payload: null }));
    } else {
      console.warn('❌ Cannot request pending sessions - WebSocket not ready:', {
        wsConnection: !!wsConnection,
        readyState: wsConnection?.readyState
      });
    }
  };

  // Listen for WebSocket messages for signing sessions
  useEffect(() => {
    if (!wsConnection) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    wsConnection.addEventListener('message', handleMessage);
    
    return () => {
      wsConnection.removeEventListener('message', handleMessage);
    };
  }, [wsConnection, keyPackage, authState]);

  // Handle signing session announced
  const handleSignSessionAnnounced = (payload: any) => {
    console.log('🎯 SignSessionAnnounced received:', payload);
    console.log('🔍 Current connection status:', connectionStatus);
    console.log('🔍 Current auth status:', authState.isAuthenticated);
    console.log('🔍 Current signing sessions count before refresh:', signingSessions.length);
    
    // Request updated session list from server for accurate data
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      console.log('🔄 Requesting updated signing sessions list after announcement');
      console.log('📤 Sending ListPendingSigningSessions request...');
      wsConnection.send(JSON.stringify({ type: 'ListPendingSigningSessions', payload: null }));
      
      // Add timeout to check if we receive a response
      setTimeout(() => {
        console.log('🔍 Sessions count after announcement request:', signingSessions.length);
        if (signingSessions.length === 0) {
          console.warn('❌ No sessions received after announcement - there might be a communication issue');
        }
      }, 2000);
    } else {
      console.error('❌ Cannot request updated sessions - WebSocket not ready:', {
        wsConnection: !!wsConnection,
        readyState: wsConnection?.readyState
      });
    }
    
    setSuccessMessage('✅ New signing session announced');
  };

  // Signing Round 1
  const handleSigningRound1 = async (message: any) => {
    try {
      const { nonces_hex, commitments_hex } = signRound1Commit(keyPackage);
      signingState.current.nonces = nonces_hex;

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
      signingState.current.identifier = myIdHex;
      signingState.current.group_id = message.payload.group_id;
      signingState.current.msg32_hex = message.payload.msg_keccak32_hex;

      const payload_hex = getAuthPayloadSignR1(
        signingSessionIdRef.current,
        message.payload.group_id,
        myIdHex,
        commitments_hex
      );
      const signature = signMessageECDSA(authState.dkgPrivateKey!, payload_hex);

      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'SignRound1Submit',
          payload: {
            session: signingSessionIdRef.current,
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

  // Signing Round 2
  const handleSigningRound2 = async (message: any) => {
    try {
      const signature_share_hex = signRound2Sign(
        keyPackage,
        signingState.current.nonces,
        message.payload.signing_package_bincode_hex
      );

      const payload_hex = getAuthPayloadSignR2(
        signingSessionIdRef.current,
        signingState.current.group_id,
        signingState.current.identifier,
        signature_share_hex,
        signingState.current.msg32_hex
      );
      const signature = signMessageECDSA(authState.dkgPrivateKey!, payload_hex);

      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'SignRound2Submit',
          payload: {
            session: signingSessionIdRef.current,
            id_hex: signingState.current.identifier,
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

  // Handle signature ready
  const handleSignatureReady = (payload: any) => {
    const signatureData: FinalSignature = {
      signature: payload.signature_bincode_hex,
      message: payload.message,
      rx: payload.rx,
      ry: payload.ry,
      s: payload.s,
      px: payload.px,
      py: payload.py
    };
    
    setFinalSignatureData(signatureData);
    setSuccessMessage('🎉 Signature generation complete!');
  };

  // Handle server messages (signing-specific messages)
  const handleServerMessage = (message: any) => {
    console.log('📨 [Signing Page] Received message:', message.type, message);
    console.log('🔍 [DEBUG] Message timestamp:', new Date().toISOString());
    console.log('🔍 [DEBUG] Current auth state:', {
      isAuthenticated: authState.isAuthenticated,
      publicKeyHex: authState.publicKeyHex?.substring(0, 20) + '...',
      userId: authState.userId
    });

    switch (message.type) {
      case 'PendingSigningSessions':
        console.log('📋 Received pending signing sessions from server:', message.payload);
        console.log('🔍 [DEBUG] Payload structure:', {
          hasSessions: !!message.payload?.sessions,
          sessionsLength: message.payload?.sessions?.length,
          isArray: Array.isArray(message.payload?.sessions),
          fullPayload: message.payload
        });
        console.log('🔍 [DEBUG] Current time:', new Date().toISOString());
        console.log('🔍 [DEBUG] Message received after session creation');
        handlePendingSigningSessions(message.payload);
        break;
      case 'SignSessionAnnounced':
        console.log('🎯 Handling SignSessionAnnounced');
        console.log('🔍 [DEBUG] Announcement payload:', message.payload);
        handleSignSessionAnnounced(message.payload);
        break;
      case 'SignSessionJoined':
        console.log('✅ Successfully joined signing session:', message.payload.session);
        setJoinedSigningSessions(prev => new Set(Array.from(prev).concat(message.payload.session)));
        setJoiningSigningSession('');
        setSuccessMessage(`✅ Joined signing session: ${message.payload.session}`);
        // Request updated session list from server to get accurate participant count
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          console.log('🔄 Requesting updated signing sessions list after join');
          wsConnection.send(JSON.stringify({ type: 'ListPendingSigningSessions', payload: null }));
        }
        break;
      case 'SignRound1':
      case 'SignReadyRound1':
        handleSigningRound1(message);
        break;
      case 'SignRound2':
      case 'SignReadyRound2':
      case 'SignSigningPackage':
        handleSigningRound2(message);
        break;
      case 'SignatureReady':
        handleSignatureReady(message.payload);
        break;
      case 'Error':
        // Handle server errors and show actual error message
        const serverError = message.payload?.message || message.payload || 'Unknown server error';
        console.error('❌ Server Error:', serverError);
        
        // Clear joining state on error
        setJoiningSigningSession('');
        
        // Show the actual server error message
        setError(`Server Error: ${serverError}`);
        break;
      default:
        // Let the DKG hook handle other messages (Challenge, Authenticated, etc.)
        console.log('⏭️ Message type not handled in signing page:', message.type);
        break;
    }
  };

  // Handle pending signing sessions from server
  const handlePendingSigningSessions = (payload: any) => {
    console.log('🔍 [DETAILED] handlePendingSigningSessions called with payload:', payload);
    console.log('🔍 [DEBUG] Current available key packages:', availableKeyPackages.map(pkg => ({
      groupId: pkg.groupId,
      isHex: /^[0-9a-fA-F]+$/.test(pkg.groupId)
    })));
    
    if (!payload) {
      console.warn('❌ No payload provided to handlePendingSigningSessions');
      return;
    }
    
    if (!payload.sessions) {
      console.warn('❌ No sessions array in payload:', payload);
      return;
    }
    
    if (!Array.isArray(payload.sessions)) {
      console.warn('❌ Sessions is not an array:', typeof payload.sessions, payload.sessions);
      return;
    }
    
    console.log('📋 Processing pending signing sessions:', payload.sessions);
    console.log('🔍 My public key for comparison:', authState.publicKeyHex?.substring(0, 20) + '...');
    
    // Check which sessions I've already joined based on server data
    const newJoinedSessions = new Set<string>();
    
    const sessions = payload.sessions.map((s: any, index: number) => {
      console.log(`🔍 Processing session ${index + 1}/${payload.sessions.length}:`, {
        sessionId: s.session,
        groupId: s.group_id?.substring(0, 20) + '...',
        threshold: s.threshold,
        participantsCount: s.participants?.length,
        joinedCount: s.joined?.length,
        joinedList: s.joined?.map((j: any) => {
          if (typeof j === 'string') return j.substring(0, 20) + '...';
          if (j.pub_key) return j.pub_key.substring(0, 20) + '...';
          return j;
        })
      });
      
      // Check if my public key is in the joined list
      const myPubKey = authState.publicKeyHex;
      const iAmInSession = s.joined?.some((j: any) => {
        const joinedKey = j.pub_key || j;
        const match = joinedKey === myPubKey;
        if (match) {
          console.log(`✅ Found myself in session ${s.session}:`, {
            myKey: myPubKey?.substring(0, 20) + '...',
            joinedKey: joinedKey?.substring(0, 20) + '...'
          });
        }
        return match;
      });
      
      if (iAmInSession) {
        newJoinedSessions.add(s.session);
      }
      
      const processedSession = {
        id: s.session,
        group_id: s.group_id,
        threshold: s.threshold,
        participants: s.participants,
        participants_pubs: s.participants_pubs || [],
        group_vk_sec1_hex: s.group_vk_sec1_hex || '',
        message: s.message,
        message_hex: s.message_hex,
        status: iAmInSession ? 'joined' : (s.status || 'waiting'),
        current_participants: s.joined?.length || 0,
        round: s.round || 0,
        created_at: new Date(),
        joined: s.joined || []
      };
      
      console.log(`📝 Processed session ${s.session}:`, {
        id: processedSession.id,
        status: processedSession.status,
        currentParticipants: processedSession.current_participants,
        threshold: processedSession.threshold,
        hasMatchingGroupId: availableKeyPackages.some(pkg => pkg.groupId === s.group_id)
      });
      
      return processedSession;
    });
    
    // Update joined sessions set
    if (newJoinedSessions.size > 0) {
      console.log('🔄 Updating joined sessions set:', Array.from(newJoinedSessions));
      setJoinedSigningSessions(prev => new Set(Array.from(prev).concat(Array.from(newJoinedSessions))));
    }
    
    console.log('✅ Setting signing sessions:', sessions.length, 'sessions');
    console.log('📋 Sessions I have joined:', Array.from(newJoinedSessions));
    console.log('📦 Available key packages for matching:', availableKeyPackages.map(pkg => ({
      id: pkg.id,
      groupId: pkg.groupId?.substring(0, 20) + '...'
    })));
    
    setSigningSessions(sessions);
  };


  // Handle key package file upload
  const handleKeyPackageFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const keyPackageData = JSON.parse(content);

        console.log('📦 [DEBUG] Parsing uploaded key package file:', {
          fileName: file.name,
          fileSize: file.size,
          hasEncryptedKeyPackage: !!keyPackageData.encryptedKeyPackageHex,
          keyType: keyPackageData.key_type
        });

        // Validate the key package file structure
        if (!keyPackageData.encryptedKeyPackageHex) {
          throw new Error('Invalid key package file: missing encryptedKeyPackageHex');
        }

        if (!keyPackageData.finalGroupKeyCompressed) {
          throw new Error('Invalid key package file: missing finalGroupKeyCompressed');
        }

        // Generate a unique storage key for this uploaded key package
        const timestamp = Date.now();
        const storageKey = `dkg_key_package_uploaded_${timestamp}`;

        // Convert the uploaded file format to our internal storage format
        const internalKeyPackage = {
          session_id: keyPackageData.session_id || `uploaded_${timestamp}`,
          key_package_hex: keyPackageData.encryptedKeyPackageHex, // The actual key package for signing
          group_public_key_hex: keyPackageData.finalGroupKeyCompressed,
          group_id: keyPackageData.group_id || `uploaded_group_${timestamp}`,
          threshold: keyPackageData.threshold || 2,
          total: keyPackageData.total_participants || 3,
          timestamp: keyPackageData.created_at || new Date().toISOString(),
          key_type: keyPackageData.key_type || 'secp256k1',
          uploaded: true // Mark as uploaded
        };

        // Store in localStorage
        localStorage.setItem(storageKey, JSON.stringify(internalKeyPackage));

        console.log('✅ [DEBUG] Key package uploaded and stored:', {
          storageKey,
          groupId: internalKeyPackage.group_id,
          threshold: internalKeyPackage.threshold,
          sessionId: internalKeyPackage.session_id
        });

        // Reload available key packages to show the newly uploaded one
        loadAvailableKeyPackages();

        setSuccessMessage(`✅ Key package uploaded successfully! Group: ${internalKeyPackage.group_id}`);
        
        // Clear the file input
        if (event.target) {
          event.target.value = '';
        }

      } catch (error: any) {
        console.error('❌ [DEBUG] Key package upload failed:', error);
        setError(`Failed to upload key package: ${error.message}`);
        
        // Clear the file input on error
        if (event.target) {
          event.target.value = '';
        }
      }
    };

    reader.onerror = () => {
      setError('Failed to read the uploaded file');
      if (event.target) {
        event.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Load key package from saved packages
  const handleLoadKeyPackage = (packageId: string) => {
    const pkg = availableKeyPackages.find(p => p.id === packageId);
    if (pkg) {
      setKeyPackage(pkg.keyPackageHex);
      setSelectedKeyPackageId(packageId);
      setSigningGroupId(pkg.groupId);
      setSigningThreshold(pkg.threshold?.toString() || '2');
      setSigningGroupVk(pkg.groupPublicKeyHex || '');
      setSuccessMessage(`✅ Loaded key package for ${pkg.groupId}`);
    }
  };

  // Load key package and join session in one action
  const handleLoadAndJoinSession = (packageId: string, sessionId: string) => {
    const pkg = availableKeyPackages.find(p => p.id === packageId);
    if (!pkg) {
      setError('Key package not found');
      return;
    }

    // Set the key package state for future use
    setKeyPackage(pkg.keyPackageHex);
    setSelectedKeyPackageId(packageId);
    setSigningGroupId(pkg.groupId);
    setSigningThreshold(pkg.threshold?.toString() || '2');
    setSigningGroupVk(pkg.groupPublicKeyHex || '');

    // Join immediately using the key package directly (not from state)
    try {
      setJoiningSigningSession(sessionId);
      signingSessionIdRef.current = sessionId;
      
      console.log('🔍 Before getSigningPrerequisites:', {
        sessionId: sessionId,
        packageId: pkg.id,
        packageGroupId: pkg.groupId,
        keyPackageLength: pkg.keyPackageHex?.length || 0,
        keyPackageExists: !!pkg.keyPackageHex,
        keyPackagePreview: pkg.keyPackageHex?.substring(0, 40) + '...'
      });
      
      if (!pkg.keyPackageHex || pkg.keyPackageHex.trim() === '') {
        throw new Error('Key package is empty or missing');
      }
      
      const prereqs = getSigningPrerequisites(pkg.keyPackageHex);
      
      console.log('🔍 Signing prerequisites generated:', {
        sessionId: sessionId,
        signerId: prereqs.signer_id_bincode_hex,
        verifyingShare: prereqs.verifying_share_bincode_hex?.substring(0, 20) + '...',
        packageId: pkg.id,
        packageGroupId: pkg.groupId
      });
      
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
      setJoiningSigningSession('');
    }
  };

  // Open modal with selected key package or imported session
  const handleOpenSigningModal = (pkg: any) => {
    setSelectedKeyPackageForModal(pkg);
    
    // Only set key package if it's an actual key package (not imported session)
    if (pkg.type === 'key_package' && pkg.keyPackageHex) {
      setKeyPackage(pkg.keyPackageHex);
    } else {
      setKeyPackage(''); // Clear for imported sessions
    }
    
    setSelectedKeyPackageId(pkg.id);
    setShowSigningModal(true);
  };

  // Handle session creation from modal (same logic as DKG management)
  const handleCreateSessionFromModal = (data: {
    groupId: string;
    threshold: number;
    message: string;
    messageHash: string;
    groupVk: string;
    roster: string[];
  }) => {
    console.log('🔧 Creating session from modal with data:', data);
    
    setSigningGroupId(data.groupId);
    setSigningThreshold(data.threshold.toString());
    setMessageToSign(data.message);
    setMessageHash(data.messageHash);
    setSigningGroupVk(data.groupVk);
    setSigningRoster(data.roster);

    // Announce the signing session (same as DKG management)
    const thresholdNum = data.threshold;
    const participants = data.roster.map((_, i) => i + 1);
    const participants_pubs = data.roster.map((pubkey, i) => [i + 1, {
      type: "Secp256k1",
      key: pubkey
    }]);

    console.log('📤 Announcing session:', {
      group_id: data.groupId,
      threshold: thresholdNum,
      participants,
      participants_pubs,
      message: data.message
    });

    if (wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'AnnounceSignSession',
        payload: {
          group_id: data.groupId,
          threshold: thresholdNum,
          participants,
          participants_pubs,
          group_vk_sec1_hex: data.groupVk,
          message: data.message,
          message_hex: data.messageHash,
        }
      }));
      console.log('✅ Signing session announced from modal');
      setSuccessMessage('Signing session created and announced');
      
      // Request updated signing sessions list to show the newly created session
      setTimeout(() => {
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          console.log('🔄 Requesting updated signing sessions list after session creation');
          console.log('📊 Current state before request:', {
            connectionStatus,
            authStatus: authState.isAuthenticated,
            currentSessionCount: signingSessions.length,
            wsReadyState: wsConnection.readyState
          });
          wsConnection.send(JSON.stringify({ type: 'ListPendingSigningSessions', payload: null }));
        } else {
          console.error('❌ WebSocket not available for session list request:', {
            wsConnection: !!wsConnection,
            readyState: wsConnection?.readyState,
            connectionStatus
          });
        }
      }, 1000); // Small delay to ensure server has processed the announcement
      
      // Close the modal
      setShowSigningModal(false);
      setSelectedKeyPackageForModal(null);
      
      // Switch to sessions tab to see the created session
      setTimeout(() => {
        setActiveTab('sessions');
      }, 1500);
    }
  };

  // Announce signing session
  const handleAnnounceSigningSession = () => {
    if (keyPackage.trim() === '') {
      setError('Please load a key package first');
      return;
    }
    if (!messageToSign || !messageHash) {
      setError('Please enter a message to sign');
      return;
    }

    const thresholdNum = parseInt(signingThreshold);
    const validRoster = signingRoster.filter(pk => pk.trim() !== '');
    const participants = validRoster.map((_, i) => i + 1);
    const participants_pubs = validRoster.map((pubkey, i) => [i + 1, {
      type: "Secp256k1",
      key: pubkey
    }]);

    if (wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'AnnounceSignSession',
        payload: {
          group_id: signingGroupId,
          threshold: thresholdNum,
          participants,
          participants_pubs,
          group_vk_sec1_hex: signingGroupVk,
          message: messageToSign,
          message_hex: messageHash,
        }
      }));
      console.log('📤 Signing session announced');
      setSuccessMessage('Signing session created and announced');
    }
  };

  // Join signing session
  const handleJoinSigningSession = (sessionId: string) => {
    if (keyPackage.trim() === '') {
      setError('Please load a key package first');
      return;
    }
    try {
      setJoiningSigningSession(sessionId);
      signingSessionIdRef.current = sessionId;
      const prereqs = getSigningPrerequisites(keyPackage);
      
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
      console.log(`📤 Joining signing session: ${sessionId}`);
    } catch (e: any) {
      setError(`Failed to join session: ${e.message}`);
    }
  };

  // Download signature
  const handleDownloadSignature = () => {
    if (!finalSignatureData) return;

    // The actual hash that was signed is stored in signingState.current.msg32_hex
    // This is the keccak256 of the packed data that was sent to the server
    const actualSignedHash = signingState.current.msg32_hex;

    const signatureJSON = {
      signature_bincode_hex: finalSignatureData.signature,
      message: actualSignedHash, // The hash that was actually signed
      message_hex: actualSignedHash.startsWith('0x') ? actualSignedHash.slice(2) : actualSignedHash,
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

  // Clear all local data (key packages, imported sessions, local state)
  const handleClearAllLocalData = () => {
    if (!confirm('Clear all local data? This will remove:\n\n• All key packages and imported sessions\n• Current session state\n\nNote: Active server sessions will remain and reappear when you refresh the session list.\n\nThis action cannot be undone.')) {
      return;
    }

    try {
      // Clear current signing session UI state (temporary)
      setSigningSessions([]);
      setJoinedSigningSessions(new Set());
      setSelectedSession(null);
      setJoiningSigningSession('');
      
      // Clear current key package state
      setKeyPackage('');
      setSelectedKeyPackageId('');
      setSigningGroupId('');
      setSigningThreshold('2');
      setSigningGroupVk('');
      setSigningRoster(['', '', '']);
      
      // Clear ALL key packages from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('dkg_key_package_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log(`🧹 [DEBUG] Cleared ${keysToRemove.length} key packages`);
      
      // Reload available key packages to reflect the changes
      loadAvailableKeyPackages();
      
      setSuccessMessage(`✅ Cleared all local data: ${keysToRemove.length} key packages. Server sessions will reappear when refreshed.`);
      
      console.log('🧹 [DEBUG] Cleared all local data');
    } catch (error: any) {
      console.error('❌ [DEBUG] Error clearing local data:', error);
      setError(`Failed to clear local data: ${error.message}`);
    }
  };

  return (
    <>
      <SigningSessionModal
        isOpen={showSigningModal}
        onClose={() => setShowSigningModal(false)}
        keyPackageData={selectedKeyPackageForModal}
        onCreateSession={handleCreateSessionFromModal}
        isAuthenticated={authState.isAuthenticated}
      />

      <Layout
        title="Threshold Signature Signing"
        subtitle="Create and participate in FROST threshold signature signing ceremonies"
        showSidebar={true}
        showFooter={true}
      >
      <div className="max-w-7xl mx-auto space-y-6 p-4 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                Threshold Signing
              </h1>
              <p className="text-gray-400 mt-1">Create and participate in FROST threshold signature ceremonies</p>
            </div>
          </div>

          {/* Connection Status */}
          <DKGConnectionStatus
            connectionStatus={connectionStatus}
            serverUrl={serverUrl}
            setServerUrl={setServerUrl}
            connectToServer={() => connectToServer(serverUrl)}
            authState={authState}
            onRequestChallenge={requestChallenge}
            onGetPublicKey={getDeterministicPublicKey}
            onAuthenticate={authenticate}
            onClearAuth={clearAuth}
          />

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 text-red-200 flex items-center gap-2">
              <X className="w-4 h-4" />
              {error}
              <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-900/50 border border-green-500 text-green-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {successMessage}
              <button onClick={() => setSuccessMessage('')} className="ml-auto text-green-400 hover:text-green-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="mb-6">
            <div className="flex gap-2 border-b border-gray-700">
              <button
                onClick={() => setActiveTab('sessions')}
                className={`px-6 py-3 font-semibold transition-all relative ${
                  activeTab === 'sessions'
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Signing Sessions
                  {signingSessions.length > 0 && (
                    <span className="ml-2 bg-[#028bee] text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-lg shadow-[#028bee]/50 animate-pulse">
                      {signingSessions.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-6 py-3 font-semibold transition-all ${
                  activeTab === 'create'
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Create New Session
                </div>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Active Signing Sessions</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={requestPendingSigningSessions}
                      disabled={connectionStatus !== 'connected' || !authState.isAuthenticated}
                      className="px-4 py-2 bg-[#028bee] hover:bg-[#0277d4] disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </button>
                    {availableKeyPackages.length > 0 && (
                      <button
                        onClick={handleClearAllLocalData}
                        className="px-4 py-2 bg-red-700 hover:bg-red-600 flex items-center gap-2 text-red-200 hover:text-white"
                        title="Clears local key packages and imported sessions only"
                      >
                        <X className="w-4 h-4" />
                        Clear Local Data
                      </button>
                    )}
                  </div>
                </div>

                {signingSessions.length === 0 ? (
                  <div className="text-center py-12 bg-gray-800/50 border border-gray-700">
                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">No signing sessions available</p>
                    <p className="text-sm text-gray-500 mt-2">Create a new session or wait for others to announce one</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {signingSessions.map((session) => {
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
                      const isJoining = joiningSigningSession === session.id;
                      const hasMatchingKey = keyPackage || matchingPkg;
                      const isJoined = joinedSigningSessions.has(session.id) || session.status === 'joined';
                      
                      return (
                      <div
                        key={session.id}
                        className={`p-6 border transition-all ${
                          isJoined
                            ? 'bg-green-900/20 border-green-700'
                            : hasMatchingKey 
                              ? 'bg-gray-800/50 border-gray-700 hover:border-blue-500' 
                              : 'bg-gray-900/50 border-gray-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 flex items-center justify-center ${
                              isJoined 
                                ? 'bg-green-900/50 border border-green-500' 
                                : 'bg-blue-900/50 border border-blue-500'
                            }`}>
                              {isJoined ? (
                                <CheckCircle className="w-6 h-6 text-green-400" />
                              ) : (
                                <MessageSquare className="w-6 h-6 text-blue-400" />
                              )}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">{session.group_id}</h3>
                              <p className="text-xs text-gray-500 font-mono">{session.id.slice(0, 18)}...</p>
                            </div>
                          </div>
                          <div className={`px-3 py-1 text-xs font-semibold ${
                            isJoined
                              ? 'bg-green-900/50 border border-green-500 text-green-300'
                              : session.status === 'waiting' 
                                ? 'bg-yellow-900/50 border border-yellow-500 text-yellow-300' 
                                : session.status === 'active'
                                  ? 'bg-blue-900/50 border border-blue-500 text-blue-300'
                                  : 'bg-gray-900/50 border border-gray-500 text-gray-300'
                          }`}>
                            {isJoined ? 'JOINED' : session.status?.toUpperCase() || 'WAITING'}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-gray-900/50 p-3 border border-gray-700">
                            <p className="text-xs text-gray-400 mb-1">Threshold</p>
                            <p className="text-xl font-bold text-white">{session.threshold || 'N/A'}</p>
                          </div>
                          <div className="bg-gray-900/50 p-3 border border-gray-700">
                            <p className="text-xs text-gray-400 mb-1">Participants</p>
                            <p className="text-xl font-bold text-white">{session.current_participants || 0}/{session.participants?.length || 0}</p>
                          </div>
                          <div className="bg-gray-900/50 p-3 border border-gray-700">
                            <p className="text-xs text-gray-400 mb-1">Status</p>
                            <p className="text-sm font-semibold">
                              {isJoined ? (
                                <span className="text-green-400">You Joined ✓</span>
                              ) : keyPackage ? (
                                <span className="text-blue-400">Ready to Join</span>
                              ) : matchingPkg ? (
                                <span className="text-yellow-400">Key Available</span>
                              ) : (
                                <span className="text-red-400">No Key</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-xs text-gray-400 mb-1">Message to Sign</p>
                          <div className="font-mono text-sm bg-gray-900 p-3 border border-gray-700 text-gray-200">
                            {session.message || 'No message'}
                          </div>
                        </div>

                        {isJoined ? (
                          <div className="w-full px-4 py-3 bg-green-900/30 border border-green-700 text-center">
                            <p className="text-green-300 font-semibold flex items-center justify-center gap-2">
                              <Clock className="w-4 h-4" />
                              Waiting for other participants ({session.current_participants || 0}/{session.participants?.length || 0})
                            </p>
                            <p className="text-xs text-green-400/70 mt-1">Signing will start automatically when threshold is reached</p>
                          </div>
                        ) : !keyPackage && !matchingPkg ? (
                          <button
                            disabled
                            className="w-full px-4 py-2 bg-gray-600 cursor-not-allowed font-semibold text-gray-400 text-sm"
                          >
                            No Key Package Available
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              // Auto-load key package if needed, then join
                              if (!keyPackage && matchingPkg) {
                                handleLoadAndJoinSession(matchingPkg.id, session.id);
                              } else {
                                handleJoinSigningSession(session.id);
                              }
                            }}
                            disabled={isJoining || !authState.isAuthenticated}
                            className="w-full px-4 py-2 bg-[#028bee] hover:bg-[#0277d4] disabled:bg-gray-600 disabled:cursor-not-allowed font-semibold transition-all"
                          >
                            {isJoining ? 'Joining...' : 'Join Session'}
                          </button>
                        )}
                      </div>
                    );
                    })}
                  </div>
                )}

                {/* Final Signature Display */}
                {finalSignatureData && (
                  <div className="mt-6 p-6 bg-green-900/30 border border-green-500">
                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                      Signature Generated Successfully!
                    </h3>
                    <div className="space-y-2 text-sm font-mono">
                      <div>
                        <span className="text-gray-400">Message:</span>
                        <p className="bg-gray-900 p-2 mt-1">{finalSignatureData.message}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Signature (rx):</span>
                        <p className="bg-gray-900 p-2 mt-1 break-all">{finalSignatureData.rx}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Signature (ry):</span>
                        <p className="bg-gray-900 p-2 mt-1 break-all">{finalSignatureData.ry}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadSignature}
                      className="mt-4 w-full px-4 py-2 bg-green-600 hover:bg-green-700 font-semibold flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Signature JSON
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Create Session Tab */}
            {activeTab === 'create' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold mb-4">Create New Signing Session</h2>

                {/* Available Sessions */}
                <div className="bg-gray-800/50 border border-gray-700 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-blue-500 text-white">
                      1
                    </div>
                    <h3 className="text-xl font-bold">Select DKG Session</h3>
                  </div>

                  {/* Key Package Upload Section */}
                  <div className="mb-6 p-4 border-2 border-dashed border-gray-600 bg-gray-800/30 hover:border-gray-500 transition-colors">
                    <div className="text-center">
                      <FileUp className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <h4 className="text-lg font-semibold text-white mb-2">Upload Key Package</h4>
                      <p className="text-sm text-gray-400 mb-4">Upload your individual key package file downloaded from a DKG ceremony</p>
                      
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleKeyPackageFileUpload}
                        className="hidden"
                        id="key-package-upload"
                      />
                      
                      <label
                        htmlFor="key-package-upload"
                        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[#028bee] hover:bg-[#0277d4] text-white font-medium rounded-md transition-colors"
                      >
                        <FileUp className="w-4 h-4" />
                        Choose Key Package File
                      </label>
                      
                      <p className="text-xs text-gray-500 mt-2">
                        Accepts JSON files with your individual signing key (frost-key-*.json)
                      </p>
                    </div>
                  </div>

                  {/* Available Key Packages and Imported Sessions */}
                  {availableKeyPackages.length > 0 ? (
                    <div className="grid gap-3">
                      {availableKeyPackages.map((pkg) => (
                        <button
                          key={pkg.id}
                          onClick={() => handleOpenSigningModal(pkg)}
                          className="p-4 border-2 text-left transition-all border-gray-700 bg-gray-800/50 hover:border-blue-500 hover:bg-blue-900/20"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-white">{pkg.groupId}</p>
                                {pkg.type === 'key_package' && (
                                  <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded border border-green-500/30">
                                    {pkg.id.includes('uploaded_') ? '📁 Uploaded' : 'Key Package'}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-400">Threshold: {pkg.threshold} | Total: {pkg.total}</p>
                            </div>
                            <div className="flex items-center gap-2">
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-blue-900/20 border border-blue-500/50 p-6 text-center">
                      <FileUp className="w-12 h-12 mx-auto mb-3 text-blue-400" />
                      <p className="text-blue-300 font-semibold mb-2">No Key Packages Available</p>
                      <p className="text-sm text-gray-400 mb-4">
                        Upload your individual key package from a DKG ceremony to create signing sessions.
                      </p>
                    </div>
                  )}
                </div>

                {availableKeyPackages.length > 0 && (
                  <div className="bg-green-900/20 border border-green-500/50 p-4 text-center">
                    <p className="text-green-300 text-sm">
                      👆 Click on a session above to create a signing session
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>
      </div>
    </Layout>
    </>
  );
}
