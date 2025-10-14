'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { recoverPublicKey, hexToBytes, toBytes } from 'viem';
import { keccak256 } from 'js-sha3';

// Use elliptic.js for browser-compatible ECDSA operations
let EC: any = null;
let ec: any = null;

// Initialize elliptic.js when component loads
const initializeElliptic = async () => {
  if (typeof window !== 'undefined' && !ec) {
    try {
      console.log('Loading elliptic.js...');
      const elliptic = await import('elliptic');
      EC = elliptic.ec;
      ec = new EC('secp256k1');
      console.log('✅ elliptic.js library loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load elliptic.js:', error);
      return false;
    }
  }
  return ec !== null;
};
import { useWalletClient } from 'wagmi';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserRolesDynamic } from '@/hooks/useUserRolesDynamic';

interface DKGParticipant {
  uid: number;
  publicKey: string; // ECDSA public key for authenticated channel
  nickname?: string;
  address?: string; // Optional wallet address
}

interface DKGSession {
  id: string;
  creator: string;
  minSigners: number;
  maxSigners: number;
  currentParticipants: number;
  status: 'waiting' | 'round1' | 'round2' | 'finalizing' | 'completed' | 'failed';
  groupId: string;
  topic: string; // Unique topic string for this DKG ceremony
  createdAt: Date;
  myRole: 'creator' | 'participant';
  description?: string;
  participants: DKGParticipant[];
  roster: Array<[number, string, string]>; // [uid, id_hex, ecdsa_pub_hex]
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
  uuid?: string; // The UUID from challenge
  accessToken?: string;
  userId?: number;
  publicKeyHex?: string;
  signature?: string;
  derivationMethod?: 'eth_sign' | 'personal_sign' | 'client_keypair';
  derivationHash?: string;
  derivationMessage?: string;
  // Client-side keypair for DKG operations
  dkgPrivateKey?: string; // hex string
  dkgPublicKey?: string;
}

// Helper function to compress an uncompressed public key
function compressPublicKey(uncompressedHex: string): string {
  if (uncompressedHex.length !== 130) {
    throw new Error('Invalid uncompressed public key length');
  }
  
  if (!uncompressedHex.startsWith('04')) {
    throw new Error('Invalid uncompressed public key format');
  }
  
  // Extract x and y coordinates (32 bytes each)
  const x = uncompressedHex.slice(2, 66); // Skip '04' prefix
  const y = uncompressedHex.slice(66, 130);
  
  // Determine if y is even or odd to choose prefix
  const yBigInt = BigInt('0x' + y);
  const prefix = yBigInt % BigInt(2) === BigInt(0) ? '02' : '03';
  
  return prefix + x;
}

export default function DKGManagementPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();
  const { } = useUserRolesDynamic();
  const [sessions, setSessions] = useState<DKGSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<DKGSession | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<ParticipantStatus[]>([]);
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
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [serverUrl, setServerUrl] = useState('ws://127.0.0.1:9000/ws');
  const [sessionToJoin, setSessionToJoin] = useState('');
  const [participants, setParticipants] = useState<DKGParticipant[]>([]);
  const [error, setError] = useState<string>('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  
  // Current participant being added
  const [newParticipant, setNewParticipant] = useState<DKGParticipant>({
    uid: 1,
    publicKey: '',
    nickname: ''
  });

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
    
    // Initialize elliptic.js when connecting
    initializeElliptic().then(success => {
      if (success) {
        console.log('Elliptic.js initialized during connection');
      } else {
        console.warn('Failed to initialize elliptic.js during connection');
      }
    });
    setError('');
    
    try {
      const ws = new WebSocket(serverUrl);
      
      ws.onopen = () => {
        setConnectionStatus('connected');
        setWsConnection(ws);
        setError('');
      };

      ws.onmessage = (event) => {
        console.log('Raw WebSocket message:', event.data);
        try {
          if (event.data === '' || event.data === null || event.data === undefined) {
            console.warn('Received empty message from server');
            return;
          }
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (err) {
          console.error('Failed to parse server message:', err, 'Raw data:', event.data);
          setError('Invalid message from server');
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setWsConnection(null);
        if (event.code !== 1000) { // Not a normal closure
          setError(`Connection closed unexpectedly (code: ${event.code}, reason: ${event.reason})`);
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
    console.log('Message type:', typeof message, 'Content:', JSON.stringify(message));
    
    switch (message.type) {
      case 'Challenge':
        // Server sends: Challenge { challenge: string }
        setAuthState(prev => {
          console.log('🎯 Challenge received - preserving auth state:', {
            hadPrivateKey: !!prev.dkgPrivateKey,
            hadPublicKey: !!prev.publicKeyHex,
            challenge: message.payload.challenge
          });
          const newState = { 
            ...prev, 
            challenge: message.payload.challenge,
            uuid: message.payload.challenge 
          };
          console.log('📝 New auth state after challenge:', {
            hasPrivateKey: !!newState.dkgPrivateKey,
            hasPublicKey: !!newState.publicKeyHex,
            derivationMethod: newState.derivationMethod
          });
          return newState;
        });
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
        console.log('Session created successfully:', message.payload.session);
        const newSession: DKGSession = {
          id: message.payload.session,
          creator: address!,
          minSigners,
          maxSigners,
          currentParticipants: 1,
          status: 'waiting',
          groupId: groupId || `group_${Date.now()}`,
          topic: topic || `topic_${Date.now()}`,
          createdAt: new Date(),
          myRole: 'creator',
          description: description,
          participants: [...participants],
          roster: participants.map((p) => [p.uid, `id_${p.uid}`, p.publicKey])
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
        setError(`Server error: ${message.payload?.message || 'Unknown error'}`);
        setIsCreatingSession(false);
        break;
      
      case 'Info':
        console.log('Server info:', message.payload?.message);
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
          setSessionParticipants(participantsData);
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

  // Participant management functions
  const addParticipant = () => {
    if (!newParticipant.publicKey.trim()) {
      setError('ECDSA public key is required');
      return;
    }
    
    // Validate and normalize ECDSA public key format
    const pubkeyHex = newParticipant.publicKey.trim();
    const cleanHex = pubkeyHex.startsWith('0x') ? pubkeyHex.slice(2) : pubkeyHex;
    
    let finalPubkeyHex: string;
    
    if (/^[0-9a-fA-F]{66}$/.test(cleanHex)) {
      // Already compressed format (33 bytes = 66 hex chars)
      if (!cleanHex.startsWith('02') && !cleanHex.startsWith('03')) {
        setError('Invalid compressed ECDSA public key. Must start with 02 or 03.');
        return;
      }
      finalPubkeyHex = cleanHex;
    } else if (/^[0-9a-fA-F]{130}$/.test(cleanHex)) {
      // Uncompressed format (65 bytes = 130 hex chars), need to compress
      if (!cleanHex.startsWith('04')) {
        setError('Invalid uncompressed ECDSA public key. Must start with 04.');
        return;
      }
      try {
        finalPubkeyHex = compressPublicKey(cleanHex);
      } catch (e) {
        setError('Failed to compress public key: ' + (e as Error).message);
        return;
      }
    } else {
      setError('Invalid ECDSA public key format. Must be 66 hex characters (compressed) or 130 hex characters (uncompressed).');
      return;
    }
    
    // Auto-assign next available UID
    const nextUID = participants.length > 0 ? Math.max(...participants.map(p => p.uid)) + 1 : 1;
    
    if (participants.some(p => p.publicKey === finalPubkeyHex)) {
      setError('Public key already exists. Each participant must have a unique public key.');
      return;
    }
    
    setParticipants(prev => [...prev, { 
      uid: nextUID,
      publicKey: finalPubkeyHex, // Store compressed format without 0x prefix
      nickname: newParticipant.nickname
    }]);
    
    setNewParticipant({
      uid: nextUID + 1, // This will be used for next auto-increment
      publicKey: '',
      nickname: ''
    });
    setError('');
  };
  
  const removeParticipant = (uid: number) => {
    setParticipants(prev => prev.filter(p => p.uid !== uid));
  };
  
  const generateRosterFromParticipants = (): Array<[number, string, string]> => {
    return participants.map(p => [
      p.uid,
      `0x${p.uid.toString(16).padStart(4, '0')}`, // Generate ID hex from UID
      p.publicKey
    ]);
  };

  const requestChallenge = async () => {
    if (!wsConnection) return;
    console.log('📩 Requesting challenge... Current auth state:', {
      hasPrivateKey: !!authState.dkgPrivateKey,
      hasPublicKey: !!authState.publicKeyHex,
      derivationMethod: authState.derivationMethod
    });
    const message = { type: 'RequestChallenge' };
    wsConnection.send(JSON.stringify(message));
  };

  // Clear stored keys to force regeneration
  const resetAuthState = () => {
    setAuthState(prev => ({ 
      ...prev, 
      publicKeyHex: undefined,
      dkgPrivateKey: undefined,
      dkgPublicKey: undefined,
      derivationMethod: undefined,
      isAuthenticated: false,
      challenge: undefined,
      uuid: undefined
    }));
    console.log('🔄 Authentication state reset - will generate new DKG keypair');
  };

  // Generate a deterministic DKG keypair based on user's wallet
  const generateDkgKeypair = async (): Promise<{ privateKey: string; publicKey: string } | null> => {
    if (!address || !walletClient) return null;
    
    // Initialize elliptic.js if needed
    const ellipticReady = await initializeElliptic();
    if (!ellipticReady || !ec) {
      console.error('Failed to initialize elliptic.js');
      return null;
    }

    try {
      // Create a deterministic seed by signing a fixed message with the wallet
      const seedMessage = "DKG_KEYPAIR_SEED";
      const seedSignature = await walletClient.signMessage({
        account: address,
        message: seedMessage
      });

      // Use the signature as entropy to derive a private key
      const seedBytes = hexToBytes(seedSignature as `0x${string}`);
      const seedHash = keccak256(seedBytes);
      
      // Create key pair from the hash
      const keyPair = ec.keyFromPrivate(seedHash, 'hex');
      
      // Get compressed public key
      const publicKeyHex = keyPair.getPublic(true, 'hex');
      const privateKeyHex = keyPair.getPrivate('hex');

      console.log('Generated DKG keypair:', {
        seedMessage,
        publicKey: publicKeyHex,
        privateKeyLength: privateKeyHex.length,
        publicKeyLength: publicKeyHex.length
      });

      return {
        privateKey: privateKeyHex,
        publicKey: publicKeyHex
      };
    } catch (error) {
      console.error('Failed to generate DKG keypair:', error);
      return null;
    }
  };

  const getDeterministicPublicKey = async () => {
    if (!address || !walletClient) {
      console.log('❌ Missing address or walletClient:', { address: !!address, walletClient: !!walletClient });
      return '';
    }
    
    // Return cached keypair if available
    if (authState.dkgPublicKey && authState.dkgPrivateKey) {
      console.log('✅ Using cached DKG keypair:', authState.dkgPublicKey);
      return authState.dkgPublicKey;
    }
    
    console.log('🔄 Generating client-side DKG keypair...');
    
    // Generate deterministic DKG keypair
    const keypair = await generateDkgKeypair();
    if (!keypair) {
      console.error('❌ Failed to generate DKG keypair');
      return '';
    }
    
    console.log('🔑 Generated keypair:', {
      publicKey: keypair.publicKey,
      privateKeyLength: keypair.privateKey.length,
      hasPrivateKey: !!keypair.privateKey
    });
    
    // Store the keypair in auth state
    setAuthState(prev => {
      const newState = {
        ...prev,
        publicKeyHex: keypair.publicKey,
        dkgPrivateKey: keypair.privateKey,
        dkgPublicKey: keypair.publicKey,
        derivationMethod: 'client_keypair'
      };
      console.log('📝 Updating auth state with DKG keypair:', {
        hadPrivateKey: !!prev.dkgPrivateKey,
        nowHasPrivateKey: !!newState.dkgPrivateKey,
        privateKeyLength: keypair.privateKey.length,
        publicKey: keypair.publicKey
      });
      return newState;
    });
    
    console.log('✅ Client-side DKG keypair stored and ready:', keypair.publicKey);
    return keypair.publicKey;
  };


  const authenticateWithServer = async () => {
    if (!wsConnection || !authState.uuid || !address || !walletClient) return;
    
    console.log('🔐 Starting authentication process...');
    console.log('Auth state check:', {
      hasUuid: !!authState.uuid,
      hasPublicKey: !!authState.publicKeyHex,
      hasPrivateKey: !!authState.dkgPrivateKey,
      derivationMethod: authState.derivationMethod
    });
    
    try {
      // 1. Use the stored public key from authState (consistent with session creation)
      let pubkeyHex = authState.publicKeyHex;
      let privateKeyHex = authState.dkgPrivateKey;
      
      if (!pubkeyHex || !privateKeyHex) {
        console.log('⚠️ Missing cached keys, generating new ones...');
        const keypair = await generateDkgKeypair();
        if (!keypair) {
          setError('Failed to generate DKG keypair for authentication');
          return;
        }
        
        pubkeyHex = keypair.publicKey;
        privateKeyHex = keypair.privateKey;
        
        // Update auth state (async)
        setAuthState(prev => ({
          ...prev,
          publicKeyHex: keypair.publicKey,
          dkgPrivateKey: keypair.privateKey,
          dkgPublicKey: keypair.publicKey,
          derivationMethod: 'client_keypair'
        }));
        
        console.log('✅ Generated fresh keypair for authentication:', pubkeyHex);
      } else {
        console.log('✅ Using cached keypair:', pubkeyHex);
      }
      
      // 2. Parse challenge UUID and get bytes
      const uuidBytes = new Uint8Array(16);
      const uuid = authState.uuid.replace(/-/g, '');
      for (let i = 0; i < 16; i++) {
        uuidBytes[i] = parseInt(uuid.substring(i * 2, i * 2 + 2), 16);
      }
      
      console.log('Challenge UUID:', authState.uuid);
      console.log('UUID bytes:', Array.from(uuidBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      // 3. Compute Keccak256(challenge_bytes) using proper js-sha3 library
      // This should match the server's Rust Keccak256 implementation
      const properDigest = '0x' + keccak256(uuidBytes);
      console.log('Proper Keccak256 digest:', properDigest);
      
      // Test with known values to verify correctness
      const testBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const testDigest = '0x' + keccak256(testBytes);
      console.log('Test digest (0x01020304):', testDigest);
      
      const digest = properDigest;
      
      // 4. Sign using client-side DKG private key for raw signing
      console.log('🔑 Using DKG private key for signing...');
      console.log('Private key status:', {
        exists: !!privateKeyHex,
        length: privateKeyHex?.length,
        type: typeof privateKeyHex
      });
      
      if (!privateKeyHex) {
        console.error('❌ DKG private key not available after generation');
        setError('Failed to get DKG private key for signing.');
        return;
      }

      // Initialize elliptic.js if needed
      const ellipticReady = await initializeElliptic();
      if (!ellipticReady || !ec) {
        setError('Failed to initialize elliptic.js library. Please try again.');
        return;
      }

      console.log('✅ Signing with client-side DKG private key...');
      
      // Create key pair from private key
      const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
      
      // Sign the raw digest hash directly with elliptic.js
      const digestBytes = hexToBytes(digest as `0x${string}`);
      const signature = keyPair.sign(digestBytes);
      
      // Convert to compact format (r + s, 64 bytes)
      const r = signature.r.toString(16).padStart(64, '0');
      const s = signature.s.toString(16).padStart(64, '0');
      const signatureHex = r + s;
      
      console.log('Raw signature created:', signatureHex);
      
      // Verify the signature matches our public key
      const isValid = keyPair.verify(digestBytes, signature);
      console.log('✅ Signature verification:', isValid ? 'VALID' : 'INVALID');
      console.log('Final signature hex length:', signatureHex.length, 'signature:', signatureHex);
      
      const message = {
        type: 'Login',
        payload: {
          challenge: authState.uuid,
          pubkey_hex: pubkeyHex, // 33-byte compressed SEC1 format
          signature_hex: signatureHex // 64-byte compact format (r||s)
        }
      };
      
      console.log('Sending login message:', {
        challenge: authState.uuid,
        pubkey_hex: pubkeyHex,
        signature_hex: signatureHex,
        signature_length: signatureHex.length,
        method: 'client_keypair'
      });
      
      setAuthState(prev => ({ 
        ...prev, 
        signature: signatureHex,
        publicKeyHex: pubkeyHex // Store the deterministic public key
      }));
      wsConnection.send(JSON.stringify(message));
      
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Failed to authenticate with server: ' + (error as Error).message);
    }
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
    
    // Server requires exactly maxSigners total participants
    if (participants.length !== maxSigners) {
      if (participants.length > maxSigners) {
        setError(`Too many participants. Need exactly ${maxSigners} participants. Remove ${participants.length - maxSigners} participants.`);
      } else {
        setError(`Need exactly ${maxSigners} participants. Add ${maxSigners - participants.length} more participants (including yourself).`);
      }
      return;
    }


    setIsCreatingSession(true);

    try {
      // Generate DKG keypair for the session creator (current user) before creating session
      console.log('🔄 Generating DKG keypair for session creation...');
      const creatorPublicKey = await getDeterministicPublicKey();
      if (!creatorPublicKey) {
        setError('Failed to generate DKG keypair for session creation');
        setIsCreatingSession(false);
        return;
      }
      
      console.log('✅ Creator DKG keypair ready:', creatorPublicKey);
      const message = {
        type: 'AnnounceSession',
        payload: {
          min_signers: minSigners,
          max_signers: maxSigners,
          group_id: groupId || `group_${Date.now()}`,
          participants: participants.map(p => p.uid),
          participants_pubs: participants.map(p => [p.uid, p.publicKey])
        }
      };

      if (wsConnection && connectionStatus === 'connected') {
        console.log('Creating DKG session:', message);
        console.log('WebSocket readyState:', wsConnection.readyState);
        wsConnection.send(JSON.stringify(message));
        
        setTimeout(() => {
          if (isCreatingSession) {
            console.log('Session creation timeout');
            setError('Server response timeout. Session creation may have failed.');
            setIsCreatingSession(false);
          }
        }, 10000);
      } else {
        console.log('Demo mode: Creating DKG session:', message);
        setTimeout(() => {
          simulateSessionCreated(message);
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
      groupId: groupId || `group_${Date.now()}`,
      topic: originalMessage.topic || `topic_${Date.now()}`,
      createdAt: new Date(),
      myRole: 'creator',
      description: description || 'DKG Key Generation Ceremony',
      participants: [...participants],
      roster: originalMessage.roster || generateRosterFromParticipants()
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
      payload: sessionToJoin
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
              {!authState.publicKeyHex && walletClient && (
                <Button 
                  onClick={async () => {
                    const pubKey = await getDeterministicPublicKey();
                    setAuthState(prev => ({ ...prev, publicKeyHex: pubKey }));
                  }}
                  variant="outline"
                  size="sm"
                >
                  Get My Public Key
                </Button>
              )}
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
                  <Button
                    onClick={resetAuthState}
                    variant="ghost"
                    size="sm"
                  >
                    Reset Auth
                  </Button>
                  {authState.derivationMethod && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Method: {authState.derivationMethod === 'client_keypair' ? 'Client Keypair ✅' : authState.derivationMethod}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {authState.challenge && !authState.isAuthenticated && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Challenge-Response Authentication</h4>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-mono text-blue-700 dark:text-blue-300">UUID: </span>
                  <span className="font-mono">{authState.challenge}</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  <p>• Parse UUID and get bytes: uuid.as_bytes()</p>
                  <p>• Compute signature: sig = sign(Keccak256(uuid_bytes))</p>
                  <p>• Send Login with challenge, pubkey_hex (SEC1), signature_hex (DER)</p>
                  <p>• Server verifies ECDSA signature and roster membership</p>
                </div>
                {authState.publicKeyHex && (
                  <div className="border-t border-blue-200 dark:border-blue-700 pt-2">
                    <div className="mb-1">
                      <span className="font-mono text-green-700 dark:text-green-300 font-semibold">Authenticating with Public Key: </span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border">
                      <span className="font-mono text-xs text-green-800 dark:text-green-200 break-all select-all cursor-pointer">{authState.publicKeyHex}</span>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">This key must be registered in the session roster by the creator</p>
                  </div>
                )}
                {authState.signature && (
                  <div>
                    <span className="font-mono text-blue-700 dark:text-blue-300">Signature: </span>
                    <span className="font-mono">{authState.signature.slice(0, 20)}...</span>
                  </div>
                )}
              </div>
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
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Topic (Optional)</label>
            <Input
              placeholder="Unique topic string for this DKG ceremony"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Unique identifier for the DKG topic. Auto-generated if empty.
            </p>
          </div>
          
          {/* Participant Registration Section */}
          <div className="mb-6 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Participant Registration
              <Badge className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                Authenticated ECDSA Channel
              </Badge>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add all participants (including yourself as the creator) with their ECDSA public keys. 
              UIDs are assigned automatically. DKG messages will be exchanged through this secure authenticated channel.
            </p>
            
            {/* Add New Participant Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nickname (Optional)</label>
                <Input
                  value={newParticipant.nickname}
                  onChange={(e) => setNewParticipant(prev => ({ ...prev, nickname: e.target.value }))}
                  placeholder="Alice"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  ECDSA Public Key *
                </label>
                <Input
                  value={newParticipant.publicKey}
                  onChange={(e) => setNewParticipant(prev => ({ ...prev, publicKey: e.target.value }))}
                  placeholder="02... (compressed) or 04... (uncompressed)"
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addParticipant}
                  disabled={!newParticipant.publicKey.trim()}
                  className="w-full"
                >
                  Add Participant
                </Button>
              </div>
            </div>
            
            {/* Registered Participants List */}
            <div>
              <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">
                Registered Participants ({participants.length}/{maxSigners})
              </h4>
              {participants.length === 0 ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  No participants registered yet
                </div>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div key={participant.uid} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              UID: {participant.uid}
                              {participant.nickname && (
                                <span className="ml-2 text-gray-600 dark:text-gray-400">({participant.nickname})</span>
                              )}
                            </p>
                            <p className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                              PubKey: {participant.publicKey}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParticipant(participant.uid)}
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {participants.length < maxSigners && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  ⚠️ You need to register {maxSigners - participants.length} more participant(s) to match the max signers count.
                </p>
              </div>
            )}
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
              <p>• Topic: {topic || 'Auto-generated'}</p>
              <p>• Group ID: {groupId || 'Auto-generated'}</p>
              <p>• Registered Participants: {participants.length}/{maxSigners}</p>
              <p>• Role: You will be the session creator and coordinator</p>
              <p>• Authentication: ECDSA-signed messages over Keccak256 digest</p>
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
                  {sessionParticipants.map((participant) => (
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

      {/* Enhanced Instructions */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-900/20">
        <h3 className="font-semibold mb-4 text-blue-800 dark:text-blue-200">FROST DKG Process Overview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-300">Authentication Flow</h4>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <p>1. Client → Server: RequestChallenge</p>
              <p>2. Server → Client: Challenge {`{ challenge: uuid }`}</p>
              <p>3. Client computes: sig = sign(Keccak256(uuid.as_bytes()))</p>
              <p>4. Client → Server: Login {`{ challenge, pubkey_hex, signature_hex }`}</p>
              <p>5. Server verifies ECDSA signature and roster membership</p>
              <p>6. Server → Client: LoginOk {`{ user_id, access_token }`}</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-300">DKG Ceremony Flow</h4>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <p>1. Creator announces session with participant roster (UIDs + public keys)</p>
              <p>2. Participants join session after authentication</p>
              <p>3. Round 1: Submit FROST commitments (signed)</p>
              <p>4. Round 2: Submit ECIES-encrypted secret shares</p>
              <p>5. Finalize: Submit group public key (signed)</p>
              <p>6. Complete: Key shares written to files</p>
            </div>
          </div>
        </div>
        
        <div className="border-t border-blue-200 dark:border-blue-700 pt-4">
          <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-300">Implementation Details</h4>
          <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
            <p>• <strong>Message Signing:</strong> ECDSA signatures over Keccak256(payload) with specific domains</p>
            <p>• <strong>Round 2 Encryption:</strong> ECIES (secp256k1 ECDH → AES-256-GCM) per recipient</p>
            <p>• <strong>Serialization:</strong> Bincode format for FROST data structures</p>
            <p>• <strong>Output Files:</strong> group.json (public) and share_*.json (private)</p>
            <p>• <strong>Server Architecture:</strong> WebSocket coordinator with session management</p>
          </div>
        </div>
      </Card>
      </div>
    </Layout>
  );
}