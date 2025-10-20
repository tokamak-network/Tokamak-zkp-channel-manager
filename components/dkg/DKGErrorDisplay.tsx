'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DKGErrorHandler } from '@/lib/dkg-error-handler';

interface DKGErrorDisplayProps {
  error: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function DKGErrorDisplay({ error, onDismiss, onRetry }: DKGErrorDisplayProps) {
  // Parse the error to get detailed information
  const parsedError = DKGErrorHandler.parseError(error);
  const formattedError = DKGErrorHandler.formatErrorForUser(parsedError);

  const getErrorIcon = () => {
    switch (parsedError.type) {
      case 'CONNECTION_ERROR':
        return '🔌';
      case 'AUTHENTICATION_ERROR':
        return '🔐';
      case 'SESSION_ERROR':
        return '👥';
      case 'ENCRYPTION_ERROR':
        return '🔒';
      case 'TIMEOUT_ERROR':
        return '⏰';
      case 'VALIDATION_ERROR':
        return '⚠️';
      case 'PROTOCOL_ERROR':
        return '⚙️';
      case 'NETWORK_ERROR':
        return '🌐';
      default:
        return '❌';
    }
  };

  const getErrorColor = () => {
    return parsedError.recoverable ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
  };

  const getTextColor = () => {
    return parsedError.recoverable ? 'text-orange-700 dark:text-orange-300' : 'text-red-700 dark:text-red-300';
  };

  const getTitleColor = () => {
    return parsedError.recoverable ? 'text-orange-900 dark:text-orange-100' : 'text-red-900 dark:text-red-100';
  };

  return (
    <Card className={`p-4 ${getErrorColor()}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0 mt-1">
          {getErrorIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`text-sm font-semibold ${getTitleColor()}`}>
              {formattedError.title}
            </h3>
            <Badge variant={parsedError.recoverable ? "secondary" : "destructive"} className="text-xs">
              {parsedError.recoverable ? "Recoverable" : "Critical"}
            </Badge>
          </div>
          
          <p className={`text-sm ${getTextColor()} mb-3`}>
            {formattedError.message}
          </p>

          {formattedError.suggestions.length > 0 && (
            <div className="mb-3">
              <p className={`text-xs font-medium ${getTitleColor()} mb-2`}>
                💡 Suggested Solutions:
              </p>
              <ul className={`text-xs ${getTextColor()} space-y-1`}>
                {formattedError.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span className="text-xs mt-0.5">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDismiss}
              className={`text-xs ${parsedError.recoverable ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30' : 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'}`}
            >
              Dismiss
            </Button>
            
            {formattedError.canRetry && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className={`text-xs ${parsedError.recoverable ? 'text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30' : 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'}`}
              >
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>

      {parsedError.metadata && Object.keys(parsedError.metadata).length > 0 && (
        <details className="mt-3 pt-3 border-t border-current/20">
          <summary className={`text-xs cursor-pointer ${getTextColor()} opacity-75 hover:opacity-100`}>
            Technical Details
          </summary>
          <div className={`mt-2 text-xs ${getTextColor()} opacity-75 font-mono`}>
            <div><strong>Error Code:</strong> {parsedError.code}</div>
            <div><strong>Type:</strong> {parsedError.type}</div>
            {parsedError.metadata.sessionId && (
              <div><strong>Session:</strong> {parsedError.metadata.sessionId}</div>
            )}
            {parsedError.metadata.phase && (
              <div><strong>Phase:</strong> {parsedError.metadata.phase}</div>
            )}
          </div>
        </details>
      )}
    </Card>
  );
}