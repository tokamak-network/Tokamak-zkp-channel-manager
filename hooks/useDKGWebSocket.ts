'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSignMessage } from 'wagmi';
import { hexToBytes } from 'viem';
import { keccak256 } from 'js-sha3';

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

interface AuthState {
  isAuthenticated: boolean;
  challenge: string | null;
  uuid?: string;
  publicKeyHex: string | null;
  dkgPrivateKey: string | null;
  dkgPublicKey?: string;
  userId: string | null;
}

export function useDKGWebSocket(
  address: string | undefined,
  setIsCreatingSession?: (creating: boolean) => void,
  setNewlyCreatedSession?: (session: DKGSession) => void
) {
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [sessions, setSessions] = useState<DKGSession[]>([]);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    challenge: null,
    publicKeyHex: null,
    dkgPrivateKey: null,
    userId: null
  });
  const [frostIdMap, setFrostIdMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isJoiningSession, setIsJoiningSession] = useState(false);
  const [justJoinedSession, setJustJoinedSession] = useState('');
  const [hasShownJoinSuccess, setHasShownJoinSuccess] = useState(false);
  const joinSessionRef = useRef('');
  const [pendingSessionParams, setPendingSessionParams] = useState<{minSigners: number; maxSigners: number; participants: any[]} | null>(null);

  const { signMessageAsync } = useSignMessage();

  // Helper function to save sessions to localStorage
  const saveSessionsToStorage = useCallback((sessionsToSave: DKGSession[]) => {
    localStorage.setItem('dkg-sessions', JSON.stringify(sessionsToSave));
  }, []);

  // Load sessions from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem('dkg-sessions');
    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions);
        const migratedSessions = parsedSessions
          .map((session: any) => ({
            ...session,
            createdAt: new Date(session.createdAt)
          }))
          .filter((session: any) => session.minSigners && session.maxSigners);
        
        setSessions(migratedSessions);
      } catch (error) {
        console.error('Error loading sessions from localStorage:', error);
        localStorage.removeItem('dkg-sessions');
        setSessions([]);
      }
    }
  }, []);

  // Update session roles when address changes
  useEffect(() => {
    if (address && sessions.length > 0) {
      const sessionsNeedingRoleUpdate = sessions.filter(session => !session.myRole);
      if (sessionsNeedingRoleUpdate.length > 0) {
        const updatedSessions = sessions.map(session => ({
          ...session,
          myRole: session.myRole || (session.creator === address ? 'creator' : 'participant')
        }));
        setSessions(updatedSessions);
        saveSessionsToStorage(updatedSessions);
      }
    }
  }, [address, sessions, saveSessionsToStorage]);

  // WebSocket message handler
  const handleServerMessage = useCallback((message: any) => {
    console.log('Received server message:', message);
    
    switch (message.type) {
      case 'Challenge':
        setAuthState(prev => ({
          ...prev,
          challenge: message.payload.challenge,
          uuid: message.payload.challenge
        }));
        break;
        
      case 'Authenticated':
      case 'LoginOk':
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          userId: message.payload.user_id,
          publicKeyHex: prev.publicKeyHex,
          dkgPrivateKey: prev.dkgPrivateKey
        }));
        setError('');
        break;
        
      case 'SessionCreated':
        const newSession: DKGSession = {
          id: message.payload.session,
          creator: address!,
          minSigners: pendingSessionParams?.minSigners || 2,
          maxSigners: pendingSessionParams?.maxSigners || 3,
          currentParticipants: 1, // Creator is the first participant
          status: 'waiting',
          groupId: `group_${Date.now()}`,
          topic: `topic_${Date.now()}`,
          createdAt: new Date(),
          myRole: 'creator',
          description: 'DKG Key Generation Ceremony',
          participants: pendingSessionParams?.participants || [],
          roster: []
        };
        setSessions(prev => [...prev, newSession]);
        saveSessionsToStorage([...sessions, newSession]);
        setPendingSessionParams(null); // Clear pending params
        if (setIsCreatingSession) setIsCreatingSession(false);
        if (setNewlyCreatedSession) setNewlyCreatedSession(newSession);
        break;
        
      case 'Error':
        setError(`Server error: ${message.payload?.message || 'Unknown error'}`);
        setIsJoiningSession(false);
        setSuccessMessage('');
        break;
      
      case 'Info':
        if (message.payload?.message) {
          const infoMessage = message.payload.message;
          console.log('📢 Info message received:', infoMessage);
          
          const joinMatch = infoMessage.match(/(?:joined|participant)\s*(\d+)(?:\s*of\s*|\s*\/\s*)(\d+)|(\d+)\/(\d+)/);
          
          if (joinMatch) {
            console.log('📊 Participant count match found:', joinMatch);
            const current = parseInt(joinMatch[1] || joinMatch[3]);
            const total = parseInt(joinMatch[2] || joinMatch[4]);
            
            // Try to extract session ID from the info message
            const sessionIdMatch = infoMessage.match(/session[:\s]+([a-f0-9-]+)/i);
            let targetSessionId = sessionIdMatch ? sessionIdMatch[1] : null;
            
            // If we can't extract session ID from message, fall back to join context
            if (!targetSessionId && (justJoinedSession || joinSessionRef.current)) {
              targetSessionId = justJoinedSession || joinSessionRef.current;
            }
            
            // Update participant count for the relevant session
            if (targetSessionId) {
              console.log(`🔄 Updating session ${targetSessionId} participants: ${current}/${total}`);
              setSessions(prev => prev.map(session => 
                session.id === targetSessionId ? {
                  ...session,
                  currentParticipants: current,
                  maxSigners: total // Update maxSigners in case it was wrong
                } : session
              ));
            } else {
              console.log('⚠️ Could not determine session ID for participant count update');
            }
            
            const isJoinResponse = (isJoiningSession || (justJoinedSession && justJoinedSession.length > 0) || (joinSessionRef.current && joinSessionRef.current.length > 0)) && !hasShownJoinSuccess;
            
            if (isJoinResponse) {
              setError('');
              setSuccessMessage(`🎉 Successfully joined session! Waiting for ${total - current} more participant(s) to join before starting DKG rounds.`);
              setIsJoiningSession(false);
              setHasShownJoinSuccess(true);
              
              if (isJoiningSession) {
                setJustJoinedSession('');
                joinSessionRef.current = '';
              }
            }
          }
        }
        break;
        
      case 'ReadyRound1':
        const sessionId = message.payload.session;
        const myIdHex = message.payload.id_hex;
        
        if (myIdHex && typeof myIdHex === 'string' && myIdHex.length > 0) {
          setFrostIdMap(prev => ({
            ...prev,
            [sessionId]: myIdHex
          }));
          
          setSessions(prev => prev.map(session => 
            session.id === sessionId ? {
              ...session,
              status: 'round1' as const,
              roster: message.payload.roster || session.roster
            } : session
          ));
          
          setSuccessMessage(`🚀 All participants have joined! DKG Round 1 (Commitments) is now starting...`);
        }
        break;
        
      default:
        break;
    }
  }, [address, isJoiningSession, justJoinedSession, sessions, saveSessionsToStorage]);

  // Connect to WebSocket server
  const connectToServer = useCallback(async (serverUrl: string) => {
    if (wsConnection) {
      wsConnection.close();
    }

    try {
      setConnectionStatus('connecting');
      const ws = new WebSocket(serverUrl);
      
      ws.onopen = () => {
        console.log('Connected to DKG server');
        setConnectionStatus('connected');
        setError('');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (error) {
          console.error('Failed to parse server message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected from DKG server');
        setConnectionStatus('disconnected');
        setAuthState(prev => ({ ...prev, isAuthenticated: false }));
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
        setError('Failed to connect to DKG server');
      };
      
      setWsConnection(ws);
    } catch (error) {
      console.error('Failed to connect to DKG server:', error);
      setConnectionStatus('disconnected');
      setError('Failed to connect to DKG server');
    }
  }, [wsConnection, handleServerMessage]);

  // Request challenge from server
  const requestChallenge = useCallback(() => {
    if (!wsConnection) return;
    
    console.log('📩 Requesting challenge...');
    const message = { type: 'RequestChallenge' };
    wsConnection.send(JSON.stringify(message));
  }, [wsConnection]);

  // Get deterministic keypair using elliptic.js (like original implementation)
  const getDeterministicKeypair = useCallback(async () => {
    if (!address) {
      console.log('❌ Missing address');
      return null;
    }
    
    console.log('🔄 Generating deterministic keypair...');
    
    try {
      // Initialize elliptic.js
      const elliptic = await import('elliptic');
      const EC = elliptic.ec;
      const ec = new EC('secp256k1');
      
      // Create a deterministic seed by signing a fixed message
      const seedMessage = "DKG_KEYPAIR_SEED";
      const seedSignature = await signMessageAsync({ message: seedMessage });
      
      // Use the signature as entropy to derive a private key
      const seedBytes = hexToBytes(seedSignature as `0x${string}`);
      const seedHash = keccak256(seedBytes);
      
      // Create key pair from the hash
      const keyPair = ec.keyFromPrivate(seedHash, 'hex');
      
      // Get compressed public key (33 bytes, starts with 02 or 03)
      const publicKeyHex = keyPair.getPublic(true, 'hex');
      const privateKeyHex = keyPair.getPrivate('hex');
      
      console.log('✅ Generated keypair:', { publicKey: publicKeyHex });
      
      // Update auth state with both public and private keys
      setAuthState(prev => ({ 
        ...prev, 
        publicKeyHex,
        dkgPrivateKey: privateKeyHex,
        dkgPublicKey: publicKeyHex
      }));
      
      return { publicKey: publicKeyHex, privateKey: privateKeyHex };
    } catch (error) {
      console.error('Failed to generate keypair:', error);
      setError('Failed to generate keypair. Please try again.');
      return null;
    }
  }, [address, signMessageAsync]);

  // Wrapper for backward compatibility
  const getDeterministicPublicKey = useCallback(async () => {
    const keypair = await getDeterministicKeypair();
    return keypair?.publicKey || '';
  }, [getDeterministicKeypair]);

  // Authentication
  const authenticate = useCallback(async () => {
    if (!wsConnection || !authState.uuid || !address) return;

    console.log('🔐 Starting authentication process...');
    
    try {
      // 1. Always ensure we have consistent keypair
      let pubkeyHex = authState.publicKeyHex;
      let privateKeyHex = authState.dkgPrivateKey;
      
      // Always regenerate to ensure consistency
      console.log('🔄 Ensuring consistent keypair for authentication...');
      const keypair = await getDeterministicKeypair();
      if (!keypair) {
        setError('Failed to generate DKG keypair for authentication');
        return;
      }
      pubkeyHex = keypair.publicKey;
      privateKeyHex = keypair.privateKey;
      
      console.log('🔑 Using keypair:', {
        publicKey: pubkeyHex,
        privateKeyLength: privateKeyHex.length,
        challenge: authState.uuid
      });

      if (!privateKeyHex || !pubkeyHex) {
        setError('Failed to get DKG keypair for signing.');
        return;
      }

      // 2. Parse challenge UUID and get bytes
      const uuidBytes = new Uint8Array(16);
      const uuid = authState.uuid.replace(/-/g, '');
      
      // Validate UUID format
      if (uuid.length !== 32) {
        setError(`Invalid UUID format: ${authState.uuid} (cleaned: ${uuid})`);
        return;
      }
      
      for (let i = 0; i < 16; i++) {
        uuidBytes[i] = parseInt(uuid.substring(i * 2, i * 2 + 2), 16);
      }
      
      console.log('🔍 Debug info:', {
        originalUuid: authState.uuid,
        cleanedUuid: uuid,
        uuidBytes: Array.from(uuidBytes).map(b => b.toString(16).padStart(2, '0')).join('')
      });
      
      // 3. Compute Keccak256(challenge_bytes)
      const properDigest = '0x' + keccak256(uuidBytes);
      console.log('🔍 Keccak256 digest:', properDigest);
      
      // Test with known values to verify correctness
      const testBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const testDigest = '0x' + keccak256(testBytes);
      console.log('🔍 Test digest (0x01020304):', testDigest);
      
      // 4. Sign using client-side DKG private key with elliptic.js
      const elliptic = await import('elliptic');
      const EC = elliptic.ec;
      const ec = new EC('secp256k1');
      
      // Create key pair from private key
      const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
      
      // Sign the raw digest hash directly
      const digestBytes = hexToBytes(properDigest as `0x${string}`);
      const signature = keyPair.sign(digestBytes);
      
      // Ensure canonical signature (low-s form)
      const n = ec.curve.n;
      let s = signature.s;
      if (s.gt(n.shln(1))) {
        s = n.sub(s);
      }
      
      // Convert to compact format (r + s, 64 bytes)
      const r = signature.r.toString(16).padStart(64, '0');
      const sHex = s.toString(16).padStart(64, '0');
      const signatureHex = r + sHex;
      
      // Verify the signature locally before sending
      const normalizedSig = { r: signature.r, s: s };
      const isValid = keyPair.verify(digestBytes, normalizedSig);
      console.log('✅ Local signature verification:', isValid ? 'VALID' : 'INVALID');
      
      if (!isValid) {
        setError('Local signature verification failed. Please try again.');
        return;
      }
      
      const message = {
        type: 'Login',
        payload: {
          challenge: authState.uuid,
          pubkey_hex: pubkeyHex,
          signature_hex: signatureHex
        }
      };
      
      console.log('🔍 Final login message:', {
        type: 'Login',
        challenge: authState.uuid,
        pubkey_hex: pubkeyHex,
        pubkey_length: pubkeyHex.length,
        signature_hex: signatureHex,
        signature_length: signatureHex.length,
        digest: properDigest
      });

      wsConnection.send(JSON.stringify(message));
    } catch (error) {
      console.error('Authentication failed:', error);
      setError('Authentication failed. Please try again.');
    }
  }, [wsConnection, authState.uuid, authState.publicKeyHex, authState.dkgPrivateKey, address, getDeterministicKeypair]);

  // Join session
  const joinSession = useCallback((sessionId: string) => {
    if (!wsConnection || !sessionId) return;

    setIsJoiningSession(true);
    setJustJoinedSession(sessionId);
    joinSessionRef.current = sessionId;
    setError('');
    setSuccessMessage('');
    setHasShownJoinSuccess(false);

    const message = {
      type: 'JoinSession',
      payload: { session: sessionId }
    };

    wsConnection.send(JSON.stringify(message));
  }, [wsConnection]);

  // Clear authentication
  const clearAuth = useCallback(() => {
    setAuthState({
      isAuthenticated: false,
      challenge: null,
      publicKeyHex: null,
      dkgPrivateKey: null,
      userId: null
    });
  }, []);

  // Clear all sessions
  const clearAllSessions = useCallback(() => {
    localStorage.removeItem('dkg-sessions');
    setSessions([]);
    setError('');
    
    if (wsConnection) {
      const message = { type: 'ClearAllSessions', payload: null };
      wsConnection.send(JSON.stringify(message));
    }
  }, [wsConnection]);

  // Set pending session parameters for creation
  const setPendingCreateSessionParams = useCallback((params: {minSigners: number; maxSigners: number; participants: any[]}) => {
    setPendingSessionParams(params);
  }, []);

  return {
    // Connection state
    wsConnection,
    connectionStatus,
    
    // Authentication state
    authState,
    requestChallenge,
    getDeterministicPublicKey,
    authenticate,
    clearAuth,
    
    // Sessions state
    sessions,
    setSessions,
    frostIdMap,
    setFrostIdMap,
    
    // Join state
    isJoiningSession,
    joinSession,
    
    // Messages
    error,
    setError,
    successMessage,
    setSuccessMessage,
    
    // Actions
    connectToServer,
    clearAllSessions,
    saveSessionsToStorage,
    setPendingCreateSessionParams
  };
}