/**
 * DKG Session Timeout Management
 * Handles timeouts for unresponsive participants according to FAQ specifications
 */

export interface DKGTimeoutConfig {
  sessionJoinTimeout: number;    // Time to wait for all participants to join (ms)
  round1Timeout: number;         // Time to wait for Round 1 commitments (ms)
  round2Timeout: number;         // Time to wait for Round 2 encrypted shares (ms)
  finalizeTimeout: number;       // Time to wait for finalization (ms)
}

export const DEFAULT_TIMEOUT_CONFIG: DKGTimeoutConfig = {
  sessionJoinTimeout: 5 * 60 * 1000,  // 5 minutes
  round1Timeout: 3 * 60 * 1000,       // 3 minutes
  round2Timeout: 5 * 60 * 1000,       // 5 minutes (encryption takes longer)
  finalizeTimeout: 2 * 60 * 1000,     // 2 minutes
};

export interface SessionTimeout {
  sessionId: string;
  phase: 'joining' | 'round1' | 'round2' | 'finalizing';
  startTime: number;
  timeoutMs: number;
  timeoutId: NodeJS.Timeout;
}

export class DKGTimeoutManager {
  private timeouts: Map<string, SessionTimeout> = new Map();
  private config: DKGTimeoutConfig;

  constructor(config: DKGTimeoutConfig = DEFAULT_TIMEOUT_CONFIG) {
    this.config = config;
  }

  /**
   * Start a timeout for a specific session phase
   */
  startTimeout(
    sessionId: string,
    phase: SessionTimeout['phase'],
    onTimeout: (sessionId: string, phase: string) => void
  ): void {
    // Clear any existing timeout for this session
    this.clearTimeout(sessionId);

    const timeoutMs = this.getTimeoutForPhase(phase);
    const startTime = Date.now();

    const timeoutId = setTimeout(() => {
      console.warn(`⏰ DKG timeout reached for session ${sessionId} in ${phase} phase`);
      this.clearTimeout(sessionId);
      onTimeout(sessionId, phase);
    }, timeoutMs);

    const timeout: SessionTimeout = {
      sessionId,
      phase,
      startTime,
      timeoutMs,
      timeoutId
    };

    this.timeouts.set(sessionId, timeout);
    
    console.log(`⏱️ Started ${phase} timeout for session ${sessionId} (${timeoutMs / 1000}s)`);
  }

  /**
   * Clear timeout for a session (when phase completes successfully)
   */
  clearTimeout(sessionId: string): void {
    const timeout = this.timeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout.timeoutId);
      this.timeouts.delete(sessionId);
      console.log(`✅ Cleared timeout for session ${sessionId}`);
    }
  }

  /**
   * Get remaining time for a session timeout
   */
  getRemainingTime(sessionId: string): number {
    const timeout = this.timeouts.get(sessionId);
    if (!timeout) return 0;

    const elapsed = Date.now() - timeout.startTime;
    return Math.max(0, timeout.timeoutMs - elapsed);
  }

  /**
   * Check if a session has an active timeout
   */
  hasActiveTimeout(sessionId: string): boolean {
    return this.timeouts.has(sessionId);
  }

  /**
   * Get current phase for a session
   */
  getCurrentPhase(sessionId: string): string | null {
    const timeout = this.timeouts.get(sessionId);
    return timeout?.phase || null;
  }

  /**
   * Clear all timeouts (cleanup)
   */
  clearAllTimeouts(): void {
    // Convert Map.values() to Array for TypeScript compatibility
    Array.from(this.timeouts.values()).forEach(timeout => {
      clearTimeout(timeout.timeoutId);
    });
    this.timeouts.clear();
    console.log('🧹 Cleared all DKG timeouts');
  }

  private getTimeoutForPhase(phase: SessionTimeout['phase']): number {
    switch (phase) {
      case 'joining':
        return this.config.sessionJoinTimeout;
      case 'round1':
        return this.config.round1Timeout;
      case 'round2':
        return this.config.round2Timeout;
      case 'finalizing':
        return this.config.finalizeTimeout;
      default:
        return this.config.sessionJoinTimeout;
    }
  }
}

/**
 * Format remaining time in a human-readable format
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return 'Expired';
  
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}