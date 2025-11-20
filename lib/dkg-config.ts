/**
 * DKG Configuration
 * Reads from environment variables with fallback defaults
 */

export const DKG_CONFIG = {
  // Server Configuration
  SERVER_URL: process.env.NEXT_PUBLIC_DKG_SERVER_URL || 'ws://127.0.0.1:9000/ws',
  AUTO_CONNECT: process.env.NEXT_PUBLIC_DKG_AUTO_CONNECT === 'true' || true, // Default: true
  CONNECTION_TIMEOUT: parseInt(process.env.NEXT_PUBLIC_DKG_CONNECTION_TIMEOUT || '5000'),
  
  // Session Management
  SESSION_REFRESH_INTERVAL: parseInt(process.env.NEXT_PUBLIC_SESSION_REFRESH_INTERVAL || '10000'),
  MAX_STORED_SESSIONS: parseInt(process.env.NEXT_PUBLIC_MAX_STORED_SESSIONS || '50'),
  AUTO_SAVE_KEY_PACKAGES: process.env.NEXT_PUBLIC_AUTO_SAVE_KEY_PACKAGES !== 'false',
  
  // Application Settings
  DEBUG_MODE: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
  VERBOSE_LOGGING: process.env.NEXT_PUBLIC_VERBOSE_LOGGING === 'true',
  SHOW_DEV_CONSOLE: process.env.NEXT_PUBLIC_SHOW_DEV_CONSOLE === 'true' || process.env.NODE_ENV === 'development',
  
  // WASM Settings
  WASM_INIT_TIMEOUT: parseInt(process.env.NEXT_PUBLIC_WASM_INIT_TIMEOUT || '10000'),
  WASM_DEBUG: process.env.NEXT_PUBLIC_WASM_DEBUG === 'true',
} as const;

// Helper function for debug logging
export function debugLog(message: string, ...args: any[]) {
  if (DKG_CONFIG.DEBUG_MODE || DKG_CONFIG.VERBOSE_LOGGING) {
    console.log(`[DKG DEBUG] ${message}`, ...args);
  }
}

// Helper function to get server URL
export function getDKGServerUrl(): string {
  return DKG_CONFIG.SERVER_URL;
}

// Helper function to check if auto-connect is enabled
export function shouldAutoConnect(): boolean {
  return DKG_CONFIG.AUTO_CONNECT;
}

