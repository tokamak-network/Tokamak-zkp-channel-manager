/**
 * Utility functions for handling elliptic curve keys
 */

import { ec as EC } from 'elliptic';

const secp256k1 = new EC('secp256k1');

/**
 * Decompresses a SEC1 compressed public key to get px and py coordinates
 * @param compressedKey - Compressed public key in hex format (with or without 0x prefix)
 * @returns Object with px and py as hex strings, or null if invalid
 */
export function decompressPublicKey(compressedKey: string): { px: string; py: string } | null {
  try {
    // Remove 0x prefix if present
    const cleanKey = compressedKey.replace(/^0x/, '');
    
    // Validate compressed key format (should start with 02 or 03 and be 66 chars)
    if (cleanKey.length !== 66 || (cleanKey.substring(0, 2) !== '02' && cleanKey.substring(0, 2) !== '03')) {
      console.error('Invalid compressed key format:', cleanKey.substring(0, 10) + '...');
      return null;
    }
    
    // Create key pair from compressed public key
    const key = secp256k1.keyFromPublic(cleanKey, 'hex');
    
    // Get the uncompressed public key
    const publicKey = key.getPublic();
    
    // Extract x and y coordinates as hex strings (without padding)
    const px = publicKey.getX().toString('hex').padStart(64, '0');
    const py = publicKey.getY().toString('hex').padStart(64, '0');
    
    return { px, py };
  } catch (error) {
    console.error('Failed to decompress public key:', error);
    return null;
  }
}

/**
 * Checks if a key is compressed (starts with 02 or 03)
 * @param key - Public key in hex format
 * @returns true if compressed, false otherwise
 */
export function isCompressedKey(key: string): boolean {
  const cleanKey = key.replace(/^0x/, '');
  return cleanKey.length === 66 && (cleanKey.startsWith('02') || cleanKey.startsWith('03'));
}

/**
 * Checks if a key is uncompressed (starts with 04)
 * @param key - Public key in hex format
 * @returns true if uncompressed, false otherwise
 */
export function isUncompressedKey(key: string): boolean {
  const cleanKey = key.replace(/^0x/, '');
  return cleanKey.length === 130 && cleanKey.startsWith('04');
}