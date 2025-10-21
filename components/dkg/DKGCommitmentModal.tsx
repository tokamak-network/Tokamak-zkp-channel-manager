'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

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

interface DKGCommitmentModalProps {
  isOpen: boolean;
  session: DKGSession | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (commitment: string) => void;
}

export function DKGCommitmentModal({
  isOpen,
  session,
  isSubmitting,
  onClose,
  onSubmit
}: DKGCommitmentModalProps) {
  const [commitmentInput, setCommitmentInput] = useState('');

  const generateMockCommitment = () => {
    // Real FROST packages cannot be generated in the browser
    // This is just a placeholder to show the UI works
    return "// Real FROST Round1 package required\n// Use: cargo run -p dkg\n// Then copy the generated hex data here";
  };

  const handleSubmit = () => {
    if (commitmentInput.trim()) {
      onSubmit(commitmentInput.trim());
      setCommitmentInput('');
    }
  };

  const handleClose = () => {
    setCommitmentInput('');
    onClose();
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Submit Round 1 Commitment
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Session: {session.id}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </Button>
          </div>

          <div className="space-y-4">
            {/* Session Information */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Session Details</h3>
              <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <p>• Session ID: {session.id}</p>
                <p>• Participants: {session.currentParticipants}/{session.maxSigners}</p>
                <p>• Threshold: {session.minSigners} of {session.maxSigners} signatures required</p>
                <p>• Your Role: {session.myRole === 'creator' ? 'Session Creator' : 'Participant'}</p>
                {session.description && <p>• Description: {session.description}</p>}
              </div>
            </div>

            {/* Commitment Input */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  FROST Round 1 Package (Hex Format)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCommitmentInput(generateMockCommitment())}
                  className="text-xs"
                >
                  📝 Generate Mock
                </Button>
              </div>
              <Textarea
                value={commitmentInput}
                onChange={(e) => setCommitmentInput(e.target.value)}
                placeholder="Paste your Round 1 commitment package here (hex format)..."
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {/* Instructions */}
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">📋 Instructions</h4>
              <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <p>1. <strong>Generate your commitment:</strong> Use the FROST DKG CLI tool to generate your Round 1 package</p>
                <p>2. <strong>Copy the hex data:</strong> The output should be in hexadecimal format</p>
                <p>3. <strong>Paste above:</strong> Enter the commitment data in the text area</p>
                <p>4. <strong>Submit:</strong> Click submit to send your commitment to other participants</p>
                <p className="text-amber-700 dark:text-amber-300 font-medium">
                  ⚠️ <strong>Security:</strong> Your commitment will be signed with MetaMask for authenticity
                </p>
              </div>
            </div>

            {/* What Happens Next */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">🔄 What Happens Next</h4>
              <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <p>1. <strong>Authentication:</strong> MetaMask will prompt you to sign the commitment</p>
                <p>2. <strong>Submission:</strong> Your commitment is sent to all other participants</p>
                <p>3. <strong>Waiting:</strong> Wait for all other participants to submit their commitments</p>
                <p>4. <strong>Round 2:</strong> Once all commitments are collected, Round 2 (Secret Sharing) begins</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!commitmentInput.trim() || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting...
                  </div>
                ) : (
                  <>🔐 Submit Commitment</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}