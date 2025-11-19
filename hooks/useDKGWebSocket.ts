'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSignMessage } from 'wagmi';
import { hexToBytes } from 'viem';
import { keccak256 } from 'js-sha3';
import { DKGErrorHandler, DKGErrorType } from '@/lib/dkg-error-handler';

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
  _serverMissing?: boolean; // Flag when session exists locally but not on server
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
  const [joinedSessions, setJoinedSessions] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isJoiningSession, setIsJoiningSession] = useState(false);
  const [justJoinedSession, setJustJoinedSession] = useState('');
  const [hasShownJoinSuccess, setHasShownJoinSuccess] = useState(false);
  const joinSessionRef = useRef('');
  const [pendingSessionParams, setPendingSessionParams] = useState<{minSigners: number; maxSigners: number; participants: any[]; automationMode?: 'manual' | 'automatic'} | null>(null);
  const pendingSessionParamsRef = useRef<{minSigners: number; maxSigners: number; participants: any[]; automationMode?: 'manual' | 'automatic'} | null>(null);



  const { signMessageAsync } = useSignMessage();

  // Helper function to save sessions to localStorage
  const saveSessionsToStorage = useCallback((sessionsToSave: DKGSession[]) => {
    localStorage.setItem('dkg-sessions', JSON.stringify(sessionsToSave));
  }, []);

  // Helper functions for joined sessions
  const saveJoinedSessionsToStorage = useCallback((joinedSessionsSet: Set<string>) => {
    localStorage.setItem('dkg-joined-sessions', JSON.stringify(Array.from(joinedSessionsSet)));
  }, []);

  const addJoinedSession = useCallback((sessionId: string) => {
    setJoinedSessions(prev => {
      const newSet = new Set(prev);
      newSet.add(sessionId);
      saveJoinedSessionsToStorage(newSet);
      return newSet;
    });
  }, [saveJoinedSessionsToStorage]);

  // Load sessions and joined sessions from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem('dkg-sessions');
    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions);
        const migratedSessions = parsedSessions
          .map((session: any) => ({
            ...session,
            createdAt: new Date(session.createdAt),
            automationMode: session.automationMode || 'manual', // Ensure automation mode exists
            creator: session.creator, // Keep creator field from storage - crucial for role assignment
            myRole: undefined // Clear myRole on load - will be reassigned based on current wallet
          }))
          .filter((session: any) => session.minSigners && session.maxSigners);
        
        console.log('📦 Loaded sessions from storage:', migratedSessions.map((s: any) => ({ id: s.id.slice(0, 8), creator: s.creator?.slice(0, 8) })));
        setSessions(migratedSessions);
      } catch (error) {
        console.error('Error loading sessions from localStorage:', error);
        localStorage.removeItem('dkg-sessions');
        setSessions([]);
      }
    }

    // Load joined sessions
    const savedJoinedSessions = localStorage.getItem('dkg-joined-sessions');
    if (savedJoinedSessions) {
      try {
        const parsedJoinedSessions = JSON.parse(savedJoinedSessions);
        console.log('📦 Loaded joined sessions:', parsedJoinedSessions);
        setJoinedSessions(new Set(parsedJoinedSessions));
      } catch (error) {
        console.error('Error loading joined sessions from localStorage:', error);
        localStorage.removeItem('dkg-joined-sessions');
        setJoinedSessions(new Set());
      }
    }
  }, []);

  // Track if we've refreshed sessions after authentication
  const hasRefreshedRef = useRef(false);

  // DISABLED: Session refresh after authentication to prevent auto-joining
  // The issue was that authentication was triggering JoinSession messages
  // Users should only join sessions when they explicitly choose to join
  useEffect(() => {
    console.log('🔄 Authentication state changed, but NOT auto-refreshing sessions');
    
    // Reset refresh flag when connection is lost
    if (!wsConnection || !authState.isAuthenticated) {
      hasRefreshedRef.current = false;
    }
  }, [wsConnection, authState.isAuthenticated, sessions.length]);

  // Update session roles when address, joined sessions, or sessions change
  useEffect(() => {
    if (!address) {
      console.log('⚠️ No address available for role evaluation');
      return;
    }
    
    console.log('🔍 Role evaluation check:', {
      address,
      sessionsCount: sessions.length,
      joinedSessionsCount: joinedSessions.size,
      sessions: sessions.map(s => ({ id: s.id.slice(0, 8), creator: s.creator?.slice(0, 8), myRole: s.myRole }))
    });
    
    if (sessions.length === 0) {
      console.log('ℹ️ No sessions to evaluate roles for');
      return;
    }
    
    if (address && sessions.length > 0) {
      console.log('🔄 Evaluating session roles for address:', address);
      console.log('📋 Sessions:', sessions.map(s => ({ id: s.id.slice(0, 8), creator: s.creator?.slice(0, 8), myRole: s.myRole })));
      console.log('📦 Joined sessions:', Array.from(joinedSessions));
      
      // Store address in a const to help TypeScript narrow the type in the callback
      // Convert to string first to handle viem's Address type
      const userAddress = String(address).toLowerCase();
      
      // Check if any session needs role assignment
      const needsRoleUpdate = sessions.some(session => {
        const isCreator = session.creator?.toLowerCase() === userAddress;
        const hasJoined = joinedSessions.has(session.id);
        
        // Check if user's public key is in the participants roster
        const isInRoster = session.participants?.some((p: any) => 
          p.publicKey?.toLowerCase() === authState.publicKeyHex?.toLowerCase()
        ) || false;
        
        const isParticipant = hasJoined || isInRoster;
        const shouldHaveRole = isCreator || isParticipant;
        const currentRole = session.myRole;
        
        console.log(`  🔍 Checking session ${session.id.slice(0, 8)}:`, {
          creator: session.creator?.slice(0, 10),
          address: String(address).slice(0, 10),
          isCreator,
          hasJoined,
          isInRoster,
          isParticipant,
          currentRole,
          shouldHaveRole,
          participantsCount: session.participants?.length || 0
        });
        
        // Need update if should have role but doesn't, or has wrong role
        if (shouldHaveRole && !currentRole) {
          console.log(`    → Needs update: should have role but doesn't`);
          return true;
        }
        if (isCreator && currentRole !== 'creator') {
          console.log(`    → Needs update: is creator but role is ${currentRole}`);
          return true;
        }
        if (isParticipant && !isCreator && currentRole !== 'participant') {
          console.log(`    → Needs update: is participant but role is ${currentRole}`);
          return true;
        }
        if (!shouldHaveRole && currentRole) {
          console.log(`    → Needs update: shouldn't have role but has ${currentRole}`);
          return true;
        }
        
        return false;
      });
      
      if (!needsRoleUpdate) {
        console.log('✅ All session roles already correct, skipping update');
        return;
      }
      
      // Assign myRole if user is creator, has joined, OR is in the participants roster
      const updatedSessions = sessions.map(session => {
        const isCreator = session.creator?.toLowerCase() === userAddress;
        const hasJoined = joinedSessions.has(session.id);
        
        // Check if user's public key is in the participants roster
        const isInRoster = session.participants?.some((p: any) => 
          p.publicKey?.toLowerCase() === authState.publicKeyHex?.toLowerCase()
        ) || false;
        
        const isParticipant = hasJoined || isInRoster;
        
        if (isCreator) {
          return { ...session, myRole: 'creator' as const };
        } else if (isParticipant) {
          return { ...session, myRole: 'participant' as const };
        } else {
          // User has no role in this session - remove myRole to hide it
          const { myRole, ...sessionWithoutRole } = session;
          return { ...sessionWithoutRole, myRole: undefined };
        }
      });
      
      console.log('✅ Updated session roles:', updatedSessions.map(s => ({ id: s.id.slice(0, 8), creator: s.creator?.slice(0, 8), myRole: s.myRole })));
      setSessions(updatedSessions);
      // Don't save immediately - let the debounced save effect handle it
    }
  }, [address, joinedSessions, sessions, authState.publicKeyHex]);
  
  // Debug: Log when sessions or address changes
  useEffect(() => {
    console.log('📊 State Update:', {
      address,
      sessionsCount: sessions.length,
      joinedSessionsCount: joinedSessions.size,
      isAuthenticated: authState.isAuthenticated,
      hasPublicKey: !!authState.publicKeyHex
    });
  }, [address, sessions.length, joinedSessions.size, authState.isAuthenticated, authState.publicKeyHex]);

  // Save sessions to localStorage whenever sessions change (with debouncing to avoid excessive saves)
  useEffect(() => {
    if (sessions.length > 0) {
      const timeoutId = setTimeout(() => {
        saveSessionsToStorage(sessions);
      }, 500); // Debounce saves by 500ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [sessions, saveSessionsToStorage]);


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
        // Auto-authenticate will happen in the useEffect below
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
        
        // Automatically request session list after authentication
        if (wsConnection) {
          console.log('📋 Authenticated - requesting pending sessions list');
          const listMessage = { type: 'ListPendingDKGSessions' };
          wsConnection.send(JSON.stringify(listMessage));
        }
        break;
        
      case 'SessionCreated':
        // Use ref as fallback if state is null
        const paramsToUse = pendingSessionParams || pendingSessionParamsRef.current;
        
        console.log('🎉 Session created! Current address:', address);
        
        const newSession: DKGSession = {
          id: message.payload.session,
          creator: address!,
          minSigners: paramsToUse?.minSigners || 2,
          maxSigners: paramsToUse?.maxSigners || 3,
          currentParticipants: 1, // Creator is the first participant
          status: 'waiting',
          groupId: `group_${Date.now()}`,
          topic: `topic_${Date.now()}`,
          createdAt: new Date(),
          myRole: 'creator',
          description: 'DKG Key Generation Ceremony',
          participants: paramsToUse?.participants || [],
          roster: [],
          automationMode: paramsToUse?.automationMode || 'manual'
        };
        console.log('💾 Adding new session to state:', {
          id: newSession.id.slice(0, 8),
          creator: newSession.creator,
          myRole: newSession.myRole
        });
        
        setSessions(prev => {
          const updated = [...prev, newSession];
          console.log('📋 Updated sessions:', updated.map(s => ({ id: s.id.slice(0, 8), creator: s.creator?.slice(0, 8), myRole: s.myRole })));
          return updated;
        });
        
        setPendingSessionParams(null); // Clear pending params
        pendingSessionParamsRef.current = null; // Clear ref too
        
        // Creator automatically joins their own session
        addJoinedSession(newSession.id);
        
        console.log('✅ Session added and joined');
        
        if (setIsCreatingSession) setIsCreatingSession(false);
        if (setNewlyCreatedSession) setNewlyCreatedSession(newSession);
        
        // Immediately request updated session list so others can see it
        if (wsConnection) {
          const listMessage = { type: 'ListPendingDKGSessions' };
          wsConnection.send(JSON.stringify(listMessage));
        }
        break;
        
      case 'Error':
        const serverError = message.payload?.message || 'Unknown server error';
        const parsedError = DKGErrorHandler.parseError(serverError, {
          sessionId: justJoinedSession || 'unknown',
          phase: 'server_response'
        });
        
        DKGErrorHandler.logError(parsedError, 'Server Message');
        const formattedError = DKGErrorHandler.formatErrorForUser(parsedError);
        
        setError(`${formattedError.title}: ${formattedError.message}`);
        setIsJoiningSession(false);
        setSuccessMessage('');
        break;
      
      case 'Info':
        if (message.payload?.message) {
          const infoMessage = message.payload.message;
          console.log('📢 Info message received:', infoMessage);
          
          // Check for session status updates in info messages
          if (infoMessage.includes('ready for round 1') || infoMessage.includes('starting round 1')) {
            const sessionIdMatch = infoMessage.match(/session[:\s]+([a-f0-9-]+)/i);
            if (sessionIdMatch) {
              const sessionId = sessionIdMatch[1];
              setSessions(prev => prev.map(session => 
                session.id === sessionId ? {
                  ...session,
                  status: 'round1' as const
                } : session
              ));
            }
          }
          
          const joinMatch = infoMessage.match(/(?:joined|participant)\s*(\d+)(?:\s*of\s*|\s*\/\s*)(\d+)|(\d+)\/(\d+)/);
          
          if (joinMatch) {
            console.log('📊 Participant count match found:', {
              fullMessage: infoMessage,
              match: joinMatch,
              extracted: `${joinMatch[1] || joinMatch[3]}/${joinMatch[2] || joinMatch[4]}`
            });
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
              
              // Save updated sessions to localStorage
              const updatedSessions = sessions.map(session => 
                session.id === targetSessionId ? {
                  ...session,
                  currentParticipants: current,
                  maxSigners: total
                } : session
              );
              saveSessionsToStorage(updatedSessions);
            } else {
              console.log('⚠️ Could not determine session ID for participant count update');
            }
            
            const isJoinResponse = (isJoiningSession || (justJoinedSession && justJoinedSession.length > 0) || (joinSessionRef.current && joinSessionRef.current.length > 0)) && !hasShownJoinSuccess;
            
            if (isJoinResponse) {
              setError('');
              setSuccessMessage(`🎉 Successfully joined session! Waiting for ${total - current} more participant(s) to join before starting DKG rounds.`);
              setIsJoiningSession(false);
              setHasShownJoinSuccess(true);
              
              // Track that user has joined this session
              if (targetSessionId) {
                console.log(`📝 Adding session ${targetSessionId} to joined sessions list`);
                addJoinedSession(targetSessionId);
              }
              
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
        
        console.log('🚀 ReadyRound1 received:', {
          sessionId,
          myIdHex,
          rosterLength: message.payload.roster ? message.payload.roster.length : 'no roster',
          roster: message.payload.roster
        });
        
        if (myIdHex && typeof myIdHex === 'string' && myIdHex.length > 0) {
          setFrostIdMap(prev => ({
            ...prev,
            [sessionId]: myIdHex
          }));
          
          setSessions(prev => prev.map(session => {
            if (session.id !== sessionId) return session;
            
            const rosterLength = message.payload.roster ? message.payload.roster.length : session.currentParticipants;
            const shouldStartRound1 = rosterLength >= session.maxSigners;
            
            console.log(`🔍 Session ${sessionId} readiness check:`, {
              rosterLength,
              maxSigners: session.maxSigners,
              currentParticipants: session.currentParticipants,
              shouldStartRound1
            });
            
            return {
              ...session,
              status: shouldStartRound1 ? 'round1' as const : session.status,
              roster: message.payload.roster || session.roster,
              currentParticipants: message.payload.roster ? message.payload.roster.length : session.currentParticipants
            };
          }));
          
          setSuccessMessage(`🚀 All participants have joined! DKG Round 1 (Commitments) is now starting...`);
        }
        break;

      case 'ReadyRound2':
        if (message.payload?.session) {
          const sessionId = message.payload.session;
          setSessions(prev => prev.map(session => 
            session.id === sessionId ? {
              ...session,
              status: 'round2' as const
            } : session
          ));
          console.log(`🔄 Session ${sessionId} moved to Round 2`);
        }
        break;

      case 'ReadyFinalize':
        if (message.payload?.session) {
          const sessionId = message.payload.session;
          setSessions(prev => prev.map(session => 
            session.id === sessionId ? {
              ...session,
              status: 'finalizing' as const
            } : session
          ));
          console.log(`🔄 Session ${sessionId} moved to Finalization`);
        }
        break;

      case 'SessionComplete':
        if (message.payload?.session) {
          const sessionId = message.payload.session;
          setSessions(prev => prev.map(session => 
            session.id === sessionId ? {
              ...session,
              status: 'completed' as const,
              groupVerifyingKey: message.payload.group_verifying_key || session.groupVerifyingKey
            } : session
          ));
          console.log(`✅ Session ${sessionId} completed successfully`);
        }
        break;

      case 'SessionFailed':
        if (message.payload?.session) {
          const sessionId = message.payload.session;
          setSessions(prev => prev.map(session => 
            session.id === sessionId ? {
              ...session,
              status: 'failed' as const
            } : session
          ));
          console.log(`❌ Session ${sessionId} failed`);
        }
        break;

      case 'PendingDKGSessions':
        // Server sends list of available DKG sessions
        if (message.payload?.sessions && Array.isArray(message.payload.sessions)) {
          console.log('📋 Received pending DKG sessions from server:', message.payload.sessions.length);
          console.log('📋 Raw server sessions:', message.payload.sessions);
          console.log('📋 Server session IDs:', message.payload.sessions.map((s: any) => s.session));
          
          // Update sessions - merge with existing to keep local state
          setSessions(prev => {
            console.log('📦 Merging server sessions. Current local sessions:', prev.length);
            console.log('📦 Local sessions before merge:', prev.map(s => ({
              id: s.id.slice(0, 8),
              creator: s.creator?.slice(0, 10),
              myRole: s.myRole
            })));
            console.log('📦 Joined sessions Set has:', Array.from(joinedSessions));
            
            // Merge server sessions with local sessions
            const serverSessions = message.payload.sessions.map((serverSession: any) => {
              // Check if we already have this session locally (use prev, not sessions)
              const existingSession = prev.find(s => s.id === serverSession.session);
              
              console.log('  Processing server session:', {
                id: serverSession.session?.slice(0, 8),
                serverCreator: serverSession.creator,
                existingCreator: existingSession?.creator?.slice(0, 10),
                existingRole: existingSession?.myRole
              });
              
              // IMPORTANT: Prioritize existing data from localStorage over server
              // The server (fserver) doesn't track:
              // - creator: not tracked by server
              // - participants with public keys: server only has numeric UIDs [1,2,3]
              // - roster: only available after Round 1 starts
              const merged = {
                id: serverSession.session,
                creator: existingSession?.creator || serverSession.creator || 'unknown',
                minSigners: serverSession.min_signers,
                maxSigners: serverSession.max_signers,
                currentParticipants: serverSession.joined?.length || 0,
                status: existingSession?.status || 'waiting' as const,
                groupId: serverSession.group_id,
                topic: serverSession.topic || `topic_${serverSession.session}`,
                createdAt: existingSession?.createdAt || new Date(serverSession.created_at),
                myRole: existingSession?.myRole, // Preserve from localStorage
                description: existingSession?.description || 'DKG Key Generation Ceremony',
                // CRITICAL: Preserve local participants array with public keys
                // Server only provides numeric UIDs [1,2,3], not {uid, publicKey} objects
                participants: existingSession?.participants || serverSession.participants || [],
                roster: existingSession?.roster || [],
                groupVerifyingKey: existingSession?.groupVerifyingKey,
                automationMode: existingSession?.automationMode || 'manual' as const,
              };
              
              console.log('  ✓ Merged session:', {
                id: merged.id.slice(0, 8),
                creator: merged.creator?.slice(0, 10),
                myRole: merged.myRole,
                wasExisting: !!existingSession,
                participantsCount: merged.participants?.length,
                participantsType: Array.isArray(merged.participants) && merged.participants.length > 0 
                  ? (typeof merged.participants[0] === 'object' ? 'objects' : 'numbers')
                  : 'empty'
              });
              
              return merged;
            });
            
            // Keep sessions from localStorage that weren't returned by server
            // This includes:
            // 1. Sessions the user joined but server lost (e.g., server restart)
            // 2. Sessions that are in-progress or completed
            const localOnlySessions = prev.filter(s => 
              !serverSessions.find((ss: any) => ss.id === s.id)
            );
            
            console.log('⚠️  Sessions in localStorage but NOT on server:', {
              count: localOnlySessions.length,
              sessions: localOnlySessions.map(s => ({
                id: s.id.slice(0, 8),
                myRole: s.myRole,
                status: s.status,
                inJoinedSet: joinedSessions.has(s.id)
              }))
            });
            
            // Mark local-only sessions as potentially stale
            const markedLocalSessions = localOnlySessions.map(s => ({
              ...s,
              _serverMissing: true // Flag to indicate server doesn't have this session
            }));
            
            console.log('✅ Final merge:', {
              localOnly: markedLocalSessions.length,
              fromServer: serverSessions.length,
              total: markedLocalSessions.length + serverSessions.length,
              finalIds: [...markedLocalSessions, ...serverSessions].map(s => s.id.slice(0, 8))
            });
            
            return [...markedLocalSessions, ...serverSessions];
          });
        }
        break;

      case 'Round1All':
        // Server sends all Round 1 packages after everyone has submitted
        // Format: { session, packages: [[id_hex, pkg_hex, sig_hex], ...] }
        if (message.payload?.session && message.payload?.packages) {
          console.log('📦 Round1All received:', {
            session: message.payload.session,
            packageCount: message.payload.packages.length
          });
          // This will be handled by useDKGRounds hook through external handler
          // For now, just log it - the actual handling happens in the DKG page component
        }
        break;

      case 'Round2All':
        // Server sends encrypted Round 2 packages for this participant
        // Format: { session, packages: [[from_id_hex, eph_pub_hex, nonce_hex, ct_hex, sig_hex], ...] }
        if (message.payload?.session && message.payload?.packages) {
          console.log('📦 Round2All received:', {
            session: message.payload.session,
            packageCount: message.payload.packages.length
          });
          // This will be handled by useDKGRounds hook through external handler
          // The actual decryption happens in the DKG page component
        }
        break;

      case 'Finalized':
        // Server confirms DKG finalization is complete
        if (message.payload?.session) {
          const sessionId = message.payload.session;
          const groupVkHex = message.payload.group_vk_sec1_hex;
          
          setSessions(prev => prev.map(session => 
            session.id === sessionId ? {
              ...session,
              status: 'completed' as const,
              groupVerifyingKey: groupVkHex
            } : session
          ));
          
          console.log(`✅ DKG ceremony finalized for session ${sessionId}`);
          console.log(`   Group VK: ${groupVkHex?.slice(0, 16)}...`);
          
          setSuccessMessage('🎉 DKG ceremony completed! Group verification key generated.');
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
        
        const parsedError = DKGErrorHandler.parseError('WebSocket connection failed', {
          serverUrl,
          timestamp: new Date().toISOString()
        });
        
        DKGErrorHandler.logError(parsedError, 'WebSocket Connection');
        const formattedError = DKGErrorHandler.formatErrorForUser(parsedError);
        
        setError(`${formattedError.title}: ${formattedError.message}`);
      };
      
      setWsConnection(ws);
    } catch (error) {
      console.error('Failed to connect to DKG server:', error);
      setConnectionStatus('disconnected');
      
      const parsedError = DKGErrorHandler.parseError(error as Error, {
        serverUrl,
        action: 'connect_to_server'
      });
      
      DKGErrorHandler.logError(parsedError, 'Server Connection');
      const formattedError = DKGErrorHandler.formatErrorForUser(parsedError);
      
      setError(`${formattedError.title}: ${formattedError.message}`);
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
      const seedMessage = "Welcome to Tokamak DKG!\n\nSign this message to generate your DKG keypair.\n\nThis is a one-time signature to create your cryptographic identity for threshold signatures.\n\nNo gas fees required.";
      const seedSignature = await signMessageAsync({ message: seedMessage });
      
      // Use the signature as entropy to derive a private key
      const seedBytes = hexToBytes(seedSignature as `0x${string}`);
      const seedHash = keccak256(seedBytes);
      
      // Create key pair from the hash
      const keyPair = ec.keyFromPrivate(seedHash, 'hex');
      
      // Get compressed public key (33 bytes, starts with 02 or 03)
      const publicKeyHex = keyPair.getPublic(true, 'hex');
      const privateKeyHex = keyPair.getPrivate('hex');
      
      console.log('✅ Generated keypair:', { publicKey: publicKeyHex, address });
      console.log('📋 Current sessions before keypair update:', sessions.map(s => ({ id: s.id.slice(0, 8), creator: s.creator?.slice(0, 8), myRole: s.myRole })));
      
      // Update auth state with both public and private keys
      setAuthState(prev => ({ 
        ...prev, 
        publicKeyHex,
        dkgPrivateKey: privateKeyHex,
        dkgPublicKey: publicKeyHex
      }));
      
      console.log('🔑 Keypair updated in authState');
      
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
    
    // After getting keypair, automatically request challenge
    if (keypair && wsConnection) {
      console.log('🔑 Keypair generated, requesting challenge...');
      setTimeout(() => {
        requestChallenge();
      }, 300);
    }
    
    return keypair?.publicKey || '';
  }, [getDeterministicKeypair, wsConnection, requestChallenge]);

  // Authentication
  const authenticate = useCallback(async () => {
    if (!wsConnection || !authState.uuid || !address) return;

    console.log('🔐 Starting authentication process...');
    
    try {
      // 1. Use existing keypair from state (already signed once during "Get My Public Key")
      let pubkeyHex = authState.publicKeyHex;
      let privateKeyHex = authState.dkgPrivateKey;
      
      // Only regenerate if we don't have them in state
      if (!privateKeyHex || !pubkeyHex) {
        console.log('🔄 Keypair not in state, regenerating...');
        const keypair = await getDeterministicKeypair();
        if (!keypair) {
          setError('Failed to generate DKG keypair for authentication');
          return;
        }
        pubkeyHex = keypair.publicKey;
        privateKeyHex = keypair.privateKey;
      } else {
        console.log('✅ Using existing keypair from state (no additional signature needed)');
      }
      
      console.log('🔑 Using keypair:', {
        publicKey: pubkeyHex,
        privateKeyLength: privateKeyHex.length,
        challenge: authState.uuid
      });

      if (!privateKeyHex || !pubkeyHex) {
        setError('Failed to get DKG keypair for signing.');
        return;
      }

      // 2. Parse challenge UUID and get bytes (match server's UUID parsing exactly)
      // The server uses Rust's Uuid::as_bytes() which returns bytes in RFC 4122 order
      const uuid = authState.uuid.replace(/-/g, '');
      
      // Validate UUID format
      if (uuid.length !== 32) {
        setError(`Invalid UUID format: ${authState.uuid} (cleaned: ${uuid})`);
        return;
      }
      
      // Parse UUID bytes in the same order as Rust's Uuid::as_bytes()
      const uuidBytes = new Uint8Array(16);
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
      const signature = keyPair.sign(digestBytes, { canonical: true });
      
      // Ensure canonical signature (low-s form) - this is critical for server verification
      const n = ec.curve.n;
      let s = signature.s;
      if (s.gt(n.shln(1))) {
        s = n.sub(s);
      }
      
      // Convert to compact format (r + s, 64 bytes total)
      // The server expects exactly 64 bytes: 32 bytes r + 32 bytes s
      const r = signature.r.toString(16).padStart(64, '0');
      const sHex = s.toString(16).padStart(64, '0');
      const signatureHex = r + sHex;
      
      // Verify the signature locally before sending
      const normalizedSig = { r: signature.r, s: s };
      const isValid = keyPair.verify(digestBytes, normalizedSig);
      console.log('✅ Local signature verification:', isValid ? 'VALID' : 'INVALID');
      console.log('🔍 Signature format check:', {
        rLength: r.length,
        sLength: sHex.length,
        totalLength: signatureHex.length,
        expectedLength: 128 // 64 bytes = 128 hex chars
      });
      
      if (!isValid) {
        setError('Local signature verification failed. Please try again.');
        return;
      }
      
      // Additional validation: ensure signature is exactly 64 bytes (128 hex chars)
      if (signatureHex.length !== 128) {
        setError(`Invalid signature length: ${signatureHex.length}, expected 128`);
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
        digest: properDigest,
        digestLength: properDigest.length,
        uuidBytesHex: Array.from(uuidBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
        signatureR: r,
        signatureS: sHex
      });

      console.log('📤 Sending authentication request...');
      wsConnection.send(JSON.stringify(message));
    } catch (error) {
      console.error('Authentication failed:', error);
      
      const parsedError = DKGErrorHandler.parseError(error as Error, {
        challenge: authState.uuid,
        publicKey: authState.publicKeyHex?.slice(0, 16) + '...',
        action: 'authenticate'
      });
      
      DKGErrorHandler.logError(parsedError, 'Authentication');
      const formattedError = DKGErrorHandler.formatErrorForUser(parsedError);
      
      setError(`${formattedError.title}: ${formattedError.message}`);
    }
  }, [wsConnection, authState.uuid, authState.publicKeyHex, authState.dkgPrivateKey, address, getDeterministicKeypair]);

  // Auto-authenticate when we have a challenge
  useEffect(() => {
    if (authState.uuid && authState.publicKeyHex && !authState.isAuthenticated && wsConnection) {
      console.log('🔐 Challenge available, auto-authenticating...');
      // Small delay to ensure state is fully updated
      const timer = setTimeout(() => {
        authenticate();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [authState.uuid, authState.publicKeyHex, authState.isAuthenticated, wsConnection, authenticate]);

  // Handle wallet changes - clear auth when address changes
  useEffect(() => {
    // Only clear if we had an authenticated wallet and it changed
    if (authState.publicKeyHex && address) {
      const previousAddress = localStorage.getItem('dkg_last_wallet_address');
      
      if (previousAddress && previousAddress !== address) {
        console.log('🔄 Wallet changed from', previousAddress, 'to', address);
        
        // Clear authentication state
        setAuthState({
          isAuthenticated: false,
          challenge: '',
          uuid: '',
          publicKeyHex: '',
          dkgPrivateKey: '',
          userId: null
        });
        
        // Clear stored keypairs
        localStorage.removeItem('dkg_last_public_key');
        localStorage.removeItem('dkg_last_private_key');
        
        // Force re-evaluation of session roles by reloading from storage
        const savedSessions = localStorage.getItem('dkg-sessions');
        if (savedSessions) {
          try {
            const parsedSessions = JSON.parse(savedSessions);
            const reloadedSessions = parsedSessions.map((session: any) => ({
              ...session,
              createdAt: new Date(session.createdAt),
              myRole: undefined // Clear myRole, will be reassigned based on new address
            }));
            setSessions(reloadedSessions);
            console.log('🔄 Reloaded sessions for new wallet');
          } catch (error) {
            console.error('Failed to reload sessions:', error);
          }
        }
        
        setSuccessMessage('Wallet changed. Please sign with your new wallet.');
      }
      
      // Store current address
      localStorage.setItem('dkg_last_wallet_address', address);
    }
  }, [address, authState.publicKeyHex]);

  // Join session
  const joinSession = useCallback((sessionId: string) => {
    if (!wsConnection) {
      console.error('❌ Cannot join session: No WebSocket connection');
      setError('Not connected to DKG server. Please connect first.');
      return;
    }
    
    if (!sessionId || sessionId.trim() === '') {
      console.error('❌ Cannot join session: No session ID provided');
      setError('Please provide a valid session ID');
      return;
    }

    if (!authState.isAuthenticated) {
      console.error('❌ Cannot join session: Not authenticated');
      setError('You must be authenticated before joining a session. Please click "Get My Public Key" first.');
      return;
    }

    if (!authState.publicKeyHex) {
      console.error('❌ Cannot join session: No public key');
      setError('Public key not found. Please authenticate again.');
      return;
    }

    console.log('🚀 Attempting to join session:', {
      sessionId: sessionId.trim(),
      publicKey: authState.publicKeyHex?.slice(0, 16) + '...',
      isAuthenticated: authState.isAuthenticated,
      connectionStatus: wsConnection.readyState === WebSocket.OPEN ? 'open' : 'closed'
    });

    setIsJoiningSession(true);
    setJustJoinedSession(sessionId.trim());
    joinSessionRef.current = sessionId.trim();
    setError('');
    setSuccessMessage('');
    setHasShownJoinSuccess(false);

    const message = {
      type: 'JoinSession',
      payload: { session: sessionId.trim() }
    };

    console.log('📤 Sending JoinSession message:', message);
    wsConnection.send(JSON.stringify(message));
    
    // Set a timeout in case the server doesn't respond
    setTimeout(() => {
      if (isJoiningSession) {
        console.log('⏱️ Join session timeout - no response from server');
        setIsJoiningSession(false);
        setError('Join session timed out. The server may not be responding, or the session ID may be invalid.');
      }
    }, 10000); // 10 second timeout
  }, [wsConnection, authState.isAuthenticated, authState.publicKeyHex, isJoiningSession]);

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
    localStorage.removeItem('dkg-joined-sessions');
    setSessions([]);
    setJoinedSessions(new Set());
    setError('');
    
    if (wsConnection) {
      const message = { type: 'ClearAllSessions', payload: null };
      wsConnection.send(JSON.stringify(message));
    }
  }, [wsConnection]);

  // Set pending session parameters for creation
  const setPendingCreateSessionParams = useCallback((params: {minSigners: number; maxSigners: number; participants: any[]; automationMode?: 'manual' | 'automatic'}) => {
    setPendingSessionParams(params);
    pendingSessionParamsRef.current = params; // Also store in ref to prevent loss
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
    joinedSessions,
    
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