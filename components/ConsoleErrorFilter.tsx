'use client';

import { useEffect } from 'react';
import { consoleErrorFilter } from '@/lib/console-error-filter';

interface ConsoleErrorFilterProps {
  enabled?: boolean;
  showStats?: boolean;
}

export function ConsoleErrorFilter({ 
  enabled = true, 
  showStats = process.env.NODE_ENV === 'development' 
}: ConsoleErrorFilterProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (enabled) {
      consoleErrorFilter.enable();
      
      if (showStats) {
        // Show stats after 10 seconds in development
        const statsTimer = setTimeout(() => {
          const stats = consoleErrorFilter.getStats();
          if (stats.suppressedCount > 0) {
            console.log(
              `🛡️ Console Error Filter Stats: ${stats.suppressedCount} extension errors suppressed`
            );
          }
        }, 10000);

        return () => {
          clearTimeout(statsTimer);
          consoleErrorFilter.disable();
        };
      }
    } else {
      consoleErrorFilter.disable();
    }

    return () => {
      consoleErrorFilter.disable();
    };
  }, [enabled, showStats]);

  // Add some common patterns specific to popular extensions
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Add patterns for popular password managers and extensions
    const commonExtensionPatterns = [
      // LastPass
      { pattern: /lastpass/i, description: 'LastPass password manager errors', source: 'LastPass' },
      // Bitwarden
      { pattern: /bitwarden/i, description: 'Bitwarden password manager errors', source: 'Bitwarden' },
      // 1Password
      { pattern: /1password/i, description: '1Password extension errors', source: '1Password' },
      // Grammarly
      { pattern: /grammarly/i, description: 'Grammarly extension errors', source: 'Grammarly' },
      // AdBlock
      { pattern: /adblock/i, description: 'Ad blocker extension errors', source: 'AdBlock' },
      // uBlock Origin
      { pattern: /ublock/i, description: 'uBlock Origin extension errors', source: 'uBlock' },
      // Honey
      { pattern: /honey/i, description: 'Honey coupon extension errors', source: 'Honey' },
      // React DevTools (in production)
      { pattern: /react.*devtools/i, description: 'React DevTools extension errors', source: 'React DevTools' },
      // Redux DevTools (in production)
      { pattern: /redux.*devtools/i, description: 'Redux DevTools extension errors', source: 'Redux DevTools' },
      // MetaMask (only suppress non-critical errors)
      { pattern: /Failed to parse selector.*metamask/i, description: 'MetaMask CSS selector errors', source: 'MetaMask' },
    ];

    commonExtensionPatterns.forEach(({ pattern, description, source }) => {
      consoleErrorFilter.addPattern(pattern, description, source);
    });
  }, []);

  return null; // This component doesn't render anything
}

export default ConsoleErrorFilter;