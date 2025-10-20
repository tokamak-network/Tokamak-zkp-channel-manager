/**
 * Console Error Filter
 * Suppresses common browser extension errors that don't affect application functionality
 */

import React from 'react';

interface ErrorPattern {
  pattern: string | RegExp;
  description: string;
  source: string;
}

// Common browser extension error patterns to suppress
const EXTENSION_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /:has-text\(\)/,
    description: 'Invalid :has-text() pseudo-class used by browser extensions',
    source: 'Browser Extension'
  },
  {
    pattern: /content-scripts\.js/,
    description: 'Browser extension content script errors',
    source: 'Browser Extension'
  },
  {
    pattern: /Failed to parse selector.*:has-text/,
    description: 'CSS selector parsing errors from extensions',
    source: 'Browser Extension'
  },
  {
    pattern: /chrome-extension:\/\//,
    description: 'Chrome extension errors',
    source: 'Chrome Extension'
  },
  {
    pattern: /moz-extension:\/\//,
    description: 'Firefox extension errors',
    source: 'Firefox Extension'
  },
  {
    pattern: /safari-web-extension:\/\//,
    description: 'Safari extension errors',
    source: 'Safari Extension'
  },
  {
    pattern: /Non-Error promise rejection captured/,
    description: 'Extension promise rejection warnings',
    source: 'Browser Extension'
  },
  {
    pattern: /Script error\./,
    description: 'Generic script errors often from extensions',
    source: 'Browser Extension'
  }
];

// Application-specific errors we want to keep
const IMPORTANT_ERROR_PATTERNS: (string | RegExp)[] = [
  /DKG/i,
  /FROST/i,
  /WebSocket/i,
  /Authentication/i,
  /ECIES/i,
  /TypeError/,
  /ReferenceError/,
  /Network Error/i,
  /Failed to fetch/i
];

class ConsoleErrorFilter {
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private suppressedCount = 0;
  private isEnabled = false;

  constructor() {
    this.originalConsoleError = console.error.bind(console);
    this.originalConsoleWarn = console.warn.bind(console);
  }

  private shouldSuppressError(message: string): { suppress: boolean; reason?: string } {
    // Never suppress application-critical errors
    for (const pattern of IMPORTANT_ERROR_PATTERNS) {
      if (typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message)) {
        return { suppress: false };
      }
    }

    // Check if this matches a known extension error pattern
    for (const errorPattern of EXTENSION_ERROR_PATTERNS) {
      const matches = typeof errorPattern.pattern === 'string' 
        ? message.includes(errorPattern.pattern)
        : errorPattern.pattern.test(message);
        
      if (matches) {
        return { 
          suppress: true, 
          reason: `${errorPattern.description} (${errorPattern.source})` 
        };
      }
    }

    return { suppress: false };
  }

  private filteredConsoleError = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    const suppressInfo = this.shouldSuppressError(message);

    if (suppressInfo.suppress) {
      this.suppressedCount++;
      
      // Log suppressed errors in development mode for debugging
      if (process.env.NODE_ENV === 'development') {
        this.originalConsoleWarn(
          `🔇 Suppressed extension error #${this.suppressedCount}:`,
          suppressInfo.reason,
          '\nOriginal message:',
          message.slice(0, 100) + (message.length > 100 ? '...' : '')
        );
      }
      return;
    }

    // Allow important errors through
    this.originalConsoleError(...args);
  };

  private filteredConsoleWarn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    const suppressInfo = this.shouldSuppressError(message);

    if (suppressInfo.suppress) {
      this.suppressedCount++;
      return;
    }

    // Allow important warnings through
    this.originalConsoleWarn(...args);
  };

  /**
   * Enable console error filtering
   */
  enable(): void {
    if (this.isEnabled) return;

    console.error = this.filteredConsoleError;
    console.warn = this.filteredConsoleWarn;
    this.isEnabled = true;

    console.log('🛡️ Console error filter enabled - Extension errors will be suppressed');
  }

  /**
   * Disable console error filtering and restore original console methods
   */
  disable(): void {
    if (!this.isEnabled) return;

    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    this.isEnabled = false;

    console.log('🔊 Console error filter disabled - All errors will be shown');
  }

  /**
   * Get statistics about suppressed errors
   */
  getStats(): { suppressedCount: number; isEnabled: boolean } {
    return {
      suppressedCount: this.suppressedCount,
      isEnabled: this.isEnabled
    };
  }

  /**
   * Reset suppressed error count
   */
  resetStats(): void {
    this.suppressedCount = 0;
  }

  /**
   * Add a custom error pattern to suppress
   */
  addPattern(pattern: string | RegExp, description: string, source: string = 'Custom'): void {
    EXTENSION_ERROR_PATTERNS.push({ pattern, description, source });
  }
}

// Create singleton instance
export const consoleErrorFilter = new ConsoleErrorFilter();

/**
 * React hook to enable console error filtering
 */
export function useConsoleErrorFilter(enabled: boolean = true) {
  if (typeof window === 'undefined') return; // SSR safety

  React.useEffect(() => {
    if (enabled) {
      consoleErrorFilter.enable();
    } else {
      consoleErrorFilter.disable();
    }

    return () => {
      consoleErrorFilter.disable();
    };
  }, [enabled]);

  return consoleErrorFilter;
}

// For non-React usage
export function enableConsoleErrorFilter(): void {
  consoleErrorFilter.enable();
}

export function disableConsoleErrorFilter(): void {
  consoleErrorFilter.disable();
}

export default consoleErrorFilter;