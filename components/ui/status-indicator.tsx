'use client';

import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status: 'idle' | 'connecting' | 'connected' | 'round1' | 'round2' | 'finalizing' | 'completed' | 'failed';
  label: string;
  className?: string;
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'idle':
        return 'bg-gray-500/50 border-gray-500/30';
      case 'connecting':
        return 'bg-yellow-500/50 border-yellow-500/30 animate-pulse';
      case 'connected':
        return 'bg-blue-500/50 border-blue-500/30';
      case 'round1':
      case 'round2':
        return 'bg-orange-500/50 border-orange-500/30 animate-pulse';
      case 'finalizing':
        return 'bg-purple-500/50 border-purple-500/30 animate-pulse';
      case 'completed':
        return 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50 animate-pulse';
      case 'failed':
        return 'bg-red-500/50 border-red-500/30';
      default:
        return 'bg-gray-500/50 border-gray-500/30';
    }
  };

  const isActive = ['connecting', 'connected', 'round1', 'round2', 'finalizing', 'completed'].includes(status);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <div
          className={cn(
            "w-3 h-3 rounded-full border-2 transition-all duration-500",
            getStatusColor()
          )}
        />
        {status === 'completed' && (
          <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75" />
        )}
      </div>
      <span className={cn(
        "text-sm font-medium transition-colors",
        isActive ? "text-white" : "text-gray-400"
      )}>
        {label}
      </span>
    </div>
  );
}

interface StatusLightProps {
  active: boolean;
  label: string;
  type?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

export function StatusLight({ active, label, type = 'default', className }: StatusLightProps) {
  const getTypeColor = () => {
    if (!active) return 'bg-gray-500/30 border-gray-500/20';
    
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50';
      case 'warning':
        return 'bg-yellow-500 border-yellow-400 shadow-lg shadow-yellow-500/50';
      case 'error':
        return 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50';
      default:
        return 'bg-blue-500 border-blue-400 shadow-lg shadow-blue-500/50';
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <div
          className={cn(
            "w-4 h-4 rounded-full border-2 transition-all duration-300",
            getTypeColor(),
            active && "animate-pulse"
          )}
        />
        {active && type === 'success' && (
          <div className="absolute inset-0 w-4 h-4 rounded-full bg-green-400 animate-ping opacity-75" />
        )}
      </div>
      <span className={cn(
        "text-sm font-medium transition-colors",
        active ? "text-white" : "text-gray-400"
      )}>
        {label}
      </span>
    </div>
  );
}