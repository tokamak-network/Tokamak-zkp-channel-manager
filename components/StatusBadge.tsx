'use client';

import { Badge } from '@/components/ui/badge';
import { ChannelState, getChannelStateLabel } from '@/lib/types';

interface StatusBadgeProps {
  state: ChannelState;
  className?: string;
}

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const getVariant = (state: ChannelState) => {
    switch (state) {
      case ChannelState.Open:
      case ChannelState.Active:
        return 'active' as const;
      case ChannelState.Initialized:
      case ChannelState.Closing:
        return 'pending' as const;
      case ChannelState.Closed:
        return 'inactive' as const;
      default:
        return 'error' as const;
    }
  };

  return (
    <Badge 
      variant={getVariant(state)} 
      className={className}
    >
      {getChannelStateLabel(state)}
    </Badge>
  );
}