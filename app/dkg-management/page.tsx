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
  groupVerifyingKey?: string; // Group verification key (SEC1 hex) when completed
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
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isJoiningSession, setIsJoiningSession] = useState(false);
  
  // DKG Round States
  const [round1Packages, setRound1Packages] = useState<any[]>([]);
  const [round2Packages, setRound2Packages] = useState<any[]>([]);
  const [isSubmittingRound1, setIsSubmittingRound1] = useState(false);
  const [isSubmittingRound2, setIsSubmittingRound2] = useState(false);
  const [isSubmittingFinalize, setIsSubmittingFinalize] = useState(false);
  
  // Store FROST identifiers assigned by server
  const [frostIdMap, setFrostIdMap] = useState<{[sessionId: string]: string}>({});
  
  // Commitment Modal State
  const [showCommitmentModal, setShowCommitmentModal] = useState(false);
  const [commitmentInput, setCommitmentInput] = useState('');
  const [selectedSessionForCommitment, setSelectedSessionForCommitment] = useState<DKGSession | null>(null);

  // Generate placeholder for commitment input
  const generateMockCommitment = () => {
    // Real FROST packages cannot be generated in the browser
    // This is just a placeholder to show the UI works
    return "// Real FROST Round1 package required\n// Use: cargo run -p dkg\n// Then copy the generated hex data here";
  };
  
  // Debug effect to track FROST ID changes
  useEffect(() => {
    console.log('🔄 FROST ID map updated:', frostIdMap);
    console.log('🔄 Available sessions:', Object.keys(frostIdMap));
  }, [frostIdMap]);
  
  // Notification system
  const [hasNotifiedRound1, setHasNotifiedRound1] = useState(new Set<string>());
  const [hasNotifiedRound2, setHasNotifiedRound2] = useState(new Set<string>());
  const [hasNotifiedFinalize, setHasNotifiedFinalize] = useState(new Set<string>());
  
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

  // Update session roles when address changes (for proper role detection)
  useEffect(() => {
    if (address && sessions.length > 0) {
      const sessionsNeedingRoleUpdate = sessions.filter(session => !session.myRole);
      if (sessionsNeedingRoleUpdate.length > 0) {
        console.log(`🔧 Updating myRole for ${sessionsNeedingRoleUpdate.length} sessions`);
        const updatedSessions = sessions.map(session => ({
          ...session,
          // Set myRole if missing based on creator field
          myRole: session.myRole || (session.creator === address ? 'creator' : 'participant')
        }));
        setSessions(updatedSessions);
        // Save the updated sessions to localStorage
        localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
      }
    }
  }, [address]);

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
    console.log('🔍 Message type specifically:', message.type);
    
    // Track all message types for debugging
    if (message.type === 'ReadyRound1') {
      console.log('🎯🎯🎯 ReadyRound1 MESSAGE RECEIVED 🎯🎯🎯');
      console.log('📋 Full ReadyRound1 payload:', JSON.stringify(message.payload, null, 2));
    }
    
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
        setIsJoiningSession(false);
        setSuccessMessage('');
        break;
      
      case 'Info':
        // Handle join session success and participant count updates
        if (message.payload?.message) {
          const infoMessage = message.payload.message;
          console.log('Server info:', infoMessage);
          
          // Check if it's a join progress message (various formats: "joined 2/3", "participant 2 of 3", etc.)
          const joinMatch = infoMessage.match(/(?:joined|participant)\s*(\d+)(?:\s*of\s*|\s*\/\s*)(\d+)|(\d+)\/(\d+)/);
          if (joinMatch) {
            const current = joinMatch[1] || joinMatch[3];
            const total = joinMatch[2] || joinMatch[4];
            console.log(`🎉 Participant join update: ${current}/${total}`);
            
            // For users who just joined, show success notification
            if (isJoiningSession) {
              setError('');
              setSuccessMessage(`🎉 Successfully joined session! Waiting for ${parseInt(total) - parseInt(current)} more participant(s) to join before starting DKG rounds.`);
              setIsJoiningSession(false);
            }
            
            // Update ALL sessions with this participant count if we can determine the session ID
            // For now, update the session we're trying to join or any session with matching participant counts
            if (sessionToJoin) {
              setSessions(prev => {
                const existing = prev.find(s => s.id === sessionToJoin);
                let updatedSessions;
                if (existing) {
                  // Update existing session
                  updatedSessions = prev.map(s => s.id === sessionToJoin ? 
                    { 
                      ...s, 
                      currentParticipants: parseInt(current), 
                      status: current === total ? 'round1' as const : 'waiting' as const, 
                      maxSigners: parseInt(total), 
                      myRole: s.myRole || ('participant' as const) 
                    } : s
                  );
                } else {
                  // Create new session entry for joined session
                  const joinedSession: DKGSession = {
                    id: sessionToJoin,
                    creator: 'Unknown', // We don't know who created it
                    minSigners: Math.max(2, parseInt(total) - 1), // Reasonable default
                    maxSigners: parseInt(total),
                    currentParticipants: parseInt(current),
                    status: current === total ? 'round1' as const : 'waiting' as const,
                    groupId: `joined_group_${Date.now()}`,
                    topic: `joined_topic_${Date.now()}`,
                    createdAt: new Date(),
                    myRole: 'participant' as const,
                    description: 'Joined DKG Session',
                    participants: [],
                    roster: []
                  };
                  updatedSessions = [...prev, joinedSession];
                }
                // Save to localStorage
                localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
                return updatedSessions;
              });
              
              if (current === total) {
                setActiveTab('active'); // Switch to active sessions tab when full
              }
              setSessionToJoin(''); // Clear the input after successful join
            }
          } else {
            // Other info messages - might contain session updates for creators
            console.log('Server info (other):', infoMessage);
            
            // Check for other participant update patterns that might include session IDs
            if (infoMessage.includes('participant') || infoMessage.includes('joined') || infoMessage.includes('user')) {
              console.log('📊 Participant activity detected:', infoMessage);
              
              // Try to extract session ID from message if present
              const sessionIdMatch = infoMessage.match(/session[:\s]+([a-f0-9-]{36})/i) || 
                                   infoMessage.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
              
              if (sessionIdMatch) {
                const possibleSessionId = sessionIdMatch[1];
                console.log(`🔍 Detected session update for ID: ${possibleSessionId}`);
                
                // Try to extract participant count from the message
                const countMatch = infoMessage.match(/(\d+)(?:\s*of\s*|\s*\/\s*)(\d+)/);
                if (countMatch) {
                  const current = countMatch[1];
                  const total = countMatch[2];
                  console.log(`📊 Updating session ${possibleSessionId}: ${current}/${total} participants`);
                  
                  setSessions(prev => {
                    const updatedSessions = prev.map(s => s.id === possibleSessionId ? 
                      { ...s, currentParticipants: parseInt(current), maxSigners: parseInt(total) } : s
                    );
                    localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
                    return updatedSessions;
                  });
                }
              }
            }
          }
        }
        break;

      case 'ReadyRound1':
        // ReadyRound1 is sent when all participants have joined and DKG is starting
        const sessionId = message.payload.session;
        const roster = message.payload.roster;
        const participantCount = roster.length;
        const myIdHex = message.payload.id_hex; // This is our FROST identifier for this session
        
        console.log('🎯 ReadyRound1 received for session:', sessionId);
        console.log('📋 My FROST ID:', myIdHex);
        console.log('👥 Roster:', roster);
        console.log('🔍 FROST ID type:', typeof myIdHex, 'length:', myIdHex?.length);
        
        // Validate FROST ID before storing
        if (!myIdHex || typeof myIdHex !== 'string' || myIdHex.length === 0) {
          console.error('❌ Invalid FROST ID received:', myIdHex);
          setError(`Invalid FROST identifier received: ${myIdHex}`);
          break;
        }
        
        // Store our FROST ID for this session
        setFrostIdMap(prev => {
          const updated: {[sessionId: string]: string} = { ...prev, [sessionId]: myIdHex };
          console.log('🗂️ Updated FROST ID map:', updated);
          console.log('🔍 Verifying storage - session:', sessionId, 'stored ID:', updated[sessionId]);
          return updated;
        });
        
        // Update the session in our sessions list
        setSessions(prev => {
          const updatedSessions = prev.map(session => 
            session.id === sessionId ? {
              ...session,
              status: 'round1' as const,
              currentParticipants: participantCount,
              minSigners: message.payload.min_signers,
              maxSigners: message.payload.max_signers,
              groupId: message.payload.group_id,
              roster: roster
            } : session
          );
          // Save to localStorage
          localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
          return updatedSessions;
        });
        
        // Update selected session if it matches
        if (selectedSession && selectedSession.id === sessionId) {
          setSelectedSession(prev => prev ? { 
            ...prev, 
            status: 'round1' as const,
            currentParticipants: participantCount,
            minSigners: message.payload.min_signers,
            maxSigners: message.payload.max_signers,
            groupId: message.payload.group_id,
            roster: roster
          } : null);
        }
        
        const participantsData = roster.map((item: any) => ({
          uid: item[0],
          address: '', // We don't have address from roster
          status: 'joined' as const,
          idHex: item[1],
          ecdsaPubHex: item[2]
        }));
        setSessionParticipants(participantsData);
        
        // Show success notification for round start
        console.log(`🚀 All ${participantCount} participants joined! Starting Round 1...`);
        setSuccessMessage(`🚀 All ${participantCount} participants have joined! DKG Round 1 (Commitments) is now starting...`);
        setError('');

        // Show notification for Round 1 if not already shown for this session
        if (!hasNotifiedRound1.has(sessionId)) {
          showBrowserNotification(
            '🎯 DKG Round 1 Started',
            `Session ${sessionId.slice(0, 8)}... requires your commitment submission`
          );
          playNotificationSound();
          setHasNotifiedRound1(prev => new Set(Array.from(prev).concat(sessionId)));
        }
        break;

      case 'Round1All':
        // All Round 1 packages collected, now participants can proceed to Round 2
        const round1SessionId = message.payload.session;
        const packages = message.payload.packages;
        
        console.log(`📦 Round1All received for session ${round1SessionId}: ${packages.length} packages`);
        setRound1Packages(packages);
        
        // Update session status to round2
        setSessions(prev => {
          const updatedSessions = prev.map(session => 
            session.id === round1SessionId ? { ...session, status: 'round2' as const } : session
          );
          localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
          return updatedSessions;
        });
        
        if (selectedSession && selectedSession.id === round1SessionId) {
          setSelectedSession(prev => prev ? { ...prev, status: 'round2' as const } : null);
        }
        
        setSuccessMessage(`📦 Round 1 complete! All ${packages.length} commitment packages collected. Ready for Round 2 (Secret Shares).`);

        // Show notification for Round 2 if not already shown for this session
        if (!hasNotifiedRound2.has(round1SessionId)) {
          showBrowserNotification(
            '🔒 DKG Round 2 Ready',
            `Session ${round1SessionId.slice(0, 8)}... requires your encrypted secret shares`
          );
          playNotificationSound();
          setHasNotifiedRound2(prev => new Set(Array.from(prev).concat(round1SessionId)));
        }
        break;

      case 'ReadyRound2':
        if (selectedSession) {
          const sessionId = selectedSession.id;
          setSessions(prev => {
            const updatedSessions = prev.map(session => 
              session.id === sessionId ? { ...session, status: 'round2' as const } : session
            );
            localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
            return updatedSessions;
          });
          setSelectedSession(prev => prev ? { ...prev, status: 'round2' as const } : null);
        }
        break;

      case 'Round2All':
        // All Round 2 packages collected, now participants can finalize
        const round2SessionId = message.payload.session;
        const encryptedPackages = message.payload.packages;
        
        console.log(`🔒 Round2All received for session ${round2SessionId}: ${encryptedPackages.length} encrypted packages`);
        setRound2Packages(encryptedPackages);
        
        // Update session status to finalizing
        setSessions(prev => {
          const updatedSessions = prev.map(session => 
            session.id === round2SessionId ? { ...session, status: 'finalizing' as const } : session
          );
          localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
          return updatedSessions;
        });
        
        if (selectedSession && selectedSession.id === round2SessionId) {
          setSelectedSession(prev => prev ? { ...prev, status: 'finalizing' as const } : null);
        }
        
        setSuccessMessage(`🔒 Round 2 complete! All ${encryptedPackages.length} encrypted secret share packages collected. Ready for Finalization.`);

        // Show notification for Finalization if not already shown for this session
        if (!hasNotifiedFinalize.has(round2SessionId)) {
          showBrowserNotification(
            '🎯 DKG Finalization Ready',
            `Session ${round2SessionId.slice(0, 8)}... requires your final group key submission`
          );
          playNotificationSound();
          setHasNotifiedFinalize(prev => new Set(Array.from(prev).concat(round2SessionId)));
        }
        break;

      case 'Finalized':
        // DKG ceremony completed successfully
        const finalizedSessionId = message.payload.session;
        const groupVk = message.payload.group_vk_sec1_hex;
        
        console.log(`🎉 DKG Finalized for session ${finalizedSessionId}! Group VK: ${groupVk}`);
        
        setSessions(prev => {
          const updatedSessions = prev.map(session => 
            session.id === finalizedSessionId ? { 
              ...session, 
              status: 'completed' as const,
              // Store the group verification key
              groupVerifyingKey: groupVk
            } : session
          );
          localStorage.setItem('dkg-sessions', JSON.stringify(updatedSessions));
          return updatedSessions;
        });
        
        if (selectedSession && selectedSession.id === finalizedSessionId) {
          setSelectedSession(prev => prev ? { 
            ...prev, 
            status: 'completed' as const,
            groupVerifyingKey: groupVk
          } : null);
        }
        
        setSuccessMessage(`🎉 DKG Ceremony Complete! Distributed keys generated successfully. Group verification key available for download.`);
        setError('');
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
        derivationMethod: 'client_keypair' as const
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
          derivationMethod: 'client_keypair' as const
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
      
      console.log('🔍 DEBUG: Challenge UUID:', authState.uuid);
      console.log('🔍 DEBUG: UUID without dashes:', uuid);
      console.log('🔍 DEBUG: UUID bytes (hex):', Array.from(uuidBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
      console.log('🔍 DEBUG: UUID bytes (decimal):', Array.from(uuidBytes));
      
      // 3. Compute Keccak256(challenge_bytes) using proper js-sha3 library
      // This should match the server's Rust Keccak256 implementation
      const properDigest = '0x' + keccak256(uuidBytes);
      console.log('🔍 DEBUG: Keccak256 digest:', properDigest);
      
      // Test with known values to verify correctness
      const testBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const testDigest = '0x' + keccak256(testBytes);
      console.log('🔍 DEBUG: Test digest (0x01020304):', testDigest);
      
      const digest = properDigest;
      console.log('🔍 DEBUG: Final digest for signing:', digest);
      
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
      console.log('🔍 DEBUG: Digest bytes for signing:', Array.from(digestBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
      console.log('🔍 DEBUG: Private key (first 16 chars):', privateKeyHex.slice(0, 16) + '...');
      console.log('🔍 DEBUG: Public key:', pubkeyHex);
      
      const signature = keyPair.sign(digestBytes);
      console.log('🔍 DEBUG: Original signature r:', signature.r.toString(16));
      console.log('🔍 DEBUG: Original signature s:', signature.s.toString(16));
      
      // Ensure canonical signature (low-s form) as required by many ECDSA implementations
      const n = ec.curve.n;
      let s = signature.s;
      const wasNormalized = s.gt(n.shln(1));
      if (wasNormalized) {
        s = n.sub(s);
        console.log('🔍 DEBUG: Signature s was normalized (high-s -> low-s)');
      } else {
        console.log('🔍 DEBUG: Signature s was already in canonical form');
      }
      console.log('🔍 DEBUG: Final signature s:', s.toString(16));
      
      // Convert to compact format (r + s, 64 bytes)
      const r = signature.r.toString(16).padStart(64, '0');
      const sHex = s.toString(16).padStart(64, '0');
      const signatureHex = r + sHex;
      
      console.log('🔍 DEBUG: Signature r (hex):', r);
      console.log('🔍 DEBUG: Signature s (hex):', sHex);
      console.log('🔍 DEBUG: Final signature (r||s):', signatureHex);
      
      // Verify the signature matches our public key (use normalized signature)
      const normalizedSig = { r: signature.r, s: s };
      const isValid = keyPair.verify(digestBytes, normalizedSig);
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
      
      console.log('🔍 DEBUG: Sending login message with:', {
        type: 'Login',
        challenge: authState.uuid,
        pubkey_hex: pubkeyHex,
        pubkey_length: pubkeyHex.length,
        signature_hex: signatureHex,
        signature_length: signatureHex.length,
        method: 'client_keypair'
      });
      
      console.log('🔍 DEBUG: Message payload structure:', {
        challenge_length: authState.uuid.length,
        pubkey_format: 'compressed SEC1',
        signature_format: 'compact r||s',
        expected_sig_length: 128
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

    setIsJoiningSession(true);
    setError('');
    setSuccessMessage('');

    const message = {
      type: 'JoinSession',
      payload: {
        session: sessionToJoin
      }
    };

    console.log('🔗 Attempting to join session:', sessionToJoin);
    wsConnection.send(JSON.stringify(message));
  };

  // Open commitment modal
  const openCommitmentModal = (session: DKGSession) => {
    setSelectedSessionForCommitment(session);
    setCommitmentInput('');
    setShowCommitmentModal(true);
  };

  // Submit commitment from modal
  const submitCommitment = async () => {
    if (!selectedSessionForCommitment || !wsConnection || !authState.isAuthenticated) {
      setError('Invalid session or not authenticated.');
      return;
    }

    if (!commitmentInput.trim()) {
      setError('Please provide the commitment package.');
      return;
    }

    setIsSubmittingRound1(true);
    setError('');

    try {
      // Get the FROST identifier assigned by the server for this session
      const myIdHex = frostIdMap[selectedSessionForCommitment.id];
      
      if (!myIdHex) {
        throw new Error(`FROST identifier not available for session ${selectedSessionForCommitment.id}. Make sure ReadyRound1 message was received.`);
      }

      // Create the authentication payload for Round 1
      // Use a simplified format since we don't have access to FROST library structures
      // The server will need to verify this differently for frontend submissions
      const authPayloadText = `TOKAMAK_FROST_DKG_R1|${selectedSessionForCommitment.id}|${myIdHex}|${commitmentInput.trim()}`;
      
      // Sign the payload using MetaMask
      const signature = await signMessageAsync({
        message: authPayloadText
      });

      const message = {
        type: 'Round1Submit',
        payload: {
          session: selectedSessionForCommitment.id,
          id_hex: myIdHex,
          pkg_bincode_hex: commitmentInput.trim(),
          sig_ecdsa_hex: signature.slice(2) // Remove '0x' prefix
        }
      };

      console.log('📤 Submitting Round 1 commitment for session:', selectedSessionForCommitment.id);
      console.log('📋 Auth payload signed:', authPayloadText);
      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🔐 Round 1 commitment submitted successfully!');
      setShowCommitmentModal(false);
      
    } catch (error) {
      console.error('Round 1 submission error:', error);
      setError('Failed to submit Round 1 package: ' + (error as Error).message);
    } finally {
      setIsSubmittingRound1(false);
    }
  };

  // DKG Round Submission Functions (legacy function - now redirects to modal)
  const submitRound1 = async (session: DKGSession) => {
    openCommitmentModal(session);
  };

  const submitRound2 = async (session: DKGSession) => {
    if (!wsConnection || !authState.isAuthenticated || !authState.dkgPrivateKey) {
      setError('Must be authenticated with DKG keypair to submit Round 2.');
      return;
    }

    setIsSubmittingRound2(true);
    setError('');

    try {
      // Get the FROST identifier assigned by the server for this session
      const myIdHex = frostIdMap[session.id];
      if (!myIdHex) {
        throw new Error('FROST identifier not available. Make sure ReadyRound1 message was received.');
      }
      
      // In a real implementation, this would generate encrypted per-recipient packages
      // For demo purposes, create properly formatted hex values
      
      // Create mock encrypted packages for each participant
      const mockEncryptedPackages: [string, string, string, string, string][] = [];
      
      if (session.roster) {
        session.roster.forEach(([uid, recipientIdHex, ecdsaPubHex]) => {
          // Create mock encrypted data
          const ephPubHex = Array.from(new Uint8Array(33).fill(170)).map(b => b.toString(16).padStart(2, '0')).join('');
          const nonceHex = Array.from(new Uint8Array(12).fill(187)).map(b => b.toString(16).padStart(2, '0')).join('');
          const ciphertextHex = Array.from(new Uint8Array(32).fill(204)).map(b => b.toString(16).padStart(2, '0')).join('');
          const signatureHex = Array.from(new Uint8Array(64).fill(221)).map(b => b.toString(16).padStart(2, '0')).join('');
          
          mockEncryptedPackages.push([recipientIdHex, ephPubHex, nonceHex, ciphertextHex, signatureHex]);
        });
      }

      const message = {
        type: 'Round2Submit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          pkgs_cipher_hex: mockEncryptedPackages
        }
      };

      console.log('📤 Submitting Round 2 encrypted packages for session:', session.id);
      console.log('📋 Created', mockEncryptedPackages.length, 'encrypted packages');
      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🔒 Round 2 encrypted secret shares submitted! Waiting for other participants...');
    } catch (error) {
      console.error('Round 2 submission error:', error);
      setError('Failed to submit Round 2 packages: ' + (error as Error).message);
    } finally {
      setIsSubmittingRound2(false);
    }
  };

  const submitFinalize = async (session: DKGSession) => {
    if (!wsConnection || !authState.isAuthenticated || !authState.dkgPrivateKey) {
      setError('Must be authenticated with DKG keypair to finalize.');
      return;
    }

    setIsSubmittingFinalize(true);
    setError('');

    try {
      // Get the FROST identifier assigned by the server for this session
      const myIdHex = frostIdMap[session.id];
      if (!myIdHex) {
        throw new Error('FROST identifier not available. Make sure ReadyRound1 message was received.');
      }
      
      // In a real implementation, this would compute the group verification key
      // For demo purposes, create a properly formatted mock group verification key
      const mockGroupVk = new Uint8Array(33); // 33-byte compressed SEC1 public key
      mockGroupVk.fill(3); // Start with 0x03 for compressed point
      mockGroupVk[0] = 3; // Set proper compression prefix
      const groupVkHex = Array.from(mockGroupVk).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Create mock ECDSA signature
      const mockSignature = new Uint8Array(64);
      mockSignature.fill(255); // Simple mock data
      const sigHex = Array.from(mockSignature).map(b => b.toString(16).padStart(2, '0')).join('');

      const message = {
        type: 'FinalizeSubmit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          group_vk_sec1_hex: groupVkHex,
          sig_ecdsa_hex: sigHex
        }
      };

      console.log('📤 Submitting finalization for session:', session.id);
      console.log('📋 Mock group VK:', groupVkHex.slice(0, 16) + '...');
      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🎯 Finalization submitted! Computing final group verification key...');
    } catch (error) {
      console.error('Finalization submission error:', error);
      setError('Failed to submit finalization: ' + (error as Error).message);
    } finally {
      setIsSubmittingFinalize(false);
    }
  };

  const clearAllSessions = () => {
    localStorage.removeItem('dkg-sessions');
    setSessions([]);
    setSelectedSession(null);
    setError('');
  };

  // Notification functions
  const showBrowserNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    }
  };

  const playNotificationSound = () => {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Audio notification not available:', error);
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // Request notification permission on component mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Update page title when there are active ceremonies
  useEffect(() => {
    const activeCeremonies = sessions.filter(s => ['round1', 'round2', 'finalizing'].includes(s.status));
    if (activeCeremonies.length > 0) {
      document.title = `(${activeCeremonies.length}) DKG Management - Action Required`;
    } else {
      document.title = 'DKG Management - Tokamak zkEVM';
    }
    
    // Cleanup on unmount
    return () => {
      document.title = 'DKG Management - Tokamak zkEVM';
    };
  }, [sessions]);

  const downloadGroupInfo = (session: DKGSession) => {
    if (!session.groupVerifyingKey) {
      setError('Group verification key not available yet.');
      return;
    }

    const groupInfo = {
      session_id: session.id,
      group_id: session.groupId,
      min_signers: session.minSigners,
      max_signers: session.maxSigners,
      group_verification_key: session.groupVerifyingKey,
      participants: session.roster.map(([uid, id_hex, ecdsa_pub_hex]) => ({
        uid,
        id_hex,
        ecdsa_pub_hex
      })),
      created_at: session.createdAt.toISOString()
    };

    const blob = new Blob([JSON.stringify(groupInfo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `group_${session.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadKeyShare = (session: DKGSession) => {
    if (!session.groupVerifyingKey) {
      setError('Key share not available yet.');
      return;
    }

    // In a real implementation, this would contain the actual key share
    // For demo purposes, we'll create a placeholder structure
    const keyShare = {
      session_id: session.id,
      group_id: session.groupId,
      participant_uid: authState.userId || 'unknown',
      key_share: 'placeholder_key_share_data',
      verification_key: session.groupVerifyingKey,
      created_at: session.createdAt.toISOString(),
      warning: 'This is a placeholder key share for UI demonstration only'
    };

    const blob = new Blob([JSON.stringify(keyShare, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `share_${session.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      case 'round1': return 'Round 1: Submit Commitments';
      case 'round2': return 'Round 2: Submit Secret Shares';
      case 'finalizing': return 'Finalizing: Generate Group Key';
      case 'completed': return 'Completed Successfully';
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
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <div className="flex items-start gap-2">
              <div className="text-amber-600 dark:text-amber-400 mt-0.5">⚠️</div>
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">Demo Mode Active</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Working offline with simulated sessions. Connect to a real DKG server for actual cryptographic ceremonies.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

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


      {/* Active DKG Ceremony Dashboard */}
      {activeTab === 'active' && sessions.filter(s => ['round1', 'round2', 'finalizing'].includes(s.status)).length > 0 && (
        <Card className="mb-6 border-2 border-blue-500 dark:border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">🔄 Active DKG Ceremonies</h2>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                {sessions.filter(s => ['round1', 'round2', 'finalizing'].includes(s.status)).length} ceremony(ies) in progress
              </div>
            </div>
            
            <div className="space-y-4">
              {sessions.filter(s => ['round1', 'round2', 'finalizing'].includes(s.status)).map((session) => (
                <div key={session.id} className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-600 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          Session {session.id}
                        </h3>
                        <Badge className={getStatusColor(session.status)}>
                          {getStatusText(session.status)}
                        </Badge>

                      </div>
                      
                      {/* Action Required Message */}
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {session.status === 'round1' && (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            <span className="font-medium">Action Required:</span> Generate and submit your commitment package for Round 1
                          </div>
                        )}
                        {session.status === 'round2' && (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                            <span className="font-medium">Action Required:</span> Generate encrypted secret shares for other participants
                          </div>
                        )}
                        {session.status === 'finalizing' && (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                            <span className="font-medium">Action Required:</span> Compute and submit the final group verification key
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {session.description || 'DKG Ceremony'} • {session.currentParticipants}/{session.maxSigners} participants
                      </div>
                      
                      {/* Session and FROST ID info */}
                      <div className="text-xs mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded border">
                        <div className="font-mono">
                          Session ID: {session.id}
                        </div>
                        <div className="font-mono">
                          FROST ID: {frostIdMap[session.id] ? frostIdMap[session.id] : '❌ Not available'}
                        </div>
                        <div className="font-mono text-xs text-gray-500">
                          Available IDs: {Object.keys(frostIdMap).length}
                        </div>
                        {!frostIdMap[session.id] && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                console.log('🔄 Requesting ReadyRound1 by rejoining session...');
                                // Try to rejoin the session to trigger ReadyRound1 if all participants are present
                                if (wsConnection && authState.isAuthenticated) {
                                  const message = {
                                    type: 'JoinSession',
                                    payload: { session: session.id }
                                  };
                                  console.log('📤 Sending JoinSession to refresh state:', message);
                                  wsConnection.send(JSON.stringify(message));
                                }
                              }}
                              className="text-xs"
                            >
                              🔄 Refresh Session
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Button */}
                    <div className="ml-4 flex gap-2">
                      {session.status === 'round1' && !frostIdMap[session.id] && (
                        <Button
                          onClick={() => {
                            console.log('🔄 Requesting ReadyRound1 by rejoining session...');
                            if (wsConnection && authState.isAuthenticated) {
                              const message = {
                                type: 'JoinSession',
                                payload: { session: session.id }
                              };
                              console.log('📤 Sending JoinSession to refresh state:', message);
                              wsConnection.send(JSON.stringify(message));
                            }
                          }}
                          className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-6 py-2"
                        >
                          🔄 Refresh Session
                        </Button>
                      )}
                      
                      {session.status === 'round1' && frostIdMap[session.id] && (
                        <Button
                          onClick={() => submitRound1(session)}
                          disabled={isSubmittingRound1 || !authState.isAuthenticated}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 disabled:opacity-50"
                        >
                          {isSubmittingRound1 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Submitting...
                            </div>
                          ) : (
                            <>🔐 Submit Commitment</>
                          )}
                        </Button>
                      )}
                      
                      {session.status === 'round2' && (
                        <Button
                          onClick={() => submitRound2(session)}
                          disabled={isSubmittingRound2 || !authState.isAuthenticated}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2"
                        >
                          {isSubmittingRound2 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Submitting...
                            </div>
                          ) : (
                            <>🔒 Submit Encrypted Share</>
                          )}
                        </Button>
                      )}
                      
                      {session.status === 'finalizing' && (
                        <Button
                          onClick={() => submitFinalize(session)}
                          disabled={isSubmittingFinalize || !authState.isAuthenticated}
                          className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-6 py-2"
                        >
                          {isSubmittingFinalize ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Finalizing...
                            </div>
                          ) : (
                            <>🎯 Finalize Submit</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                  <span>💡</span>
                  <span><strong>Important:</strong> Complete your submissions promptly to avoid delaying other participants. The ceremony requires all participants to submit before proceeding to the next round.</span>
                </div>
              </div>
              
              <details className="text-sm">
                <summary className="cursor-pointer text-blue-700 dark:text-blue-300 font-medium hover:text-blue-900 dark:hover:text-blue-100">
                  📖 How DKG Ceremony Works (3 rounds)
                </summary>
                <div className="mt-2 pl-4 space-y-2 text-gray-600 dark:text-gray-400">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">1.</span>
                    <div>
                      <strong className="text-blue-600 dark:text-blue-400">Round 1 - Commitments:</strong>
                      <p>Each participant generates secret commitments and shares them with everyone. This establishes the foundation for the distributed key.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-500 font-bold">2.</span>
                    <div>
                      <strong className="text-purple-600 dark:text-purple-400">Round 2 - Secret Shares:</strong>
                      <p>Each participant creates encrypted secret shares for every other participant. These shares are essential for threshold signing.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold">3.</span>
                    <div>
                      <strong className="text-orange-600 dark:text-orange-400">Finalization - Group Key:</strong>
                      <p>All participants combine their shares to compute the final group verification key. This completes the distributed key generation.</p>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-green-700 dark:text-green-300">
                    <strong>Result:</strong> A distributed threshold signature scheme where any {sessions.find(s => ['round1', 'round2', 'finalizing'].includes(s.status))?.minSigners || 'M'} out of {sessions.find(s => ['round1', 'round2', 'finalizing'].includes(s.status))?.maxSigners || 'N'} participants can create valid signatures.
                  </div>
                </div>
              </details>
            </div>
          </div>
        </Card>
      )}

      {/* Success Message */}
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
        <div className="space-y-6">
          {/* Sessions Created by Me */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                <span className="mr-2">👑</span>
                Sessions Created by Me
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {sessions.filter(s => s.myRole === 'creator' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).length} active sessions
              </div>
            </div>
            
            {sessions.filter(s => s.myRole === 'creator' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-600 dark:text-gray-400">No active sessions created by you</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Create a session to start coordinating DKG ceremonies
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.filter(s => s.myRole === 'creator' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).map((session) => (
                  <div key={session.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Session {session.id}</h4>
                          <Badge className={getStatusColor(session.status)}>
                            {getStatusText(session.status)}
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Creator</Badge>
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
                        {session.status === 'waiting' && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                            {session.currentParticipants < session.maxSigners ? (
                              <span>🔄 Waiting for {session.maxSigners - session.currentParticipants} more participant(s)</span>
                            ) : (
                              <span>🚀 DKG will start automatically when all join</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Sessions Joined as Participant */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                <span className="mr-2">🤝</span>
                Sessions Joined as Participant
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {sessions.filter(s => s.myRole === 'participant' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).length} joined sessions
              </div>
            </div>
            
            {sessions.filter(s => s.myRole === 'participant' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-600 dark:text-gray-400">No sessions joined as participant</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Join an existing session to participate in DKG ceremonies
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.filter(s => s.myRole === 'participant' && ['waiting', 'round1', 'round2', 'finalizing'].includes(s.status)).map((session) => (
                  <div key={session.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Session {session.id}</h4>
                          <Badge className={getStatusColor(session.status)}>
                            {getStatusText(session.status)}
                          </Badge>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Participant</Badge>
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
                            <span className="font-medium">Joined:</span><br />
                            {session.createdAt.toLocaleDateString()}
                          </div>
                        </div>
                        
                        {/* Additional info for joined sessions */}
                        {session.status === 'waiting' && (
                          <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-sm">
                            <span className="text-amber-800 dark:text-amber-300">
                              ⏳ Waiting for {session.maxSigners - session.currentParticipants} more participant(s) before DKG rounds can begin
                            </span>
                          </div>
                        )}
                        
                        {/* DKG Round Action Buttons */}
                        {session.status === 'round1' && (
                          <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/30 rounded">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-blue-800 dark:text-blue-300">
                                <span className="font-medium">🎯 Round 1: Submit Commitments</span>
                                <p className="text-xs mt-1">Generate and submit your commitment package for the DKG ceremony</p>
                                <p className="text-xs mt-1 text-amber-600 dark:text-amber-400 font-medium">
                                  ⚠️ Frontend UI is for monitoring only. Use Rust CLI for actual participation.
                                </p>
                                {!frostIdMap[session.id] && (
                                  <p className="text-xs mt-1 text-orange-600 dark:text-orange-400 font-medium">
                                    ⚠️ FROST ID missing - Click refresh to sync with server
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {!frostIdMap[session.id] && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      console.log('🔄 Requesting ReadyRound1 by rejoining session...');
                                      if (wsConnection && authState.isAuthenticated) {
                                        const message = {
                                          type: 'JoinSession',
                                          payload: { session: session.id }
                                        };
                                        console.log('📤 Sending JoinSession to refresh state:', message);
                                        wsConnection.send(JSON.stringify(message));
                                      }
                                    }}
                                    className="bg-orange-600 hover:bg-orange-700"
                                  >
                                    🔄 Refresh
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => submitRound1(session)}
                                  disabled={isSubmittingRound1 || !authState.isAuthenticated || !frostIdMap[session.id]}
                                  className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50"
                                >
                                  {isSubmittingRound1 ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      Checking...
                                    </div>
                                  ) : (
                                    'View Requirements'
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {session.status === 'round2' && (
                          <div className="mt-3 p-3 bg-purple-100 dark:bg-purple-900/30 rounded">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-purple-800 dark:text-purple-300">
                                <span className="font-medium">🔒 Round 2: Submit Secret Shares</span>
                                <p className="text-xs mt-1">Generate encrypted secret shares for each participant</p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => submitRound2(session)}
                                disabled={isSubmittingRound2 || !authState.isAuthenticated}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                {isSubmittingRound2 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Submitting...
                                  </div>
                                ) : (
                                  'Submit Round 2'
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {session.status === 'finalizing' && (
                          <div className="mt-3 p-3 bg-orange-100 dark:bg-orange-900/30 rounded">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-orange-800 dark:text-orange-300">
                                <span className="font-medium">🎯 Finalize: Generate Group Key</span>
                                <p className="text-xs mt-1">Compute and submit the final group verification key</p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => submitFinalize(session)}
                                disabled={isSubmittingFinalize || !authState.isAuthenticated}
                                className="bg-orange-600 hover:bg-orange-700"
                              >
                                {isSubmittingFinalize ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Finalizing...
                                  </div>
                                ) : (
                                  'Submit Finalize'
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {session.status === 'completed' && (
                          <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/30 rounded">
                            <div className="text-sm text-green-800 dark:text-green-300">
                              <span className="font-medium">✅ DKG Complete!</span>
                              <p className="text-xs mt-1">Distributed keys generated successfully. Download your key shares below.</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSession(session)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
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
              <div className="flex gap-4 mb-6">
                <Input
                  placeholder="Session ID provided by creator (e.g., e2bb7be0-f196-4ce5-8a48-f9e892b6d88b)"
                  value={sessionToJoin}
                  onChange={(e) => setSessionToJoin(e.target.value)}
                  className="flex-1 font-mono text-sm"
                  disabled={isJoiningSession}
                />
                <Button 
                  onClick={joinDKGSession}
                  disabled={!sessionToJoin || isJoiningSession || !authState.isAuthenticated}
                  className="min-w-[140px]"
                >
                  {isJoiningSession ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Joining...
                    </div>
                  ) : (
                    'Join Session'
                  )}
                </Button>
              </div>

              {/* Prerequisites Section */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">✅ Prerequisites</h4>
                <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <p className={authState.isAuthenticated ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {authState.isAuthenticated ? '✅' : '❌'} Authentication: {authState.isAuthenticated ? 'Completed' : 'Required'}
                  </p>
                  <p className={connectionStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {connectionStatus === 'connected' ? '✅' : '❌'} Server Connection: {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
                  </p>
                  <p>• Your public key must be registered in the session by the creator</p>
                  <p>• You must be one of the designated participants</p>
                </div>
              </div>
              
              {/* What Happens After Joining */}
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2 text-amber-800 dark:text-amber-200">🔄 What Happens After Joining</h4>
                <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <p>1. <strong>Waiting Phase:</strong> You'll wait for all other participants to join</p>
                  <p>2. <strong>Round 1:</strong> DKG starts automatically when everyone is present</p>
                  <p>3. <strong>Round 2:</strong> Secret sharing phase (encrypted)</p>
                  <p>4. <strong>Finalization:</strong> Key generation completes</p>
                  <p className="text-amber-700 dark:text-amber-300 font-medium">
                    ⚠️ <strong>Important:</strong> DKG rounds cannot start until ALL participants have joined the session
                  </p>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
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
            <Card className="p-6">
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">No DKG sessions yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Create or join a session to get started
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Sessions Created by Me - History */}
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    <span className="mr-2">👑</span>
                    Sessions Created by Me
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {sessions.filter(s => s.myRole === 'creator').length} total sessions
                  </div>
                </div>
                
                {sessions.filter(s => s.myRole === 'creator').length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-600 dark:text-gray-400">No sessions created by you</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.filter(s => s.myRole === 'creator').map((session) => (
                      <div key={session.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-gray-100">Session {session.id}</h4>
                              <Badge className={getStatusColor(session.status)}>
                                {getStatusText(session.status)}
                              </Badge>
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Creator</Badge>
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
                              <div className="flex gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => downloadGroupInfo(session)}
                                  disabled={!session.groupVerifyingKey}
                                  title="Download group verification key"
                                >
                                  📁 Group
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => downloadKeyShare(session)}
                                  disabled={!session.groupVerifyingKey}
                                  title="Download your key share"
                                >
                                  🔑 Share
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Sessions Joined as Participant - History */}
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    <span className="mr-2">🤝</span>
                    Sessions Joined as Participant
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {sessions.filter(s => s.myRole === 'participant').length} total sessions
                  </div>
                </div>
                
                {sessions.filter(s => s.myRole === 'participant').length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-600 dark:text-gray-400">No sessions joined as participant</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.filter(s => s.myRole === 'participant').map((session) => (
                      <div key={session.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-gray-100">Session {session.id}</h4>
                              <Badge className={getStatusColor(session.status)}>
                                {getStatusText(session.status)}
                              </Badge>
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Participant</Badge>
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
                                <span className="font-medium">Joined:</span><br />
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
                              <div className="flex gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => downloadGroupInfo(session)}
                                  disabled={!session.groupVerifyingKey}
                                  title="Download group verification key"
                                >
                                  📁 Group
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => downloadKeyShare(session)}
                                  disabled={!session.groupVerifyingKey}
                                  title="Download your key share"
                                >
                                  🔑 Share
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
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
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => downloadGroupInfo(selectedSession)}
                      disabled={!selectedSession.groupVerifyingKey}
                    >
                      📁 Download Group Info (group.json)
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => downloadKeyShare(selectedSession)}
                      disabled={!selectedSession.groupVerifyingKey}
                    >
                      🔑 Download Key Share (share_{selectedSession.id.slice(0, 8)}.json)
                    </Button>
                    {selectedSession.groupVerifyingKey && (
                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Group Verification Key</h4>
                        <div className="bg-white dark:bg-gray-800 p-2 rounded border">
                          <span className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all select-all cursor-pointer">
                            {selectedSession.groupVerifyingKey}
                          </span>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Use this key for FROST threshold signature verification
                        </p>
                      </div>
                    )}
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

      {/* Commitment Modal */}
      <Dialog open={showCommitmentModal} onOpenChange={setShowCommitmentModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Round 1 Commitment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {selectedSessionForCommitment && (
                  <>Session ID: <span className="font-mono">{selectedSessionForCommitment.id}</span></>
                )}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {selectedSessionForCommitment && frostIdMap[selectedSessionForCommitment.id] && (
                  <>FROST ID: <span className="font-mono">{frostIdMap[selectedSessionForCommitment.id]}</span></>
                )}
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">
                  Commitment Package (pkg_bincode_hex)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCommitmentInput(generateMockCommitment())}
                  className="text-xs"
                >
                  Show Placeholder
                </Button>
              </div>
              <textarea
                value={commitmentInput}
                onChange={(e) => setCommitmentInput(e.target.value)}
                placeholder="Paste your FROST Round 1 package hex data here..."
                className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
              <div className="text-xs text-gray-500 mt-1 space-y-1">
                <p>This requires a real FROST Round 1 package generated by the cryptographic library</p>
                <p><strong>To generate real commitment:</strong> Use <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">cargo run -p dkg</code> in the frost-dkg directory</p>
                <p><strong>Browser limitation:</strong> FROST cryptography cannot be performed in JavaScript</p>
              </div>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Real DKG Participation Required</p>
                  <p>This UI is for monitoring only. To actually participate in DKG:</p>
                  <ol className="list-decimal list-inside mt-1 space-y-1 text-xs">
                    <li>Navigate to the <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">frost-dkg</code> directory</li>
                    <li>Run <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">cargo run -p dkg</code></li>
                    <li>Follow the CLI prompts to generate real commitment packages</li>
                    <li>Copy the generated hex data to this field for testing the submission flow</li>
                  </ol>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> The commitment will be automatically signed using your connected MetaMask wallet when you submit.
              </p>
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setShowCommitmentModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={submitCommitment}
                disabled={isSubmittingRound1 || !commitmentInput.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSubmittingRound1 ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting...
                  </div>
                ) : (
                  'Submit Commitment'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
}