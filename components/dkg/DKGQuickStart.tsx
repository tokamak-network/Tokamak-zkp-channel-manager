'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  Users, 
  Key, 
  Settings,
  HelpCircle,
  X,
  PlayCircle,
  Pause,
  AlertCircle,
  Copy,
  UserPlus
} from 'lucide-react';
import { StatusLight } from '@/components/ui/status-indicator';
import { useToast } from '@/components/ui/toast';

interface DKGQuickStartProps {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  authState: {
    isAuthenticated: boolean;
    publicKeyHex?: string;
  };
  isCreatingSession: boolean;
  onCreateSession: (params: {
    minSigners: number;
    maxSigners: number;
    participants: Array<{ uid: number; publicKey: string }>;
    automationMode: 'manual' | 'automatic';
  }) => void;
  onJoinSession: (sessionId: string) => void;
  onConnectToServer: () => void;
  onAuthenticate: () => void;
  onGetPublicKey: () => void;
  onSwitchToSessionsTab: () => void;
  sessions: any[];
  pendingSigningSessions: any[];
  isJoiningSession: boolean;
  serverUrl: string;
  setServerUrl: (url: string) => void;
}

export function DKGQuickStart({
  connectionStatus,
  authState,
  isCreatingSession,
  onCreateSession,
  onJoinSession,
  onConnectToServer,
  onAuthenticate,
  onGetPublicKey,
  onSwitchToSessionsTab,
  sessions,
  pendingSigningSessions,
  isJoiningSession,
  serverUrl,
  setServerUrl
}: DKGQuickStartProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isWizardMode] = useState(true); // Always true - guide always shown
  const [quickSessionParams, setQuickSessionParams] = useState({
    threshold: '3',
    participants: '5'
  });
  const [showRoasterBanner, setShowRoasterBanner] = useState(false);
  const [roasterAddresses, setRoasterAddresses] = useState('');
  const { showToast } = useToast();

  // Auto-advance steps based on state
  useEffect(() => {
    if (connectionStatus === 'connected' && currentStep === 0) {
      setCurrentStep(1);
    }
    if (authState.isAuthenticated && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [connectionStatus, authState.isAuthenticated, currentStep]);

  const steps = [
    {
      title: 'Connect to Server',
      description: 'Establish connection with the DKG server',
      icon: Settings,
      status: connectionStatus === 'connected' ? 'completed' : connectionStatus === 'connecting' ? 'active' : 'pending'
    },
    {
      title: 'Authenticate',
      description: 'Sign in with your wallet to participate',
      icon: Key,
      status: authState.isAuthenticated ? 'completed' : connectionStatus === 'connected' ? 'active' : 'pending'
    },
    {
      title: 'Choose Action',
      description: 'Create a new session or join an existing one',
      icon: Users,
      status: authState.isAuthenticated ? 'active' : 'pending'
    }
  ];

  const handleQuickCreate = () => {
    // Show roaster banner to collect addresses
    setShowRoasterBanner(true);
  };

  const handleCreateWithAddresses = () => {
    const threshold = parseInt(quickSessionParams.threshold);
    const participantCount = parseInt(quickSessionParams.participants);

    // Validate basic constraints
    if (threshold > participantCount) {
      showToast({
        type: 'error',
        title: 'Invalid Configuration',
        message: 'Threshold cannot be greater than number of participants'
      });
      return;
    }

    if (threshold < 2) {
      showToast({
        type: 'error',
        title: 'Invalid Threshold',
        message: 'Threshold must be at least 2 for security'
      });
      return;
    }

    if (participantCount > 127) {
      showToast({
        type: 'error',
        title: 'Too Many Participants',
        message: 'FROST protocol supports a maximum of 127 participants'
      });
      return;
    }

    // Parse roaster addresses
    const addressLines = roasterAddresses.trim().split('\n').filter(line => line.trim());
    if (addressLines.length === 0) {
      showToast({
        type: 'error',
        title: 'No Addresses Provided',
        message: 'Please provide at least one roaster address'
      });
      return;
    }

    if (addressLines.length !== participantCount) {
      showToast({
        type: 'error',
        title: 'Address Count Mismatch',
        message: `Please provide exactly ${participantCount} roaster addresses (one per line). Currently provided: ${addressLines.length}`
      });
      return;
    }

    // Additional validation for large sessions
    if (participantCount > 20) {
      showToast({
        type: 'warning',
        title: 'Large Session Warning',
        message: `Creating a session with ${participantCount} participants. This may take longer to complete.`,
        duration: 6000
      });
    }

    // Create participants array with provided addresses
    const participants = addressLines.map((address, index) => ({
      uid: index + 1,
      publicKey: address.trim()
    }));

    onCreateSession({
      minSigners: threshold,
      maxSigners: participantCount,
      participants,
      automationMode: 'automatic'
    });

    showToast({
      type: 'info',
      title: 'Session Created',
      message: 'DKG session created with provided roaster addresses',
      duration: 5000
    });

    // Close banner and clear addresses
    setShowRoasterBanner(false);
    setRoasterAddresses('');
  };


  return (
    <Card className="p-6 bg-gradient-to-br from-[#1a2347] to-[#0a1930] border-[#4fc3f7]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#4fc3f7]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">DKG Quick Start Wizard</h3>
            <p className="text-sm text-gray-400">Follow these steps to get started with threshold signatures</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center mb-4 relative">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            const isPending = step.status === 'pending';

            return (
              <div key={index} className="flex-1 flex items-center justify-center relative">
                <div className={`
                  relative flex items-center justify-center w-14 h-14 rounded-full border-3 transition-all duration-500 z-10
                  ${isCompleted ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/30' : 
                    isActive ? 'bg-[#4fc3f7] border-[#4fc3f7] shadow-lg shadow-[#4fc3f7]/30' : 
                    'bg-gray-700 border-gray-600'}
                `}>
                  {isCompleted ? (
                    <CheckCircle className="w-7 h-7 text-white" />
                  ) : (
                    <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  )}
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-[#4fc3f7] animate-ping opacity-40" />
                  )}
                </div>
                
                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 z-0 w-full">
                    <div className={`
                      h-1 w-full transition-all duration-500 relative overflow-hidden
                      ${(isCompleted || (isActive && index === currentStep - 1)) ? 
                        'bg-gradient-to-r from-[#4fc3f7] to-[#028bee]' : 'bg-gray-600'}
                    `}>
                      {(isCompleted || (isActive && index === currentStep - 1)) && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex mt-6">
          {steps.map((step, index) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            
            return (
              <div key={index} className="flex-1 text-center px-2">
                <div className={`font-medium text-sm transition-colors duration-300 ${
                  isCompleted ? 'text-green-400' : 
                  isActive ? 'text-[#4fc3f7]' : 
                  'text-gray-400'
                }`}>
                  {step.title}
                </div>
                <div className={`mt-1 text-xs transition-colors duration-300 ${
                  isCompleted ? 'text-green-300' : 
                  isActive ? 'text-[#4fc3f7]/80' : 
                  'text-gray-500'
                }`}>
                  {step.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="space-y-6">
        {/* Step 1: Connection */}
        {currentStep === 0 && (
          <Card className="p-4 bg-[#0a1930] border-[#4fc3f7]/30">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="w-5 h-5 text-[#4fc3f7]" />
              <h4 className="font-medium text-white">Connect to DKG Server</h4>
              <StatusLight 
                active={connectionStatus === 'connected'} 
                label={connectionStatus} 
                type={connectionStatus === 'connected' ? 'success' : 'default'}
              />
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Server URL
                </label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="ws://localhost:9034"
                  className="w-full px-3 py-2 bg-[#1a2347] border border-[#4fc3f7]/30 rounded-md text-white placeholder-gray-500"
                />
              </div>
              
              <Button
                onClick={onConnectToServer}
                disabled={connectionStatus === 'connecting' || connectionStatus === 'connected'}
                className="w-full"
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : 
                 connectionStatus === 'connected' ? 'Connected' : 'Connect to Server'}
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Authentication */}
        {currentStep === 1 && (
          <Card className="p-4 bg-[#0a1930] border-[#4fc3f7]/30">
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-5 h-5 text-[#4fc3f7]" />
              <h4 className="font-medium text-white">Authenticate with Wallet</h4>
              <StatusLight 
                active={authState.isAuthenticated} 
                label={authState.isAuthenticated ? 'Authenticated' : 'Not authenticated'} 
                type={authState.isAuthenticated ? 'success' : 'default'}
              />
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Sign a message with your wallet to prove ownership and generate your DKG identity.
              </p>
              
              {!authState.publicKeyHex && (
                <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3">
                  <p className="text-xs text-yellow-300">
                    ⚠️ First, we'll generate your DKG public key, then authenticate with the server.
                  </p>
                </div>
              )}
              
              {authState.publicKeyHex && (
                <div className="bg-[#1a2347] p-3 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Your Public Key:</p>
                  <code className="text-xs text-green-400 break-all">
                    {authState.publicKeyHex}
                  </code>
                </div>
              )}
              
              <Button
                onClick={async () => {
                  console.log('🔐 Quick Start: Authentication button clicked');
                  console.log('   Auth state:', authState);
                  console.log('   Connection status:', connectionStatus);
                  
                  try {
                    if (!authState.isAuthenticated) {
                      showToast({
                        type: 'info',
                        title: 'Authenticating...',
                        message: 'Please sign the message in your wallet',
                        duration: 3000
                      });
                      
                      // First get public key if we don't have it (this triggers challenge)
                      if (!authState.publicKeyHex) {
                        console.log('🔑 Getting public key first...');
                        await onGetPublicKey();
                        
                        // Wait a bit for the challenge to be processed
                        await new Promise(resolve => setTimeout(resolve, 500));
                      }
                      
                      // Then authenticate
                      console.log('🔐 Starting authentication...');
                      await onAuthenticate();
                      
                      // Check if authentication succeeded
                      setTimeout(() => {
                        if (authState.isAuthenticated) {
                          showToast({
                            type: 'success',
                            title: 'Authentication successful!',
                            message: 'You can now create or join sessions',
                            duration: 4000
                          });
                        }
                      }, 1000);
                    }
                  } catch (error) {
                    console.error('Authentication failed:', error);
                    showToast({
                      type: 'error',
                      title: 'Authentication failed',
                      message: error instanceof Error ? error.message : 'Please try again',
                      duration: 5000
                    });
                  }
                }}
                disabled={authState.isAuthenticated || connectionStatus !== 'connected'}
                className="w-full"
              >
                {authState.isAuthenticated 
                  ? '✅ Authenticated' 
                  : !authState.publicKeyHex 
                    ? '🔑 Generate Key & Authenticate'
                    : '✍️ Sign to Authenticate'
                }
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Choose Action */}
        {currentStep === 2 && (
          <Card className="p-4 bg-[#0a1930] border-[#4fc3f7]/30">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-[#4fc3f7]" />
              <h4 className="font-medium text-white">Choose Your Next Action</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quick Create Session */}
              <Card className="p-4 bg-[#1a2347] border-green-500/30 hover:border-green-500/60 transition-all">
                <div className="text-center mb-4">
                  <PlayCircle className="w-8 h-8 text-green-400 mx-auto mb-3" />
                  <h5 className="font-medium text-white mb-2">Create New Session</h5>
                  <p className="text-xs text-gray-400">Start a new threshold signature ceremony</p>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400">Threshold</label>
                      <input
                        type="number"
                        min="2"
                        max={quickSessionParams.participants}
                        value={quickSessionParams.threshold}
                        onChange={(e) => {
                          const value = Math.max(2, Math.min(parseInt(e.target.value) || 2, parseInt(quickSessionParams.participants)));
                          setQuickSessionParams(prev => ({ ...prev, threshold: value.toString() }));
                        }}
                        className="w-full px-2 py-1 bg-[#0a1930] border border-[#4fc3f7]/30 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4fc3f7]"
                        placeholder="2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Participants</label>
                      <input
                        type="number"
                        min="2"
                        max="127"
                        value={quickSessionParams.participants}
                        onChange={(e) => {
                          const value = Math.max(2, Math.min(parseInt(e.target.value) || 2, 127));
                          const newParams = { ...quickSessionParams, participants: value.toString() };
                          // Adjust threshold if it's higher than participants
                          if (parseInt(quickSessionParams.threshold) > value) {
                            newParams.threshold = value.toString();
                          }
                          setQuickSessionParams(newParams);
                        }}
                        className="w-full px-2 py-1 bg-[#0a1930] border border-[#4fc3f7]/30 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#4fc3f7]"
                        placeholder="2"
                      />
                    </div>
                  </div>
                  
                  {/* Configuration Info */}
                  <div className="text-xs text-gray-400 bg-[#0a1930]/50 p-2 rounded border border-[#4fc3f7]/20">
                    <div className="mb-1">
                      📊 <strong>Configuration:</strong> {quickSessionParams.threshold}-of-{quickSessionParams.participants} threshold signature
                    </div>
                    <div className="text-gray-500">
                      • Threshold: Minimum signatures required ({quickSessionParams.threshold})
                    </div>
                    <div className="text-gray-500">
                      • Participants: Fixed number of participants ({quickSessionParams.participants})
                    </div>
                    <div className="text-gray-500">
                      • FROST supports up to 127 participants
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleQuickCreate}
                    disabled={isCreatingSession}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    {isCreatingSession ? 'Creating...' : 'Create Session'}
                  </Button>
                </div>
              </Card>

              {/* Join Existing */}
              <Card className="p-4 bg-[#1a2347] border-blue-500/30 hover:border-blue-500/60 transition-all">
                <div className="text-center mb-4">
                  <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                  <h5 className="font-medium text-white mb-2">Join Existing</h5>
                  <p className="text-xs text-gray-400">Participate in an ongoing ceremony</p>
                </div>
                
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{sessions.length}</div>
                    <div className="text-xs text-gray-400">Available Sessions</div>
                  </div>
                  
                  {sessions.length > 0 ? (
                    <Button 
                      onClick={() => onSwitchToSessionsTab()}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      View Sessions
                    </Button>
                  ) : (
                    <Button 
                      disabled
                      className="w-full"
                      size="sm"
                    >
                      No Sessions Available
                    </Button>
                  )}
                </div>
              </Card>
            </div>

            {/* Info Box */}
            <Card className="mt-4 p-3 bg-blue-900/20 border-blue-500/50">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-200">
                  <strong>Tip:</strong> Use "Create Session" to start a new ceremony where others can join, 
                  or "Join Existing" to participate in a session someone else created.
                </div>
              </div>
            </Card>
          </Card>
        )}
      </div>

      {/* Roaster Address Banner Modal */}
      {showRoasterBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => setShowRoasterBanner(false)}
          />
          
          {/* Modal */}
          <div className="relative z-10 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-2 border-[#4fc3f7] rounded-lg shadow-2xl w-full max-w-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
            {/* Header */}
            <div className="p-6 border-b border-[#4fc3f7]/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#4fc3f7]/20 border border-[#4fc3f7]/50 rounded-lg flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-[#4fc3f7]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Provide Roaster Addresses</h3>
                    <p className="text-sm text-gray-400">Enter the public key addresses for all participants</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRoasterBanner(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-200">
                    <p className="font-medium mb-1">Required: {quickSessionParams.participants} participant addresses</p>
                    <p>Please paste the public key addresses for all participants, one per line. Each address should be a valid cryptographic public key in hex format.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Roaster Addresses ({roasterAddresses.trim().split('\n').filter(line => line.trim()).length}/{quickSessionParams.participants})
                </label>
                <textarea
                  value={roasterAddresses}
                  onChange={(e) => setRoasterAddresses(e.target.value)}
                  placeholder={`Enter ${quickSessionParams.participants} public key addresses, one per line:\n\n0x1234567890abcdef...\n0x9876543210fedcba...\n...`}
                  rows={8}
                  className="w-full px-4 py-3 bg-[#0a1930] border border-[#4fc3f7]/30 rounded-lg text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] resize-none"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowRoasterBanner(false);
                    setRoasterAddresses('');
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateWithAddresses}
                  disabled={isCreatingSession || roasterAddresses.trim().split('\n').filter(line => line.trim()).length !== parseInt(quickSessionParams.participants)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isCreatingSession ? 'Creating Session...' : 'Create DKG Session'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}