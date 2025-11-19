'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSignMessage } from 'wagmi';
import {
  initWasm,
  dkgRound1,
  dkgRound2,
  dkgFinalize,
  encryptShare,
  signMessageECDSA,
  getAuthPayloadRound1,
  getAuthPayloadRound2,
  getAuthPayloadFinalize,
} from '@/lib/frost-wasm';

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

// Store DKG state between rounds
interface DKGState {
  [sessionId: string]: {
    r1_secret?: string;
    r1_packages?: Record<string, string>;
    r2_secret?: string;
    r2_packages?: Record<string, string>;
    identifier?: string;
    groupId?: string;
    roster?: Array<[number, string, string]>;
  };
}

export function useDKGRounds(
  wsConnection: WebSocket | null,
  authState: AuthState,
  frostIdMap: Record<string, string>,
  setSuccessMessage: (message: string) => void,
  setError: (error: string) => void
) {
  const [isSubmittingRound1, setIsSubmittingRound1] = useState(false);
  const [isSubmittingRound2, setIsSubmittingRound2] = useState(false);
  const [isSubmittingFinalize, setIsSubmittingFinalize] = useState(false);
  const [showCommitmentModal, setShowCommitmentModal] = useState(false);
  const [selectedSessionForCommitment, setSelectedSessionForCommitment] = useState<DKGSession | null>(null);
  const [wasmReady, setWasmReady] = useState(false);

  // Store DKG state for each session
  const dkgStateRef = useRef<DKGState>({});

  const { signMessageAsync } = useSignMessage();

  // Initialize WASM on mount
  useEffect(() => {
    initWasm()
      .then(() => {
        setWasmReady(true);
        console.log('✅ FROST WASM ready for DKG operations');
      })
      .catch(err => {
        console.error('❌ Failed to initialize FROST WASM:', err);
        setError('Failed to initialize cryptographic module');
      });
  }, []);

  /**
   * Submit Round 1: Generate and submit DKG commitment
   * This uses real FROST dkg_part1 function
   */
  const submitRound1 = useCallback(async (
    session: DKGSession, 
    publicPackageHex?: string,
    secretPackageHex?: string
  ) => {
    if (!wsConnection || !authState.isAuthenticated) {
      setError('Must be connected and authenticated');
      return;
    }

    if (!wasmReady) {
      setError('Cryptographic module not ready. Please wait...');
      return;
    }

    setIsSubmittingRound1(true);
    setError('');

    try {
      const myIdHex = frostIdMap[session.id];
      
      if (!myIdHex) {
        throw new Error(`FROST identifier not available for session ${session.id}. Make sure ReadyRound1 message was received.`);
      }

      if (!authState.dkgPrivateKey) {
        throw new Error('DKG private key not available');
      }

      console.log('🔐 Starting DKG Round 1 submission...');
      console.log('  Session:', session.id);
      console.log('  My ID:', myIdHex);
      console.log('  Threshold:', `${session.minSigners}-of-${session.maxSigners}`);

      // Initialize DKG state for this session if not exists
      if (!dkgStateRef.current[session.id]) {
        dkgStateRef.current[session.id] = {};
      }
      
      const sessionState = dkgStateRef.current[session.id];
      sessionState.identifier = myIdHex;
      sessionState.groupId = session.groupId;
      sessionState.roster = session.roster;

      let publicPkg: string;
      let secretPkg: string;

      // Use provided packages if available, otherwise generate new ones
      if (publicPackageHex && secretPackageHex) {
        console.log('✅ Using pre-generated commitment packages from modal');
        console.log('  Public package length:', publicPackageHex.length);
        console.log('  Secret package length:', secretPackageHex.length);
        publicPkg = publicPackageHex;
        secretPkg = secretPackageHex;
      } else {
        console.log('🔄 Generating new commitment packages (no pre-generated packages provided)');
      // Call real FROST DKG Part 1
      const result = dkgRound1(myIdHex, session.maxSigners, session.minSigners);
        publicPkg = result.public_package_hex;
        secretPkg = result.secret_package_hex;
        console.log('✅ DKG Part 1 complete - generated commitment package');
        console.log('  Public package length:', publicPkg.length);
        console.log('  Secret package length:', secretPkg.length);
      }
      
      // Store secret package for Round 2
      sessionState.r1_secret = secretPkg;
      console.log('💾 Secret package stored for Round 2');

      // Create authentication payload
      const authPayload = getAuthPayloadRound1(
        session.id,
        myIdHex,
        publicPkg
      );

      // Sign with DKG private key
      const signature = signMessageECDSA(authState.dkgPrivateKey, authPayload);

      console.log('✅ Created signature for Round 1 submission');

      // Send to server
      const message = {
        type: 'Round1Submit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          pkg_bincode_hex: publicPkg,
          sig_ecdsa_hex: signature
        }
      };

      console.log('📤 Sending Round1Submit to server');
      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🔐 Round 1 commitment submitted successfully!');
      setShowCommitmentModal(false);
      
    } catch (error) {
      console.error('❌ Round 1 submission error:', error);
      setError('Failed to submit Round 1 commitment: ' + (error as Error).message);
    } finally {
      setIsSubmittingRound1(false);
    }
  }, [wsConnection, authState, frostIdMap, wasmReady, setSuccessMessage, setError]);

  /**
   * Submit Round 2: Generate and encrypt secret shares
   * This uses real FROST dkg_part2 + ECIES encryption
   */
  const submitRound2 = useCallback(async (session: DKGSession) => {
    if (!wsConnection || !authState.isAuthenticated) {
      setError('Must be connected and authenticated');
      return;
    }

    if (!wasmReady) {
      setError('Cryptographic module not ready');
      return;
    }

    setIsSubmittingRound2(true);
    setError('');

    try {
      const sessionState = dkgStateRef.current[session.id];
      
      if (!sessionState || !sessionState.r1_secret) {
        throw new Error('Round 1 must be completed first');
      }

      if (!sessionState.r1_packages) {
        throw new Error('Waiting for all Round 1 packages from server');
      }

      if (!authState.dkgPrivateKey) {
        throw new Error('DKG private key not available');
      }

      console.log('🔐 Starting DKG Round 2 with real FROST cryptography...');
      console.log('  Session:', session.id);
      console.log('  Round 1 packages:', Object.keys(sessionState.r1_packages).length);

      // Call real FROST DKG Part 2
      const result = dkgRound2(sessionState.r1_secret, sessionState.r1_packages);
      
      // Store secret for finalization
      sessionState.r2_secret = result.secret_package_hex;
      
      console.log('✅ DKG Part 2 complete - generated', Object.keys(result.outgoing_packages).length, 'encrypted shares');

      // Now encrypt each package using ECIES for the recipient
      const encryptedPackages: [string, string, string, string, string][] = [];
      
      if (session.roster) {
        for (const [recipientIdHex, pkgHex] of Object.entries(result.outgoing_packages)) {
          // Find recipient's ECDSA public key from roster
          const recipient = session.roster.find(([uid, idHex, ecdsaPubHex]) => idHex === recipientIdHex);
          
          if (!recipient) {
            throw new Error(`Could not find recipient ${recipientIdHex} in roster`);
          }

          const [uid, idHex, ecdsaPubHex] = recipient;
          
          console.log(`  Encrypting share for participant ${uid} (${idHex.slice(0, 8)}...)`);
          
          // Encrypt the DKG package using ECIES
          const encryptedData = encryptShare(ecdsaPubHex, pkgHex);
          
          // Create auth payload for this encrypted package
          const authPayload = getAuthPayloadRound2(
            session.id,
            sessionState.identifier!,
            recipientIdHex,
            encryptedData.ephemeral_public_key_hex,
            encryptedData.nonce_hex,
            encryptedData.ciphertext_hex
          );
          
          // Sign the auth payload
          const signature = signMessageECDSA(authState.dkgPrivateKey, authPayload);
          
          const encryptedPackage: [string, string, string, string, string] = [
            recipientIdHex,                          // recipient_id_hex
            encryptedData.ephemeral_public_key_hex, // eph_pub_sec1_hex  
            encryptedData.nonce_hex,                 // nonce_hex
            encryptedData.ciphertext_hex,            // ct_hex
            signature                                // sig_hex
          ];
          
          encryptedPackages.push(encryptedPackage);
        }
      }

      console.log('✅ Encrypted', encryptedPackages.length, 'packages using ECIES');

      // Send to server
      const message = {
        type: 'Round2Submit',
        payload: {
          session: session.id,
          id_hex: sessionState.identifier,
          pkgs_cipher_hex: encryptedPackages
        }
      };

      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🔒 Round 2 encrypted secret shares submitted! Waiting for other participants...');
      
    } catch (error) {
      console.error('❌ Round 2 submission error:', error);
      setError('Failed to submit Round 2 packages: ' + (error as Error).message);
    } finally {
      setIsSubmittingRound2(false);
    }
  }, [wsConnection, authState, wasmReady, setSuccessMessage, setError]);

  /**
   * Submit Finalization: Compute final key package
   * This uses real FROST dkg_part3
   */
  const submitFinalization = useCallback(async (session: DKGSession) => {
    if (!wsConnection || !authState.isAuthenticated) {
      setError('Must be connected and authenticated');
      return;
    }

    if (!wasmReady) {
      setError('Cryptographic module not ready');
      return;
    }

    setIsSubmittingFinalize(true);
    setError('');

    try {
      const sessionState = dkgStateRef.current[session.id];
      
      if (!sessionState || !sessionState.r2_secret) {
        throw new Error('Round 2 must be completed first');
      }

      if (!sessionState.r1_packages || !sessionState.r2_packages) {
        throw new Error('Missing DKG packages from previous rounds');
      }

      if (!authState.dkgPrivateKey) {
        throw new Error('DKG private key not available');
      }

      console.log('🔐 Starting DKG Finalization with real FROST cryptography...');
      console.log('  Session:', session.id);

      // Build roster map: UID -> ECDSA public key
      const rosterMap = new Map<number, string>();
      if (session.roster) {
        for (const [uid, idHex, ecdsaPubHex] of session.roster) {
          rosterMap.set(uid, ecdsaPubHex);
        }
      }

      console.log('  Roster size:', rosterMap.size);
      console.log('  Group ID:', sessionState.groupId);

      // Call real FROST DKG Part 3 (finalization)
      const result = dkgFinalize(
        sessionState.r2_secret,
        sessionState.r1_packages,
        sessionState.r2_packages,
        sessionState.groupId || session.groupId,
        rosterMap
      );

      console.log('✅ DKG Ceremony Complete!');
      console.log('  Key package length:', result.key_package_hex.length);
      console.log('  Group public key:', result.group_public_key_hex.slice(0, 16) + '...');

      // Store key package (this is the participant's secret share + metadata)
      sessionState.key_package = result.key_package_hex;
      sessionState.group_public_key = result.group_public_key_hex;

      // Create auth payload
      const authPayload = getAuthPayloadFinalize(
        session.id,
        sessionState.identifier!,
        result.group_public_key_hex
      );

      // Sign with DKG private key
      const signature = signMessageECDSA(authState.dkgPrivateKey, authPayload);

      console.log('✅ Created signature for finalization');

      // Send to server
      const message = {
        type: 'FinalizeSubmit',
        payload: {
          session: session.id,
          id_hex: sessionState.identifier,
          group_vk_sec1_hex: result.group_public_key_hex,
          sig_ecdsa_hex: signature
        }
      };

      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🎯 Finalization submitted! Computing final group verification key...');
      
      // Optionally save key package to localStorage for signing later
      try {
        const keyPackageData = {
          session_id: session.id,
          key_package_hex: result.key_package_hex,
          group_public_key_hex: result.group_public_key_hex,
          group_id: sessionState.groupId,
          threshold: session.minSigners,
          total: session.maxSigners,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(`dkg_key_package_${session.id}`, JSON.stringify(keyPackageData));
        console.log('💾 Key package saved to localStorage');
      } catch (storageError) {
        console.warn('⚠️ Could not save key package to localStorage:', storageError);
      }
      
    } catch (error) {
      console.error('❌ Finalization error:', error);
      setError('Failed to submit finalization: ' + (error as Error).message);
    } finally {
      setIsSubmittingFinalize(false);
    }
  }, [wsConnection, authState, wasmReady, setSuccessMessage, setError]);

  /**
   * Handle Round1All message from server
   * Store all participants' Round 1 packages
   */
  const handleRound1All = useCallback((sessionId: string, packages: Array<[string, string, string]>) => {
    console.log('📦 Received all Round 1 packages for session', sessionId);
    console.log('  Total packages:', packages.length);
    
    const sessionState = dkgStateRef.current[sessionId];
    if (!sessionState) {
      console.error('❌ No DKG state found for session', sessionId);
      return;
    }

    // Build map of id_hex -> package_hex (excluding our own package)
    const packagesMap: Record<string, string> = {};
    for (const [idHex, pkgHex, _sig] of packages) {
      if (idHex !== sessionState.identifier) {
        packagesMap[idHex] = pkgHex;
      }
    }

    sessionState.r1_packages = packagesMap;
    console.log('✅ Stored', Object.keys(packagesMap).length, 'Round 1 packages (excluding self)');
  }, []);

  /**
   * Handle Round2All message from server
   * Decrypt and store all participants' Round 2 packages
   */
  const handleRound2All = useCallback(async (
    sessionId: string,
    packages: Array<[string, string, string, string, string]>
  ) => {
    console.log('📦 Received encrypted Round 2 packages for session', sessionId);
    console.log('  Total packages:', packages.length);

    if (!authState.dkgPrivateKey) {
      console.error('❌ DKG private key not available for decryption');
      return;
    }

    const sessionState = dkgStateRef.current[sessionId];
    if (!sessionState) {
      console.error('❌ No DKG state found for session', sessionId);
      return;
    }

    try {
      // Import decryption function dynamically to avoid loading WASM too early
      const { decryptShare } = await import('@/lib/frost-wasm');
      
      // Decrypt each package
      const decryptedPackages: Record<string, string> = {};
      
      for (const [fromIdHex, ephPubHex, nonceHex, ctHex, _sig] of packages) {
        console.log(`  Decrypting package from ${fromIdHex.slice(0, 8)}...`);
        
        const decryptedHex = decryptShare(
          authState.dkgPrivateKey,
          ephPubHex,
          nonceHex,
          ctHex
        );
        
        decryptedPackages[fromIdHex] = decryptedHex;
      }

      sessionState.r2_packages = decryptedPackages;
      console.log('✅ Decrypted and stored', Object.keys(decryptedPackages).length, 'Round 2 packages');
    } catch (error) {
      console.error('❌ Failed to decrypt Round 2 packages:', error);
      setError('Failed to decrypt Round 2 packages: ' + (error as Error).message);
    }
  }, [authState.dkgPrivateKey, setError]);

  // Open commitment modal
  const openCommitmentModal = useCallback((session: DKGSession) => {
    setSelectedSessionForCommitment(session);
    setShowCommitmentModal(true);
  }, []);

  // Close commitment modal
  const closeCommitmentModal = useCallback(() => {
    setShowCommitmentModal(false);
    setSelectedSessionForCommitment(null);
  }, []);

  return {
    // Round submission states
    isSubmittingRound1,
    isSubmittingRound2,
    isSubmittingFinalize,
    wasmReady,
    
    // Modal state
    showCommitmentModal,
    selectedSessionForCommitment,
    
    // Actions
    submitRound1,
    submitRound2,
    submitFinalization,
    openCommitmentModal,
    closeCommitmentModal,
    
    // Server message handlers
    handleRound1All,
    handleRound2All,
    
    // DKG state access (for debugging)
    getDKGState: (sessionId: string) => dkgStateRef.current[sessionId],
  };
}
