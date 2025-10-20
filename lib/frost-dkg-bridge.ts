/**
 * FROST DKG Bridge
 * 
 * Bridges the frontend TypeScript application with the Rust FROST DKG client
 * to generate proper bincode-serialized FROST packages instead of mock data.
 * 
 * This solves the "wrong format version, only 0 supported" error by using
 * the actual FROST library implementation from frost-dkg/keygen/dkg/src/main.rs
 * 
 * This client-side bridge communicates with the server-side API route.
 */

export interface FrostDKGConfig {
  sessionId: string;
  participantId: string;
  threshold: number;
  maxSigners: number;
  participants: string[]; // Array of participant public keys
}

export interface FrostPackageData {
  round1Package: string;      // Hex-encoded bincode serialized Round1Package
  round2Packages: string[];   // Hex-encoded encrypted Round2 packages
  groupVerifyingKey: string;  // Final group verification key
  keyShare: string;           // Individual key share
}

export class FrostDKGBridge {
  private config: FrostDKGConfig;

  constructor(config: FrostDKGConfig) {
    this.config = config;
  }

  /**
   * Initialize the DKG session with proper configuration
   */
  async initialize(): Promise<void> {
    // No initialization needed for API-based bridge
    console.log(`🔧 FROST DKG bridge initialized for session ${this.config.sessionId}`);
  }

  /**
   * Generate Round 1 commitment package using actual FROST library
   */
  async generateRound1Package(): Promise<string> {
    try {
      console.log('🚀 Starting FROST DKG Round 1 generation...');
      
      const response = await fetch('/api/frost-dkg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'round1',
          sessionId: this.config.sessionId,
          participantId: this.config.participantId,
          threshold: this.config.threshold,
          maxSigners: this.config.maxSigners,
          participants: this.config.participants
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate Round 1 package');
      }

      console.log('✅ FROST Round 1 package generated successfully');
      return result.data.packageHex;
      
    } catch (error) {
      console.error('Round 1 generation error:', error);
      throw new Error(`FROST DKG Round 1 failed: ${(error as Error).message}`);
    }
  }

  /**
   * Process Round 2 with received Round 1 packages from other participants
   */
  async processRound2(round1Packages: Array<{ participantId: string; packageHex: string }>): Promise<string[]> {
    try {
      console.log('🔄 Processing FROST DKG Round 2...');

      const response = await fetch('/api/frost-dkg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'round2',
          sessionId: this.config.sessionId,
          participantId: this.config.participantId,
          round1Packages
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process Round 2');
      }

      console.log('✅ FROST Round 2 packages generated successfully');
      return result.data.packages;
      
    } catch (error) {
      console.error('Round 2 processing error:', error);
      throw new Error(`FROST DKG Round 2 failed: ${(error as Error).message}`);
    }
  }

  /**
   * Finalize the DKG ceremony and generate group verification key
   */
  async finalize(round2Packages: Array<{ participantId: string; packages: string[] }>): Promise<{ groupVerifyingKey: string; keyShare: string }> {
    try {
      console.log('🏁 Finalizing FROST DKG ceremony...');

      const response = await fetch('/api/frost-dkg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'finalize',
          sessionId: this.config.sessionId,
          participantId: this.config.participantId,
          round2Packages
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to finalize DKG ceremony');
      }

      console.log('✅ FROST DKG ceremony completed successfully');
      return {
        groupVerifyingKey: result.data.groupVerifyingKey,
        keyShare: result.data.keyShare
      };
      
    } catch (error) {
      console.error('Finalization error:', error);
      throw new Error(`FROST DKG finalization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if the Rust DKG client binary is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('/api/frost-dkg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'status',
          sessionId: 'test',
          participantId: 'test'
        })
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Clean up session resources
   */
  async cleanup(): Promise<void> {
    try {
      // No cleanup needed for API-based bridge
      // Session files remain on server for debugging/recovery
      console.log(`🧹 Cleaned up FROST DKG session ${this.config.sessionId}`);
    } catch (error) {
      console.error('Failed to cleanup FROST DKG session:', error);
    }
  }
}

/**
 * Factory function to create and initialize a FROST DKG bridge
 */
export async function createFrostDKGBridge(config: FrostDKGConfig): Promise<FrostDKGBridge> {
  // Check if Rust DKG client is available via API
  const isAvailable = await FrostDKGBridge.isAvailable();
  if (!isAvailable) {
    throw new Error('FROST DKG API is not available. Please ensure the server and Rust DKG client are properly configured.');
  }

  const bridge = new FrostDKGBridge(config);
  await bridge.initialize();
  return bridge;
}