'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface DKGAutomationStatusProps {
  isAutomationEnabled: boolean;
  activeAutomations: string[];
  onToggleAutomation?: () => void;
}

export function DKGAutomationStatus({
  isAutomationEnabled,
  activeAutomations,
  onToggleAutomation
}: DKGAutomationStatusProps) {
  const hasActiveAutomations = activeAutomations.length > 0;

  return (
    <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Automated DKG Status
          </h3>
          <Badge variant={isAutomationEnabled ? "default" : "secondary"}>
            {isAutomationEnabled ? "Enabled" : "Manual Mode"}
          </Badge>
        </div>
        {onToggleAutomation && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAutomation}
            className="text-blue-600 dark:text-blue-400"
          >
            {isAutomationEnabled ? "Disable Auto" : "Enable Auto"}
          </Button>
        )}
      </div>

      <div className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
        {isAutomationEnabled ? (
          <div>
            <p className="mb-2">
              Automation is active. DKG rounds will be processed automatically without user intervention.
            </p>
            
            {hasActiveAutomations && (
              <div className="mb-2">
                <p className="font-medium flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Active Automations:
                </p>
                <ul className="list-disc list-inside ml-2">
                  {activeAutomations.map(sessionId => (
                    <li key={sessionId}>
                      Session {sessionId.slice(0, 8)}... (processing)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!hasActiveAutomations && (
              <p className="text-blue-600 dark:text-blue-400">
                No active DKG sessions. Create or join a session to begin.
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Manual mode is active. You will need to manually submit each DKG round.
            </p>
            <p className="text-blue-600 dark:text-blue-400">
              Enable automation for a smoother experience as recommended in the protocol FAQ.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-600 dark:text-blue-400">
          <strong>FAQ Q5:</strong> Most DKG steps are automated to minimize user interaction. 
          Only session creation/joining requires manual input.
        </p>
      </div>
    </Card>
  );
}