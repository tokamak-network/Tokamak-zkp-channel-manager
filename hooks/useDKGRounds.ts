'use client';

import { useState, useCallback } from 'react';
import { useSignMessage } from 'wagmi';
import { eciesEncrypt, generateMockSecretShare, signEncryptedPackage } from '@/lib/ecies';

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
}

interface AuthState {
  isAuthenticated: boolean;
  challenge: string | null;
  publicKeyHex: string | null;
  dkgPrivateKey: string | null;
  userId: string | null;
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

  const { signMessageAsync } = useSignMessage();

  // Submit Round 1 commitment
  const submitRound1 = useCallback(async (session: DKGSession, commitment: string) => {
    if (!wsConnection || !authState.isAuthenticated) {
      setError('Must be connected and authenticated');
      return;
    }

    setIsSubmittingRound1(true);
    setError('');

    try {
      const myIdHex = frostIdMap[session.id];
      
      if (!myIdHex) {
        throw new Error(`FROST identifier not available for session ${session.id}. Make sure ReadyRound1 message was received.`);
      }

      const authPayloadText = `TOKAMAK_FROST_DKG_R1|${session.id}|${myIdHex}|${commitment.trim()}`;
      const signature = await signMessageAsync({ message: authPayloadText });

      const message = {
        type: 'Round1Submit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          round1_package: commitment.trim(),
          signature
        }
      };

      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🔐 Round 1 commitment submitted successfully!');
      setShowCommitmentModal(false);
      
    } catch (error) {
      console.error('Round 1 submission error:', error);
      setError('Failed to submit Round 1 commitment: ' + (error as Error).message);
    } finally {
      setIsSubmittingRound1(false);
    }
  }, [wsConnection, authState.isAuthenticated, frostIdMap, signMessageAsync, setSuccessMessage, setError]);

  // Submit Round 2 encrypted shares
  const submitRound2 = useCallback(async (session: DKGSession) => {
    if (!wsConnection || !authState.isAuthenticated) {
      setError('Must be connected and authenticated');
      return;
    }

    setIsSubmittingRound2(true);
    setError('');

    try {
      const myIdHex = frostIdMap[session.id];
      if (!myIdHex) {
        throw new Error('FROST identifier not available. Make sure ReadyRound1 message was received.');
      }

      if (!authState.dkgPrivateKey) {
        throw new Error('DKG private key not available for encryption.');
      }

      // Create real ECIES encrypted packages for each participant
      const encryptedPackages: [string, string, string, string, string][] = [];
      
      if (session.roster) {
        console.log('🔐 Creating ECIES encrypted secret shares for', session.roster.length, 'participants');
        
        for (const [uid, recipientIdHex, ecdsaPubHex] of session.roster) {
          try {
            // Generate a secret share for this recipient (mock for now - in real DKG this comes from FROST library)
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
              recipientIdHex,                          // recipient_id_hex
              encryptedData.ephemeralPublicKey,        // eph_pub_sec1_hex  
              encryptedData.nonce,                     // nonce_hex
              encryptedData.ciphertext,                // ct_hex
              signature                                // sig_hex
            ];
            
            encryptedPackages.push(encryptedPackage);
            
            console.log(`✅ Created encrypted package for participant ${uid} (${recipientIdHex.slice(0, 8)}...)`);
          } catch (error) {
            console.error(`❌ Failed to create encrypted package for participant ${uid}:`, error);
            throw new Error(`Failed to encrypt secret share for participant ${uid}: ${error}`);
          }
        }
      }

      console.log('📤 Sending', encryptedPackages.length, 'encrypted packages to server');

      const message = {
        type: 'Round2Submit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          pkgs_cipher_hex: encryptedPackages
        }
      };

      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🔒 Round 2 encrypted secret shares submitted! Waiting for other participants...');
    } catch (error) {
      console.error('Round 2 submission error:', error);
      setError('Failed to submit Round 2 packages: ' + (error as Error).message);
    } finally {
      setIsSubmittingRound2(false);
    }
  }, [wsConnection, authState.isAuthenticated, frostIdMap, signMessageAsync, setSuccessMessage, setError]);

  // Submit finalization
  const submitFinalization = useCallback(async (session: DKGSession) => {
    if (!wsConnection || !authState.isAuthenticated) {
      setError('Must be connected and authenticated');
      return;
    }

    setIsSubmittingFinalize(true);
    setError('');

    try {
      const myIdHex = frostIdMap[session.id];
      if (!myIdHex) {
        throw new Error('FROST identifier not available. Make sure ReadyRound1 message was received.');
      }

      // Create mock group verification key
      const mockGroupVk = new Uint8Array(33);
      mockGroupVk.fill(3);
      mockGroupVk[0] = 3;
      const groupVkHex = Array.from(mockGroupVk).map(b => b.toString(16).padStart(2, '0')).join('');

      // Create mock ECDSA signature
      const mockSignature = '0x' + Array(128).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join('');

      const authPayloadText = `TOKAMAK_FROST_DKG_FINAL|${session.id}|${myIdHex}|${groupVkHex}`;
      const signature = await signMessageAsync({ message: authPayloadText });

      const message = {
        type: 'FinalizeSubmit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          group_verifying_key: groupVkHex,
          ecdsa_signature: mockSignature,
          signature
        }
      };

      wsConnection.send(JSON.stringify(message));
      setSuccessMessage('🎯 Finalization submitted! Computing final group verification key...');
    } catch (error) {
      console.error('Finalization submission error:', error);
      setError('Failed to submit finalization: ' + (error as Error).message);
    } finally {
      setIsSubmittingFinalize(false);
    }
  }, [wsConnection, authState.isAuthenticated, frostIdMap, signMessageAsync, setSuccessMessage, setError]);

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
    
    // Modal state
    showCommitmentModal,
    selectedSessionForCommitment,
    
    // Actions
    submitRound1,
    submitRound2,
    submitFinalization,
    openCommitmentModal,
    closeCommitmentModal
  };
}