'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Cpu, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface DKGWasmStatusProps {
  isReady: boolean;
  isLoading?: boolean;
  error?: string | null;
}

export function DKGWasmStatus({ isReady, isLoading = false, error }: DKGWasmStatusProps) {
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

  if (isReady) {
    return (
      <Card className="p-3 bg-gradient-to-b from-green-900/20 to-green-900/10 border-green-500/30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Cpu className="w-4 h-4 text-green-400" />
            <CheckCircle2 className="w-3 h-3 text-green-400 absolute -top-1 -right-1" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-300">
              FROST WASM Ready
            </span>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
              Real Cryptography
            </Badge>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}

