'use client';

import { useState } from 'react';
import { Button } from './button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from './toast';

interface RetryButtonProps {
  onRetry: () => Promise<void> | void;
  disabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  children?: React.ReactNode;
}

export function RetryButton({ 
  onRetry, 
  disabled = false, 
  maxRetries = 3,
  retryDelay = 1000,
  className,
  variant = 'outline',
  size = 'default',
  children = 'Retry'
}: RetryButtonProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { showToast } = useToast();

  const handleRetry = async () => {
    if (retryCount >= maxRetries) {
      showToast({
        type: 'error',
        title: 'Maximum retries reached',
        message: 'Please try again later or contact support'
      });
      return;
    }

    setIsRetrying(true);
    
    try {
      // Add delay for exponential backoff
      const delay = retryDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      await onRetry();
      
      // Reset retry count on success
      setRetryCount(0);
      showToast({
        type: 'success',
        title: 'Retry successful!',
        duration: 2000
      });
    } catch (error) {
      setRetryCount(prev => prev + 1);
      showToast({
        type: 'error',
        title: `Retry ${retryCount + 1} failed`,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const isMaxRetriesReached = retryCount >= maxRetries;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRetry}
      disabled={disabled || isRetrying || isMaxRetriesReached}
      className={className}
    >
      {isRetrying ? (
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
      ) : isMaxRetriesReached ? (
        <AlertCircle className="w-4 h-4 mr-2" />
      ) : (
        <RefreshCw className="w-4 h-4 mr-2" />
      )}
      {isRetrying ? 'Retrying...' : 
       isMaxRetriesReached ? 'Max retries reached' : 
       `${children}${retryCount > 0 ? ` (${retryCount}/${maxRetries})` : ''}`}
    </Button>
  );
}

interface AutoRetryProps {
  onRetry: () => Promise<void> | void;
  maxRetries?: number;
  retryDelay?: number;
  children: (retryState: {
    retryCount: number;
    isRetrying: boolean;
    retry: () => void;
    canRetry: boolean;
  }) => React.ReactNode;
}

export function useAutoRetry({
  onRetry,
  maxRetries = 3,
  retryDelay = 1000
}: Omit<AutoRetryProps, 'children'>) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { showToast } = useToast();

  const retry = async () => {
    if (retryCount >= maxRetries) {
      showToast({
        type: 'error',
        title: 'Maximum retries reached',
        message: 'Please try again later'
      });
      return;
    }

    setIsRetrying(true);
    
    try {
      const delay = retryDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      await onRetry();
      setRetryCount(0);
      
      if (retryCount > 0) {
        showToast({
          type: 'success',
          title: 'Operation successful after retry',
          duration: 2000
        });
      }
    } catch (error) {
      setRetryCount(prev => prev + 1);
      
      if (retryCount + 1 < maxRetries) {
        showToast({
          type: 'warning',
          title: `Attempt ${retryCount + 1} failed`,
          message: `Retrying in ${Math.ceil((retryDelay * Math.pow(2, retryCount + 1)) / 1000)}s...`,
          duration: 3000
        });
        
        // Auto retry after delay
        setTimeout(() => {
          retry();
        }, retryDelay * Math.pow(2, retryCount + 1));
      } else {
        showToast({
          type: 'error',
          title: 'All retry attempts failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } finally {
      setIsRetrying(false);
    }
  };

  return {
    retryCount,
    isRetrying,
    retry,
    canRetry: retryCount < maxRetries && !isRetrying
  };
}