'use client';

import { useState, useCallback } from 'react';
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
  myRole: 'creator' | 'participant';
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

      // Create mock encrypted packages for demo
      const mockEncryptedPackages: [string, string, string, string, string][] = [];
      
      if (session.roster) {
        session.roster.forEach(([uid, recipientIdHex, ecdsaPubHex]) => {
          const mockPackage: [string, string, string, string, string] = [
            recipientIdHex,
            '0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
            '0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
            '0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
            '0x' + Array(64).fill('0').map(() => Math.floor(Math.random() * 16).toString(16)).join('')
          ];
          mockEncryptedPackages.push(mockPackage);
        });
      }

      const authPayloadText = `TOKAMAK_FROST_DKG_R2|${session.id}|${myIdHex}|${mockEncryptedPackages.length}`;
      const signature = await signMessageAsync({ message: authPayloadText });

      const message = {
        type: 'Round2Submit',
        payload: {
          session: session.id,
          id_hex: myIdHex,
          round2_encrypted_packages: mockEncryptedPackages,
          signature
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