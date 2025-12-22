'use client';

import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  color?: 'default' | 'success' | 'warning' | 'error';
}

export function Progress({ 
  value, 
  max = 100, 
  className, 
  showLabel = true, 
  label,
  animated = false,
  color = 'default'
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const getColorClasses = () => {
    switch (color) {
      case 'success':
        return 'from-green-500 to-green-600';
      case 'warning':
        return 'from-yellow-500 to-yellow-600';
      case 'error':
        return 'from-red-500 to-red-600';
      default:
        return 'from-[#4fc3f7] to-[#028bee]';
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-300 font-medium">
            {label || 'Progress'}
          </span>
          <span className="text-white font-semibold">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className="w-full h-2 bg-[#0a1930] border border-[#4fc3f7]/20 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full bg-gradient-to-r transition-all duration-500 ease-out",
            getColorClasses(),
            animated && "animate-pulse"
          )}
          style={{ width: `${percentage}%` }}
        >
          {animated && (
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>
      </div>
    </div>
  );
}

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
  color?: 'default' | 'success' | 'warning' | 'error';
  strokeWidth?: number;
}

export function CircularProgress({
  value,
  max = 100,
  size = 'md',
  className,
  showLabel = true,
  color = 'default',
  strokeWidth = 8
}: CircularProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const sizeMap = {
    sm: 40,
    md: 60,
    lg: 80
  };
  
  const radius = (sizeMap[size] - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getStrokeColor = () => {
    switch (color) {
      case 'success':
        return 'stroke-green-500';
      case 'warning':
        return 'stroke-yellow-500';
      case 'error':
        return 'stroke-red-500';
      default:
        return 'stroke-[#4fc3f7]';
    }
  };

  return (
    <div className={cn("relative", className)}>
      <svg
        width={sizeMap[size]}
        height={sizeMap[size]}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={sizeMap[size] / 2}
          cy={sizeMap[size] / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={sizeMap[size] / 2}
          cy={sizeMap[size] / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn("transition-all duration-500 ease-out", getStrokeColor())}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-white">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}