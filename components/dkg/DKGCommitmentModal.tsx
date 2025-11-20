'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { FileText, Clipboard, AlertTriangle, RefreshCw, KeyRound, Sparkles, Copy, Check } from 'lucide-react';

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
  frostIdMap?: Record<string, string>;
  authState?: {
    isAuthenticated: boolean;
    publicKeyHex?: string;
  };
  onClose: () => void;
  onSubmit: (publicPackage: string, secretPackage: string) => void;
}

export function DKGCommitmentModal({
  isOpen,
  session,
  isSubmitting,
  frostIdMap = {},
  authState,
  onClose,
  onSubmit
}: DKGCommitmentModalProps) {
  const [commitmentInput, setCommitmentInput] = useState('');
  const [generatedSecret, setGeneratedSecret] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const autoGenerateCommitment = async () => {
    if (!session) return;
    
    setIsGenerating(true);
    try {
      // Import FROST WASM functions
      const { initWasm, dkgRound1, getIdentifierHex } = await import('@/lib/frost-wasm');
      
      // Initialize WASM
      await initWasm();
      
      // Try to find user's UID from the roster
      let myUid: number | null = null;
      
      // Method 1: Try to match by FROST ID if available
      if (session.id && frostIdMap[session.id]) {
        const myFrostId = frostIdMap[session.id];
        const found = session.roster.find(([_, __, frostId]) => frostId === myFrostId);
        if (found) {
          myUid = found[0];
          console.log(`✅ Found UID ${myUid} by matching FROST ID`);
        }
      }
      
      // Method 2: Try to match by public key if auth state available
      if (myUid === null && authState?.publicKeyHex) {
        const found = session.roster.find(([_, pubKey]) => 
          pubKey.toLowerCase() === authState.publicKeyHex?.toLowerCase()
        );
        if (found) {
          myUid = found[0];
          console.log(`✅ Found UID ${myUid} by matching public key`);
        }
      }
      
      // Method 3: Use first available UID if can't determine
      if (myUid === null && session.roster.length > 0) {
        myUid = session.roster[0][0];
        console.log(`⚠️ Using first available UID ${myUid} (could not auto-detect your UID)`);
      }
      
      if (myUid === null) {
        alert('❌ Could not determine your UID. Please check the roster.');
        return;
      }
      
      // Generate identifier hex
      const identifierHex = getIdentifierHex(myUid);
      
      // Generate Round 1 package
      console.log(`🔑 Generating Round 1 package with UID ${myUid}, maxSigners=${session.maxSigners}, minSigners=${session.minSigners}`);
      const result = dkgRound1(
        identifierHex,
        session.maxSigners,
        session.minSigners
      );
      
      // Store the secret and auto-fill the public package
      setGeneratedSecret(result.secret_package_hex);
      setCommitmentInput(result.public_package_hex);
      
      console.log('✅ Round 1 package generated successfully!');
      console.log('📦 Public package length:', result.public_package_hex.length);
      console.log('🔒 Secret package length:', result.secret_package_hex.length);
      
    } catch (error) {
      console.error('❌ Error generating commitment:', error);
      alert(`Error generating commitment: ${error}\n\nMake sure the FROST WASM module is properly initialized.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const copySecretToClipboard = () => {
    navigator.clipboard.writeText(generatedSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleSubmit = () => {
    if (commitmentInput.trim()) {
      // Must have a secret package (either from auto-generation or manual entry)
      if (!generatedSecret.trim()) {
        alert('⚠️ Secret package is missing!\n\nYou must either:\n1. Use "Auto-Generate Commitment" button, or\n2. Manually enter your secret package below.');
        return;
      }
      
      console.log('📤 Submitting commitment:', {
        publicLength: commitmentInput.length,
        secretLength: generatedSecret.length
      });
      
      onSubmit(commitmentInput.trim(), generatedSecret.trim());
      setCommitmentInput('');
      setGeneratedSecret(''); // Clear secret after submission
    }
  };

  const handleClose = () => {
    setCommitmentInput('');
    setGeneratedSecret('');
    setCopiedSecret(false);
    onClose();
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
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

            {/* Auto-Generate Button */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-700">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-1">
                    Quick Generation
                  </h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                    Click below to automatically generate your Round 1 commitment package using FROST WASM
                  </p>
                  <Button
                    type="button"
                    onClick={autoGenerateCommitment}
                    disabled={isGenerating}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Auto-Generate Commitment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Secret Package Display (if generated) */}
            {generatedSecret && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-2 border-red-300 dark:border-red-700 animate-pulse">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-red-900 dark:text-red-100 mb-1">
                      ⚠️ CRITICAL: Save Your Secret Package!
                    </h4>
                    <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                      You MUST save this secret package securely. You'll need it for Round 2. It cannot be recovered!
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <Textarea
                    value={generatedSecret}
                    readOnly
                    rows={4}
                    className="font-mono text-xs bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-100 border-red-300 dark:border-red-600 resize-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={copySecretToClipboard}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {copiedSecret ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Secret
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Manual Secret Package Input (for advanced users) */}
            {!generatedSecret && (
              <details className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-300 dark:border-gray-600">
                <summary className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 text-sm">
                  Advanced: Manually Paste Secret Package
                </summary>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Secret Package (if you generated it externally)
                  </label>
                  <Textarea
                    value={generatedSecret}
                    onChange={(e) => setGeneratedSecret(e.target.value)}
                    placeholder="Paste your secret_package_hex here if you generated it manually..."
                    rows={3}
                    className="font-mono text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </details>
            )}

            {/* Commitment Input */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  FROST Round 1 Public Package (Hex Format)
                </label>
              </div>
              <Textarea
                value={commitmentInput}
                onChange={(e) => setCommitmentInput(e.target.value)}
                placeholder="Click 'Auto-Generate' above or paste your Round 1 public package here..."
                rows={6}
                className="font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
              {commitmentInput && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Public package ready ({commitmentInput.length} characters)
                </p>
              )}
            </div>

            {/* Collapsible Instructions */}
            <details className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <summary className="font-medium text-blue-800 dark:text-blue-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2">
                <Clipboard className="w-4 h-4" />
                📘 How to Generate Round 1 Package (Click to expand)
              </summary>
              <div className="mt-4 space-y-4">
                {/* Step-by-step instructions */}
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Step 1: Generate Round 1 Commitment</p>
                  <div className="bg-gray-900 dark:bg-black p-3 rounded font-mono text-xs text-green-400 overflow-x-auto">
                    {`import { initWasm, dkgRound1, getIdentifierHex } from '@/lib/frost-wasm';

// Initialize WASM
await initWasm();

// Get your UID from roster (e.g., 1, 2, or 3)
const myUid = 1; // Your participant number
const identifierHex = getIdentifierHex(myUid);

// Generate Round 1 package
const result = dkgRound1(
  identifierHex,
  ${session?.maxSigners || 3}, // maxSigners
  ${session?.minSigners || 2}  // minSigners
);

// Submit: result.public_package_hex`}
                  </div>
                  <p className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5 mt-2 text-sm">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <strong>Important:</strong> Keep your <code className="bg-amber-200 dark:bg-amber-900 px-1 rounded">secret_package_hex</code> safe - you'll need it for Round 2!
                  </p>
                </div>

                {/* DKG Flow overview */}
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <h5 className="font-medium text-green-800 dark:text-green-200 mb-2 text-sm">Complete FROST DKG Flow</h5>
                  <div className="text-sm space-y-1.5 text-gray-700 dark:text-gray-300">
                    <p><strong className="text-green-900 dark:text-green-100">Round 1 (Current):</strong> Each participant submits <code className="bg-green-200 dark:bg-green-900 px-1 rounded text-xs">public_package_hex</code></p>
                    <p><strong className="text-green-900 dark:text-green-100">Round 2:</strong> Use <code className="bg-green-200 dark:bg-green-900 px-1 rounded text-xs">dkgRound2()</code> to generate encrypted shares</p>
                    <p><strong className="text-green-900 dark:text-green-100">Finalization:</strong> Use <code className="bg-green-200 dark:bg-green-900 px-1 rounded text-xs">dkgFinalize()</code> to compute your key share</p>
                  </div>
                </div>
              </div>
            </details>

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
                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Submit Commitment
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}