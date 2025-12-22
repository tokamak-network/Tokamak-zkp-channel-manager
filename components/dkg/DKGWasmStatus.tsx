'use client';

import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

interface DKGWasmStatusProps {
  isLoading?: boolean;
  error?: string | null;
}

export function DKGWasmStatus({ isLoading = false, error }: DKGWasmStatusProps) {
  if (isLoading) {
    return (
      <Card className="p-3 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-[#4fc3f7]/30">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-[#4fc3f7] animate-spin" />
          <span className="text-sm text-gray-300">
            Initializing FROST cryptography module...
          </span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-3 bg-gradient-to-b from-red-900/20 to-red-900/10 border-red-500/50">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-300">
            Cryptography module error: {error}
          </span>
        </div>
      </Card>
    );
  }


  return null;
}

