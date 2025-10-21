/**
 * Automated DKG Ceremony Hook
 * Integrates with the real Rust DKG client for automatic sessions
 * 
 * CURRENT STATUS: ENABLED - Uses real FROST secp256k1 implementation
 * 
 * INTEGRATION APPROACH:
 * For automatic sessions, this hook spawns the actual Rust DKG client process
 * located at frost-dkg/keygen/dkg/src/main.rs which:
 * - Connects directly to the WebSocket server
 * - Handles all three DKG rounds autonomously using real frost_secp256k1 
 * - Uses proper ECIES encryption and authentication
 * - Outputs final results to group.json and share_*.json files
 * 
 * PROCESS FLOW:
 * 1. When ReadyRound1 is received for an automatic session
 * 2. Spawn DKG client with: --session <id> --ecdsa-priv-hex <key>
 * 3. DKG client handles all rounds automatically
 * 4. Web UI shows progress and final results
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSignMessage } from 'wagmi';

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

interface AuthState {
  isAuthenticated: boolean;
  challenge: string | null;
  publicKeyHex: string | null;
  dkgPrivateKey: string | null;
  userId: string | null;
}

interface AutomatedDKGConfig {
  enableAutoCommitment: boolean;     // Auto-submit Round 1 commitments
  enableAutoEncryption: boolean;     // Auto-submit Round 2 encrypted shares
  enableAutoFinalization: boolean;   // Auto-submit finalization
  commitmentDelay: number;           // Delay before auto-submitting commitment (ms)
  encryptionDelay: number;           // Delay before auto-submitting encryption (ms)
  finalizationDelay: number;         // Delay before auto-submitting finalization (ms)
}

const DEFAULT_CONFIG: AutomatedDKGConfig = {
  enableAutoCommitment: true,   // Now enabled with proper ECIES implementation
  enableAutoEncryption: true,   // Now enabled with proper ECIES implementation
  enableAutoFinalization: true, // Now enabled with proper ECIES implementation
  commitmentDelay: 2000,       // 2 seconds
  encryptionDelay: 3000,       // 3 seconds (encryption takes longer)
  finalizationDelay: 2000,     // 2 seconds
};

export function useAutomatedDKG(
  wsConnection: WebSocket | null,
  authState: AuthState,
  sessions: DKGSession[],
  frostIdMap: Record<string, string>,
  setSuccessMessage: (message: string) => void,
  setError: (error: string) => void,
  config: AutomatedDKGConfig = DEFAULT_CONFIG
) {
  const { signMessageAsync } = useSignMessage();

  // Spawn real DKG client for automatic sessions
  const spawnDkgClient = useCallback(async (sessionId: string, ecdsaPrivateKey: string) => {
    try {
      console.log('🤖 Spawning real DKG client for automatic session:', sessionId);
      
      const response = await fetch('http://127.0.0.1:9000/spawn-dkg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          ecdsa_private_key: ecdsaPrivateKey,
          out_dir: `sessions/${sessionId}`
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ DKG client spawned successfully:', result.message);
        setSuccessMessage(`🤖 Real DKG client started for session ${sessionId}`);
        return true;
      } else {
        console.error('❌ Failed to spawn DKG client:', result.message);
        setError(`Failed to start DKG client: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error spawning DKG client:', error);
      setError(`Error starting DKG client: ${error}`);
      return false;
    }
  }, [setSuccessMessage, setError]);

  // Manually start the automated ceremony for a specific session
  const startAutomatedCeremony = useCallback(async (sessionId: string) => {
    console.log(`🚀 [DEBUG] startAutomatedCeremony called for session ${sessionId}`);
    
    // Find the session to get participant information
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      const errorMsg = `Session ${sessionId} not found`;
      console.error(`❌ [DEBUG] ${errorMsg}`);
      setError(errorMsg);
      return false;
    }

    console.log(`🚀 [DEBUG] Session found:`, session);
    console.log(`🚀 [DEBUG] Session roster:`, session.roster);

    if (!session.roster || session.roster.length === 0) {
      const errorMsg = 'No participants found in session roster';
      console.error(`❌ [DEBUG] ${errorMsg}`);
      setError(errorMsg);
      return false;
    }

    console.log(`🚀 Creator starting automated ceremony for session ${sessionId} with ${session.roster.length} participants`);
    
    // For automated ceremony, we need the current user's DKG private key
    if (!authState.dkgPrivateKey) {
      const errorMsg = 'DKG private key not available for automated ceremony. Please click "Get Public Key" first.';
      console.error(`❌ [DEBUG] ${errorMsg}`);
      setError(errorMsg);
      return false;
    }

    try {
      // Send a special message to the server to start automated ceremony for all participants
      // Include the user's DKG private key to use for all spawned clients
      const response = await fetch('http://127.0.0.1:9000/start-automated-ceremony', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_dkg_private_key: authState.dkgPrivateKey,
          participants: session.roster.map(([uid, frostIdHex, ecdsaPubKeyHex]) => ({
            uid,
            frost_id_hex: frostIdHex,
            ecdsa_pub_hex: ecdsaPubKeyHex
          }))
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Automated ceremony started:', result.message);
        setSuccessMessage(`🤖 Automated ceremony started for ${session.roster.length} participants`);
        return true;
      } else {
        console.error('❌ Failed to start automated ceremony:', result.message);
        setError(`Failed to start automated ceremony: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ [DEBUG] Error in startAutomatedCeremony:`, error);
      setError(`Error starting automated ceremony: ${error}`);
      return false;
    }
  }, [sessions, setError, setSuccessMessage]);

  const processedSessions = useRef<Set<string>>(new Set());
  const automationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Auto-submit Round 1 commitment using mock FROST packages
  const autoSubmitRound1 = useCallback(async (session: DKGSession) => {
    if (!wsConnection || !authState.isAuthenticated || !config.enableAutoCommitment) {
      return;
    }

    const myIdHex = frostIdMap[session.id];
    if (!myIdHex) {
      console.error('Cannot auto-submit Round 1: FROST identifier not available');
      return;
    }

    try {
      console.log('🤖 Auto-submitting Round 1 commitment for session', session.id);
      
      // Generate mock FROST Round 1 package with correct format
      const packageHex = generateMockFrostRound1Package();
      logPackageInfo(packageHex, 'Round 1');
      
      // Create authentication payload (matching manual DKG format)
      const authPayloadText = `TOKAMAK_FROST_DKG_R1|${session.id}|${myIdHex}|${packageHex.trim()}`;
      const rawSignature = await signMessageAsync({ message: authPayloadText });
      
      // Remove '0x' prefix if present to match server expectations
      const signature = rawSignature.startsWith('0x') ? rawSignature.slice(2) : rawSignature;
      
      const message = {
        type: 'Round1Submit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          pkg_bincode_hex: packageHex.trim(), // Mock FROST package with correct format
          sig_ecdsa_hex: signature // Use real wallet signature without 0x prefix
        }
      };

      console.log('📤 Automated Round 1 message (Mock FROST):', JSON.stringify(message, null, 2));
      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🤖 Automatically submitted Round 1 commitment using Mock FROST');
      
    } catch (error) {
      console.error('Auto Round 1 submission failed:', error);
      setError('Automated Round 1 submission failed: ' + (error as Error).message);
    }
  }, [wsConnection, authState.isAuthenticated, frostIdMap, config.enableAutoCommitment, signMessageAsync, setSuccessMessage, setError]);

  // Auto-submit Round 2 encrypted shares using mock FROST packages
  const autoSubmitRound2 = useCallback(async (session: DKGSession) => {
    if (!wsConnection || !authState.isAuthenticated || !config.enableAutoEncryption) {
      return;
    }

    const myIdHex = frostIdMap[session.id];
    if (!myIdHex || !authState.dkgPrivateKey) {
      console.error('Cannot auto-submit Round 2: Missing identifiers or private key');
      return;
    }

    try {
      console.log('🤖 Auto-submitting Round 2 encrypted shares for session', session.id);
      
      // Create ECIES encrypted packages for each participant
      const encryptedPackages: [string, string, string, string, string][] = [];
      
      if (session.roster) {
        for (const [uid, recipientIdHex, ecdsaPubHex] of session.roster) {
          try {
            // Generate a mock secret share for this recipient
            const secretShare = generateMockSecretShare();
            
            // Encrypt the secret share using ECIES
            const encryptedData = await eciesEncrypt(secretShare, ecdsaPubHex);
            
            // Create ECDSA signature for the encrypted envelope
            const signature = await signEncryptedPackage(
              session.id,
              myIdHex,
              recipientIdHex,
              encryptedData.ephemeralPublicKey,
              encryptedData.nonce,
              encryptedData.ciphertext,
              authState.dkgPrivateKey
            );
            
            const encryptedPackage: [string, string, string, string, string] = [
              recipientIdHex,
              encryptedData.ephemeralPublicKey,
              encryptedData.nonce,
              encryptedData.ciphertext,
              signature
            ];
            
            encryptedPackages.push(encryptedPackage);
          } catch (error) {
            console.error(`Failed to create encrypted package for participant ${uid}:`, error);
            throw error;
          }
        }
      }

      const message = {
        type: 'Round2Submit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          pkgs_cipher_hex: encryptedPackages
        }
      };

      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🤖 Automatically submitted Round 2 encrypted shares using Mock FROST');
      
    } catch (error) {
      console.error('Auto Round 2 submission failed:', error);
      setError('Automated Round 2 submission failed: ' + (error as Error).message);
    }
  }, [wsConnection, authState, frostIdMap, config.enableAutoEncryption, setSuccessMessage, setError]);

  // Auto-submit finalization using mock FROST packages
  const autoSubmitFinalization = useCallback(async (session: DKGSession) => {
    if (!wsConnection || !authState.isAuthenticated || !config.enableAutoFinalization) {
      return;
    }

    const myIdHex = frostIdMap[session.id];
    if (!myIdHex) {
      console.error('Cannot auto-submit finalization: FROST identifier not available');
      return;
    }

    try {
      console.log('🤖 Auto-submitting finalization for session', session.id);
      
      // Generate mock group verifying key
      const groupVerifyingKey = generateMockGroupVerifyingKey();
      logPackageInfo(groupVerifyingKey, 'Group Verifying Key');
      
      // Create authentication payload (matching manual DKG format)
      const authPayloadText = `TOKAMAK_FROST_DKG_FINAL|${session.id}|${myIdHex}|${groupVerifyingKey}`;
      const rawSignature = await signMessageAsync({ message: authPayloadText });
      
      // Remove '0x' prefix if present to match server expectations
      const signature = rawSignature.startsWith('0x') ? rawSignature.slice(2) : rawSignature;
      
      const message = {
        type: 'FinalizeSubmit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          group_vk_sec1_hex: groupVerifyingKey, // Mock group verifying key with correct format
          sig_ecdsa_hex: signature // Real wallet signature for authentication
        }
      };

      console.log('📤 Automated Finalization message (Mock FROST):', JSON.stringify(message, null, 2));
      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🤖 Automatically submitted finalization using Mock FROST');
      
    } catch (error) {
      console.error('Auto finalization submission failed:', error);
      setError('Automated finalization submission failed: ' + (error as Error).message);
    }
  }, [wsConnection, authState.isAuthenticated, frostIdMap, config.enableAutoFinalization, signMessageAsync, setSuccessMessage, setError]);

  // Clear automation timeout for a session
  const clearAutomationTimeout = useCallback((sessionId: string) => {
    const timeoutId = automationTimeouts.current.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      automationTimeouts.current.delete(sessionId);
    }
  }, []);

  // Schedule automation for a session phase
  const scheduleAutomation = useCallback((
    sessionId: string,
    phase: 'round1' | 'round2' | 'finalizing',
    action: () => Promise<void>,
    delay: number
  ) => {
    // Clear any existing timeout for this session
    clearAutomationTimeout(sessionId);

    const timeoutId = setTimeout(async () => {
      try {
        await action();
      } catch (error) {
        console.error(`Automated ${phase} failed for session ${sessionId}:`, error);
      }
      automationTimeouts.current.delete(sessionId);
    }, delay);

    automationTimeouts.current.set(sessionId, timeoutId);
    console.log(`⏰ Scheduled auto-${phase} for session ${sessionId} in ${delay}ms`);
  }, [clearAutomationTimeout]);

  // Monitor sessions for automation opportunities
  useEffect(() => {
    if (!wsConnection || !authState.isAuthenticated) {
      return;
    }

    for (const session of sessions) {
      const sessionKey = `${session.id}-${session.status}`;
      
      // Skip if we've already processed this session in this phase
      if (processedSessions.current.has(sessionKey)) {
        continue;
      }

      // Check if this session has automation enabled
      const isAutomated = session.automationMode === 'automatic';

      switch (session.status) {
        case 'round1':
          // For automatic sessions, don't auto-start the DKG client
          // Instead, the creator will manually trigger it with a button
          if (isAutomated) {
            console.log(`🤖 Automatic session ${session.id} ready for manual start`);
            processedSessions.current.add(sessionKey);
          }
          break;

        case 'round2':
          if (isAutomated) {
            console.log(`🤖 Round 2 for automatic session ${session.id} - handled by DKG client`);
            // For automatic sessions, the DKG client handles all rounds automatically
            processedSessions.current.add(sessionKey);
          }
          break;

        case 'finalizing':
          if (isAutomated) {
            console.log(`🤖 Finalization for automatic session ${session.id} - handled by DKG client`);
            // For automatic sessions, the DKG client handles all rounds automatically
            processedSessions.current.add(sessionKey);
          }
          break;

        case 'completed':
        case 'failed':
          // Clean up any pending automation for completed/failed sessions
          clearAutomationTimeout(session.id);
          break;
      }
    }
  }, [sessions, wsConnection, authState.isAuthenticated, config, scheduleAutomation, autoSubmitRound1, autoSubmitRound2, autoSubmitFinalization, clearAutomationTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Convert Map.values() to Array for compatibility
      Array.from(automationTimeouts.current.values()).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      automationTimeouts.current.clear();
    };
  }, []);

  return {
    // Manual override functions (for when automation is disabled)
    manualSubmitRound1: autoSubmitRound1,
    manualSubmitRound2: autoSubmitRound2,
    manualSubmitFinalization: autoSubmitFinalization,
    
    // Automation control
    startAutomatedCeremony,
    
    // Automation status
    isAutomationEnabled: config.enableAutoCommitment || config.enableAutoEncryption || config.enableAutoFinalization,
    activeAutomations: Array.from(automationTimeouts.current.keys()),
    
    // Control functions
    clearAutomationTimeout
  };
}