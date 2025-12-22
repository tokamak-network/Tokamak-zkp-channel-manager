'use client';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-gray-300 border-t-[#4fc3f7]",
          sizeClasses[size]
        )}
      />
      {text && (
        <span className="text-sm text-gray-400 animate-pulse">{text}</span>
      )}
    </div>
  );
}

export function LoadingOverlay({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1a2347] border border-[#4fc3f7]/30 rounded-lg p-6 flex items-center gap-4 shadow-xl">
        <LoadingSpinner size="lg" />
        <span className="text-white font-medium">{text}</span>
      </div>
    </div>
  );
}

export function LoadingCard({ 
  title = 'Loading...', 
  description = 'Please wait while we process your request',
  className 
}: { 
  title?: string; 
  description?: string; 
  className?: string; 
}) {
  return (
    <div className={cn(
      "p-8 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border border-[#4fc3f7]/30 rounded-lg",
      className
    )}>
      <div className="text-center space-y-4">
        <LoadingSpinner size="xl" />
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}