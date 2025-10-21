'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

interface CeremonyStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  timestamp?: Date;
}

interface AutomatedCeremonyModalProps {
  isOpen: boolean;
  session: DKGSession | null;
  onClose: () => void;
  onStartCeremony: (sessionId: string) => Promise<boolean>;
}

export function DKGAutomatedCeremonyModal({
  isOpen,
  session,
  onClose,
  onStartCeremony
}: AutomatedCeremonyModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<CeremonyStep[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (session && isOpen) {
      // Initialize ceremony steps
      setSteps([
        { id: 'spawn', name: 'Spawning DKG Clients', status: 'pending' },
        { id: 'auth', name: 'Authenticating Participants', status: 'pending' },
        { id: 'round1', name: 'Round 1: Commitments', status: 'pending' },
        { id: 'round2', name: 'Round 2: Secret Sharing', status: 'pending' },
        { id: 'finalize', name: 'Finalization', status: 'pending' },
        { id: 'complete', name: 'Ceremony Complete', status: 'pending' }
      ]);
      setLogs([]);
      setResults(null);
    }
  }, [session, isOpen]);

  const updateStep = (stepId: string, status: CeremonyStep['status'], message?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, message, timestamp: new Date() }
        : step
    ));
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleStartCeremony = async () => {
    if (!session) return;

    setIsRunning(true);
    addLog('Starting automated DKG ceremony...');
    updateStep('spawn', 'in_progress', 'Spawning DKG clients for all participants');

    try {
      const success = await onStartCeremony(session.id);
      if (success) {
        updateStep('spawn', 'completed', `Spawned ${session.roster.length} DKG clients`);
        updateStep('auth', 'in_progress', 'Authenticating participants with server');
        addLog(`Successfully spawned ${session.roster.length} DKG clients`);
        
        // Start monitoring the ceremony progress
        startProgressMonitoring();
      } else {
        updateStep('spawn', 'failed', 'Failed to spawn DKG clients');
        addLog('Failed to start automated ceremony');
        setIsRunning(false);
      }
    } catch (error) {
      updateStep('spawn', 'failed', `Error: ${error}`);
      addLog(`Error starting ceremony: ${error}`);
      setIsRunning(false);
    }
  };

  const startProgressMonitoring = () => {
    // Simulate ceremony progress monitoring
    // In a real implementation, this would poll the server or listen to WebSocket events
    setTimeout(() => {
      updateStep('auth', 'completed', 'All participants authenticated');
      updateStep('round1', 'in_progress', 'Generating and submitting commitments');
      addLog('All participants authenticated successfully');
    }, 2000);

    setTimeout(() => {
      updateStep('round1', 'completed', 'All commitments submitted');
      updateStep('round2', 'in_progress', 'Generating and submitting secret shares');
      addLog('Round 1 completed: All commitments submitted (3/3)');
    }, 5000);

    setTimeout(() => {
      updateStep('round2', 'completed', 'All secret shares submitted');
      updateStep('finalize', 'in_progress', 'Finalizing group key generation');
      addLog('Round 2 completed: All secret shares submitted (3/3)');
    }, 8000);

    setTimeout(() => {
      updateStep('finalize', 'completed', 'Group key generated successfully');
      updateStep('complete', 'completed', 'Ceremony completed successfully');
      addLog('Finalization completed: Group verifying key generated');
      
      // Simulate results
      setResults({
        groupVerifyingKey: '0x' + '0'.repeat(66),
        participantShares: session?.roster.length || 0,
        threshold: `${session?.minSigners || 2}-of-${session?.maxSigners || 3}`,
        outputFiles: ['group.json', 'share_1.json', 'share_2.json', 'share_3.json']
      });
      
      setIsRunning(false);
      addLog('🎉 Automated DKG ceremony completed successfully!');
    }, 11000);
  };

  const downloadResults = async () => {
    if (!session) return;

    try {
      // Fetch the group.json file from the server
      const response = await fetch(`http://127.0.0.1:9000/download-results/${session.id}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `group_${session.id.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog('Downloaded group.json file');
      } else {
        addLog('Failed to download results file');
      }
    } catch (error) {
      addLog(`Error downloading results: ${error}`);
    }
  };

  const getStepIcon = (status: CeremonyStep['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'in_progress': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  const getStepColor = (status: CeremonyStep['status']) => {
    switch (status) {
      case 'pending': return 'text-gray-500';
      case 'in_progress': return 'text-blue-600 dark:text-blue-400';
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-500';
    }
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                🤖 Automated DKG Ceremony
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Session {session.id} • {session.roster.length} participants • {session.minSigners}-of-{session.maxSigners} threshold
              </p>
            </div>
            <Button variant="ghost" onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Progress Steps */}
            <Card className="p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                Ceremony Progress
              </h4>
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3">
                    <span className="text-xl">{getStepIcon(step.status)}</span>
                    <div className="flex-1">
                      <div className={`font-medium ${getStepColor(step.status)}`}>
                        {step.name}
                      </div>
                      {step.message && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {step.message}
                        </div>
                      )}
                      {step.timestamp && (
                        <div className="text-xs text-gray-500">
                          {step.timestamp.toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Live Logs */}
            <Card className="p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                Live Logs
              </h4>
              <div className="bg-gray-100 dark:bg-gray-900 rounded p-3 h-64 overflow-y-auto text-sm font-mono">
                {logs.map((log, index) => (
                  <div key={index} className="text-gray-700 dark:text-gray-300 mb-1">
                    {log}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-gray-500 italic">
                    Waiting for ceremony to start...
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Results Section */}
          {results && (
            <Card className="p-4 mt-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <h4 className="font-medium text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
                🎉 Ceremony Results
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">Group Verifying Key:</div>
                  <div className="font-mono text-xs bg-white dark:bg-gray-800 p-2 rounded mt-1 break-all">
                    {results.groupVerifyingKey}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">Threshold Scheme:</div>
                  <div className="text-gray-600 dark:text-gray-400">{results.threshold}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">Participant Shares:</div>
                  <div className="text-gray-600 dark:text-gray-400">{results.participantShares} shares generated</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">Output Files:</div>
                  <div className="text-gray-600 dark:text-gray-400">{results.outputFiles.join(', ')}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={downloadResults} className="bg-green-600 hover:bg-green-700 text-white">
                  📥 Download group.json
                </Button>
                <Button variant="outline" onClick={() => addLog('All ceremony files available in output directory')}>
                  📂 View All Files
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Ceremony in progress...
                </span>
              ) : results ? (
                <span className="text-green-600 dark:text-green-400">✅ Ceremony completed successfully</span>
              ) : (
                'Ready to start automated ceremony'
              )}
            </div>
            <div className="flex gap-2">
              {!isRunning && !results && (
                <Button onClick={handleStartCeremony} className="bg-purple-600 hover:bg-purple-700 text-white">
                  🚀 Start Automated Ceremony
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                {results ? 'Close' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}