/**
 * ECIES (Elliptic Curve Integrated Encryption Scheme) Implementation
 * Used for encrypting DKG secret shares between participants
 * 
 * This implementation matches the Rust code in frost-dkg/keygen/dkg/src/helper.rs
 * - Uses SHA-512 KDF with prefix "TOKAMAK_FROST_ECIES_v1"
 * - Uses AES-256-GCM for authenticated encryption
 * - Uses 12-byte nonces for GCM
 */

import { randomBytes } from 'crypto';

export interface ECIESEncryptedData {
  ephemeralPublicKey: string; // Compressed SEC1 format (33 bytes)
  nonce: string;              // Random nonce (12 bytes for GCM)
  ciphertext: string;         // AES-256-GCM encrypted data with auth tag
}

/**
 * KDF function matching Rust implementation: SHA-512(prefix || shared_secret).first32
 */
async function eciesKdf32(prefix: string, sharedSecret: Uint8Array): Promise<Uint8Array> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha512');
  hash.update(Buffer.from(prefix, 'utf8'));
  hash.update(sharedSecret);
  const digest = hash.digest();
  return new Uint8Array(digest.slice(0, 32)); // First 32 bytes
}

/**
 * Encrypt data using ECIES with secp256k1 (matches Rust implementation)
 * @param data - The plaintext data to encrypt
 * @param recipientPublicKey - Recipient's public key in compressed SEC1 format (33 bytes)
 * @returns Promise<ECIESEncryptedData>
 */
export async function eciesEncrypt(
  data: Uint8Array,
  recipientPublicKey: string
): Promise<ECIESEncryptedData> {
  try {
    // Import required modules
    const elliptic = await import('elliptic');
    const EC = elliptic.ec;
    const ec = new EC('secp256k1');
    const crypto = await import('crypto');
    
    // Generate ephemeral keypair
    const ephemeralKeyPair = ec.genKeyPair();
    const ephemeralPublicKey = ephemeralKeyPair.getPublic(true, 'hex'); // Compressed SEC1 format
    
    // Parse recipient's public key
    const recipientKey = ec.keyFromPublic(recipientPublicKey, 'hex');
    
    // Perform ECDH to get shared secret (X coordinate only)
    const sharedPoint = ephemeralKeyPair.derive(recipientKey.getPublic());
    const sharedSecret = Buffer.from(sharedPoint.toString(16).padStart(64, '0'), 'hex');
    
    // Derive 32-byte encryption key using SHA-512 KDF (matches Rust)
    const encryptionKey = await eciesKdf32('TOKAMAK_FROST_ECIES_v1', new Uint8Array(sharedSecret));
    
    // Generate 12-byte random nonce for AES-GCM
    const nonce = randomBytes(12);
    
    // Encrypt using AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, nonce);
    let ciphertext = cipher.update(data);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine ciphertext + auth tag (matches Rust AES-GCM behavior)
    const ciphertextWithTag = Buffer.concat([ciphertext, authTag]);
    
    return {
      ephemeralPublicKey,
      nonce: nonce.toString('hex'),
      ciphertext: ciphertextWithTag.toString('hex')
    };
  } catch (error) {
    throw new Error(`ECIES encryption failed: ${error}`);
  }
}

/**
 * Decrypt ECIES encrypted data (matches Rust implementation)
 * @param encryptedData - The encrypted data structure
 * @param privateKey - Recipient's private key in hex format
 * @returns Promise<Uint8Array> - Decrypted plaintext data
 */
export async function eciesDecrypt(
  encryptedData: ECIESEncryptedData,
  privateKey: string
): Promise<Uint8Array> {
  try {
    // Import required modules
    const elliptic = await import('elliptic');
    const EC = elliptic.ec;
    const ec = new EC('secp256k1');
    const crypto = await import('crypto');
    
    // Create key pair from private key
    const keyPair = ec.keyFromPrivate(privateKey, 'hex');
    
    // Parse ephemeral public key
    const ephemeralPublicKey = ec.keyFromPublic(encryptedData.ephemeralPublicKey, 'hex');
    
    // Perform ECDH to get shared secret (X coordinate only)
    const sharedPoint = keyPair.derive(ephemeralPublicKey.getPublic());
    const sharedSecret = Buffer.from(sharedPoint.toString(16).padStart(64, '0'), 'hex');
    
    // Derive 32-byte decryption key using SHA-512 KDF (matches Rust)
    const decryptionKey = await eciesKdf32('TOKAMAK_FROST_ECIES_v1', new Uint8Array(sharedSecret));
    
    // Parse nonce and ciphertext with auth tag
    const nonce = Buffer.from(encryptedData.nonce, 'hex');
    const ciphertextWithTag = Buffer.from(encryptedData.ciphertext, 'hex');
    
    // Split ciphertext and auth tag (AES-GCM uses 16-byte auth tag)
    const ciphertext = ciphertextWithTag.slice(0, -16);
    const authTag = ciphertextWithTag.slice(-16);
    
    // Decrypt using AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', decryptionKey, nonce);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return new Uint8Array(decrypted);
  } catch (error) {
    throw new Error(`ECIES decryption failed: ${error}`);
  }
}

/**
 * Generate a mock DKG secret share for testing
 * In a real implementation, this would come from the FROST DKG library
 */
export function generateMockSecretShare(): Uint8Array {
  return randomBytes(32); // 32-byte secret share
}

/**
 * Create ECDSA signature for encrypted package authentication
 * @param session - Session ID
 * @param fromId - Sender's FROST identifier
 * @param toId - Recipient's FROST identifier
 * @param ephPub - Ephemeral public key bytes
 * @param nonce - Nonce bytes
 * @param ciphertext - Ciphertext bytes
 * @param privateKey - Sender's ECDSA private key
 * @returns Promise<string> - Signature in hex format
 */
export async function signEncryptedPackage(
  session: string,
  fromId: string,
  toId: string,
  ephPub: string,
  nonce: string,
  ciphertext: string,
  privateKey: string
): Promise<string> {
  try {
    const elliptic = await import('elliptic');
    const EC = elliptic.ec;
    const ec = new EC('secp256k1');
    const { keccak256 } = await import('js-sha3');
    
    // Create authentication payload (matches server's auth_payload_round2)
    const payload = `TOKAMAK_FROST_DKG_R2|${session}|${fromId}|${toId}`;
    const payloadBytes = Buffer.from(payload, 'utf8');
    
    // Append binary data
    const ephPubBytes = Buffer.from(ephPub, 'hex');
    const nonceBytes = Buffer.from(nonce, 'hex');
    const ciphertextBytes = Buffer.from(ciphertext, 'hex');
    
    const fullPayload = Buffer.concat([payloadBytes, ephPubBytes, nonceBytes, ciphertextBytes]);
    
    // Hash the payload
    const digest = keccak256(fullPayload);
    
    // Sign with ECDSA
    const keyPair = ec.keyFromPrivate(privateKey, 'hex');
    const signature = keyPair.sign(Buffer.from(digest, 'hex'), { canonical: true });
    
    // Ensure canonical form (low-s)
    const n = ec.curve.n;
    let s = signature.s;
    if (s.gt(n.shln(1))) {
      s = n.sub(s);
    }
    
    // Return as compact format (r + s, 64 bytes)
    const r = signature.r.toString(16).padStart(64, '0');
    const sHex = s.toString(16).padStart(64, '0');
    
    return r + sHex;
  } catch (error) {
    throw new Error(`Package signing failed: ${error}`);
  }
}