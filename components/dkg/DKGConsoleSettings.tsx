'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { consoleErrorFilter } from '@/lib/console-error-filter';

interface DKGConsoleSettingsProps {
  className?: string;
}

export function DKGConsoleSettings({ className }: DKGConsoleSettingsProps) {
  const [stats, setStats] = useState({ suppressedCount: 0, isEnabled: false });
  const [isExpanded, setIsExpanded] = useState(false);

  // Update stats every few seconds
  useEffect(() => {
    const updateStats = () => {
      setStats(consoleErrorFilter.getStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleFilter = () => {
    if (stats.isEnabled) {
      consoleErrorFilter.disable();
    } else {
      consoleErrorFilter.enable();
    }
    setStats(consoleErrorFilter.getStats());
  };

  const handleResetStats = () => {
    consoleErrorFilter.resetStats();
    setStats(consoleErrorFilter.getStats());
  };

  if (!isExpanded) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          🛡️ Console Filter
          {stats.suppressedCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {stats.suppressedCount}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card className={`p-3 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            🛡️ Console Error Filter
          </h4>
          <Badge variant={stats.isEnabled ? "default" : "secondary"}>
            {stats.isEnabled ? "Active" : "Disabled"}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ✕
        </Button>
      </div>

      <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center justify-between">
          <span>Extension errors suppressed:</span>
          <Badge variant="outline" className="text-xs">
            {stats.suppressedCount}
          </Badge>
        </div>

        <p className="text-xs">
          This filter suppresses console errors from browser extensions (password managers, ad blockers, etc.) 
          that don't affect the DKG application functionality.
        </p>

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleFilter}
            className="text-xs"
          >
            {stats.isEnabled ? "Disable Filter" : "Enable Filter"}
          </Button>
          
          {stats.suppressedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetStats}
              className="text-xs"
            >
              Reset Count
            </Button>
          )}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              💻 Development mode: Check browser console for detailed suppression logs
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default DKGConsoleSettings;