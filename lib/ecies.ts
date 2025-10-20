/**
 * ECIES (Elliptic Curve Integrated Encryption Scheme) Implementation
 * Used for encrypting DKG secret shares between participants
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface ECIESEncryptedData {
  ephemeralPublicKey: string; // Compressed SEC1 format (33 bytes)
  nonce: string;              // Random nonce (32 bytes)
  ciphertext: string;         // Encrypted data
}

/**
 * Encrypt data using ECIES with secp256k1
 * @param data - The plaintext data to encrypt
 * @param recipientPublicKey - Recipient's public key in compressed SEC1 format (33 bytes)
 * @returns Promise<ECIESEncryptedData>
 */
export async function eciesEncrypt(
  data: Uint8Array,
  recipientPublicKey: string
): Promise<ECIESEncryptedData> {
  try {
    // Import elliptic.js for ECDH
    const elliptic = await import('elliptic');
    const EC = elliptic.ec;
    const ec = new EC('secp256k1');
    
    
    // Generate ephemeral keypair
    const ephemeralKeyPair = ec.genKeyPair();
    const ephemeralPublicKey = ephemeralKeyPair.getPublic(true, 'hex'); // Compressed format
    
    // Parse recipient's public key
    const recipientKey = ec.keyFromPublic(recipientPublicKey, 'hex');
    
    // Perform ECDH to get shared secret
    const sharedPoint = ephemeralKeyPair.derive(recipientKey.getPublic());
    const sharedSecret = sharedPoint.toString(16).padStart(64, '0');
    
    // Derive encryption key using SHA256(shared_secret)
    const { keccak256 } = await import('js-sha3');
    const encryptionKey = keccak256(Buffer.from(sharedSecret, 'hex'));
    
    // Generate random nonce (16 bytes for AES-CTR)
    const nonce = randomBytes(16);
    
    // Encrypt using AES-256-CTR with Node.js crypto
    const cipher = createCipheriv('aes-256-ctr', Buffer.from(encryptionKey, 'hex'), nonce);
    let ciphertext = cipher.update(data);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    
    return {
      ephemeralPublicKey,
      nonce: nonce.toString('hex'),
      ciphertext: ciphertext.toString('hex')
    };
  } catch (error) {
    throw new Error(`ECIES encryption failed: ${error}`);
  }
}

/**
 * Decrypt ECIES encrypted data
 * @param encryptedData - The encrypted data structure
 * @param privateKey - Recipient's private key in hex format
 * @returns Promise<Uint8Array> - Decrypted plaintext data
 */
export async function eciesDecrypt(
  encryptedData: ECIESEncryptedData,
  privateKey: string
): Promise<Uint8Array> {
  try {
    // Import elliptic.js for ECDH
    const elliptic = await import('elliptic');
    const EC = elliptic.ec;
    const ec = new EC('secp256k1');
    
    // Create key pair from private key
    const keyPair = ec.keyFromPrivate(privateKey, 'hex');
    
    // Parse ephemeral public key
    const ephemeralPublicKey = ec.keyFromPublic(encryptedData.ephemeralPublicKey, 'hex');
    
    // Perform ECDH to get shared secret
    const sharedPoint = keyPair.derive(ephemeralPublicKey.getPublic());
    const sharedSecret = sharedPoint.toString(16).padStart(64, '0');
    
    // Derive decryption key using SHA256(shared_secret)
    const { keccak256 } = await import('js-sha3');
    const decryptionKey = keccak256(Buffer.from(sharedSecret, 'hex'));
    
    // Parse nonce and ciphertext
    const nonce = Buffer.from(encryptedData.nonce, 'hex');
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'hex');
    
    // Decrypt using AES-256-CTR with Node.js crypto
    const decipher = createDecipheriv('aes-256-ctr', Buffer.from(decryptionKey, 'hex'), nonce);
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