/**
 * Comprehensive Error Handling for DKG Operations
 * Handles various edge cases and provides user-friendly error messages
 */

export enum DKGErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  SESSION_ERROR = 'SESSION_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export interface DKGError {
  type: DKGErrorType;
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
  metadata?: Record<string, any>;
}

export class DKGErrorHandler {
  private static errorMap: Record<string, Partial<DKGError>> = {
    // Connection Errors
    'WebSocket connection failed': {
      type: DKGErrorType.CONNECTION_ERROR,
      code: 'WS_CONNECTION_FAILED',
      userMessage: 'Failed to connect to the DKG server. Please check the server URL and try again.',
      recoverable: true,
      retryable: true
    },
    'Connection timeout': {
      type: DKGErrorType.CONNECTION_ERROR,
      code: 'WS_TIMEOUT',
      userMessage: 'Connection to DKG server timed out. The server might be busy or unreachable.',
      recoverable: true,
      retryable: true
    },

    // Authentication Errors
    'ECDSA signature verification failed': {
      type: DKGErrorType.AUTHENTICATION_ERROR,
      code: 'ECDSA_VERIFICATION_FAILED',
      userMessage: 'Authentication failed due to signature verification error. Please try authenticating again.',
      recoverable: true,
      retryable: true
    },
    'Challenge expired': {
      type: DKGErrorType.AUTHENTICATION_ERROR,
      code: 'CHALLENGE_EXPIRED',
      userMessage: 'Authentication challenge has expired. Please request a new challenge.',
      recoverable: true,
      retryable: true
    },
    'Invalid public key format': {
      type: DKGErrorType.AUTHENTICATION_ERROR,
      code: 'INVALID_PUBKEY',
      userMessage: 'Your wallet\'s public key format is invalid. Please check your wallet connection.',
      recoverable: true,
      retryable: false
    },

    // Session Errors
    'Session not found': {
      type: DKGErrorType.SESSION_ERROR,
      code: 'SESSION_NOT_FOUND',
      userMessage: 'The session you\'re trying to join doesn\'t exist or has expired.',
      recoverable: false,
      retryable: false
    },
    'Session already started': {
      type: DKGErrorType.SESSION_ERROR,
      code: 'SESSION_STARTED',
      userMessage: 'This session has already started and cannot accept new participants.',
      recoverable: false,
      retryable: false
    },
    'Insufficient participants': {
      type: DKGErrorType.SESSION_ERROR,
      code: 'INSUFFICIENT_PARTICIPANTS',
      userMessage: 'Not enough participants to start the DKG ceremony. Waiting for more participants.',
      recoverable: true,
      retryable: false
    },
    'Maximum participants reached': {
      type: DKGErrorType.SESSION_ERROR,
      code: 'MAX_PARTICIPANTS',
      userMessage: 'This session has reached the maximum number of participants.',
      recoverable: false,
      retryable: false
    },

    // Encryption Errors
    'ECIES encryption failed': {
      type: DKGErrorType.ENCRYPTION_ERROR,
      code: 'ECIES_ENCRYPT_FAILED',
      userMessage: 'Failed to encrypt secret shares. This might be due to invalid participant keys.',
      recoverable: true,
      retryable: true
    },
    'ECIES decryption failed': {
      type: DKGErrorType.ENCRYPTION_ERROR,
      code: 'ECIES_DECRYPT_FAILED',
      userMessage: 'Failed to decrypt received secret shares. The data might be corrupted.',
      recoverable: false,
      retryable: false
    },

    // Timeout Errors
    'Round 1 timeout': {
      type: DKGErrorType.TIMEOUT_ERROR,
      code: 'R1_TIMEOUT',
      userMessage: 'Round 1 timed out. Some participants failed to submit their commitments.',
      recoverable: false,
      retryable: false
    },
    'Round 2 timeout': {
      type: DKGErrorType.TIMEOUT_ERROR,
      code: 'R2_TIMEOUT',
      userMessage: 'Round 2 timed out. Some participants failed to submit their encrypted shares.',
      recoverable: false,
      retryable: false
    },

    // Validation Errors
    'Invalid commitment': {
      type: DKGErrorType.VALIDATION_ERROR,
      code: 'INVALID_COMMITMENT',
      userMessage: 'The commitment data is invalid or corrupted.',
      recoverable: true,
      retryable: true
    },
    'Signature mismatch': {
      type: DKGErrorType.VALIDATION_ERROR,
      code: 'SIGNATURE_MISMATCH',
      userMessage: 'Digital signature verification failed. The data might have been tampered with.',
      recoverable: false,
      retryable: false
    },

    // Protocol Errors
    'Invalid protocol state': {
      type: DKGErrorType.PROTOCOL_ERROR,
      code: 'INVALID_STATE',
      userMessage: 'The DKG protocol is in an invalid state. Please restart the session.',
      recoverable: false,
      retryable: false
    },
    'Protocol version mismatch': {
      type: DKGErrorType.PROTOCOL_ERROR,
      code: 'VERSION_MISMATCH',
      userMessage: 'Your client version is incompatible with the server. Please update your application.',
      recoverable: false,
      retryable: false
    }
  };

  /**
   * Parse and enhance an error with user-friendly information
   */
  static parseError(error: Error | string, context?: Record<string, any>): DKGError {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    // Try to match against known error patterns
    for (const [pattern, errorInfo] of Object.entries(this.errorMap)) {
      if (errorMessage.includes(pattern)) {
        return {
          type: errorInfo.type!,
          code: errorInfo.code!,
          message: errorMessage,
          userMessage: errorInfo.userMessage!,
          recoverable: errorInfo.recoverable!,
          retryable: errorInfo.retryable!,
          metadata: context
        };
      }
    }

    // Default error handling for unknown errors - preserve the actual server message
    return {
      type: DKGErrorType.PROTOCOL_ERROR,
      code: 'UNKNOWN_ERROR',
      message: errorMessage,
      userMessage: errorMessage, // Show actual server error instead of generic message
      recoverable: true,
      retryable: true,
      metadata: context
    };
  }

  /**
   * Get recovery suggestions for an error
   */
  static getRecoverySuggestions(error: DKGError): string[] {
    const suggestions: string[] = [];

    switch (error.type) {
      case DKGErrorType.CONNECTION_ERROR:
        suggestions.push('Check your internet connection');
        suggestions.push('Verify the DKG server URL is correct');
        suggestions.push('Try connecting again in a few moments');
        break;

      case DKGErrorType.AUTHENTICATION_ERROR:
        suggestions.push('Disconnect and reconnect your wallet');
        suggestions.push('Request a new authentication challenge');
        suggestions.push('Clear browser cache and try again');
        break;

      case DKGErrorType.SESSION_ERROR:
        if (error.code === 'SESSION_NOT_FOUND') {
          suggestions.push('Verify the session ID is correct');
          suggestions.push('Check with the session creator if the session is still active');
        } else if (error.code === 'INSUFFICIENT_PARTICIPANTS') {
          suggestions.push('Wait for more participants to join');
          suggestions.push('Share the session ID with other participants');
        }
        break;

      case DKGErrorType.ENCRYPTION_ERROR:
        suggestions.push('Check that all participants have valid public keys');
        suggestions.push('Restart the DKG ceremony if the error persists');
        break;

      case DKGErrorType.TIMEOUT_ERROR:
        suggestions.push('Some participants may have dropped out');
        suggestions.push('Try creating a new session with responsive participants');
        suggestions.push('Check network connectivity of all participants');
        break;

      case DKGErrorType.VALIDATION_ERROR:
        suggestions.push('Restart the current DKG round');
        suggestions.push('Check for data corruption or network issues');
        break;

      case DKGErrorType.PROTOCOL_ERROR:
        suggestions.push('Restart the DKG ceremony');
        suggestions.push('Update your application to the latest version');
        suggestions.push('Contact support if the issue persists');
        break;

      default:
        suggestions.push('Try the operation again');
        suggestions.push('Restart the application if the issue persists');
        break;
    }

    return suggestions;
  }

  /**
   * Format error for display to user
   */
  static formatErrorForUser(error: DKGError): {
    title: string;
    message: string;
    suggestions: string[];
    canRetry: boolean;
  } {
    const suggestions = this.getRecoverySuggestions(error);
    
    return {
      title: `DKG ${error.type.replace('_', ' ').toLowerCase()}`,
      message: error.userMessage,
      suggestions,
      canRetry: error.retryable
    };
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: DKGError, context?: string): void {
    const logContext = context ? `[${context}] ` : '';
    const errorWithMetadata = {
      ...error,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    };

    if (error.recoverable) {
      console.warn(`${logContext}Recoverable DKG Error:`, errorWithMetadata);
    } else {
      console.error(`${logContext}Critical DKG Error:`, errorWithMetadata);
    }
  }
}