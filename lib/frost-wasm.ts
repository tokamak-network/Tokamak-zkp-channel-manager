/**
 * FROST WASM Module Wrapper
 * 
 * This module wraps the Rust-compiled WASM functions for FROST threshold signatures.
 * It provides TypeScript-friendly interfaces and handles initialization.
 */

'use client';

// Import WASM module functions
// @ts-ignore - WASM module types
import init, {
  init_panic_hook,
  generate_ecdsa_keypair,
  derive_key_from_signature,
  sign_challenge,
  sign_message,
  dkg_part1,
  dkg_part2,
  dkg_part3,
  ecies_encrypt,
  ecies_decrypt,
  get_auth_payload_round1,
  get_auth_payload_round2,
  get_auth_payload_finalize,
  get_identifier_hex,
  sign_part1_commit,
  sign_part2_sign,
  get_signing_prerequisites,
  get_key_package_metadata,
  get_auth_payload_sign_r1,
  get_auth_payload_sign_r2,
  keccak256,
} from './wasm/pkg/tokamak_frost_wasm.js';

let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM module
 * This must be called before using any other functions
 * Safe to call multiple times - will only initialize once
 */
export async function initWasm(): Promise<void> {
  if (wasmInitialized) {
    return;
  }
  
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    try {
      await init();
      init_panic_hook();
      wasmInitialized = true;
      console.log('✅ FROST WASM module initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize FROST WASM module:', error);
      throw error;
    }
  })();
  
  return initPromise;
}

/**
 * Check if WASM module is initialized
 */
export function isWasmInitialized(): boolean {
  return wasmInitialized;
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface KeyPair {
  private_key_hex: string;
  public_key_hex: string;
}

export interface DKGRound1Result {
  secret_package_hex: string;
  public_package_hex: string;
}

export interface DKGRound2Result {
  secret_package_hex: string;
  outgoing_packages: Record<string, string>;
}

export interface DKGFinalResult {
  key_package_hex: string;
  group_public_key_hex: string;
}

export interface ECIESEncryptResult {
  ephemeral_public_key_hex: string;
  nonce_hex: string;
  ciphertext_hex: string;
}

export interface SigningCommitResult {
  nonces_hex: string;
  commitments_hex: string;
}

export interface SigningPrerequisites {
  signer_id_bincode_hex: string;
  verifying_share_bincode_hex: string;
}

export interface KeyPackageMetadata {
  group_id: string;
  threshold: number;
  roster: Array<[number, string]>;
  group_public_key: string;
}

// ============================================================================
// Key Management Functions
// ============================================================================

/**
 * Generate a random ECDSA keypair
 */
export function generateKeypair(): KeyPair {
  const result = generate_ecdsa_keypair();
  return JSON.parse(result);
}

/**
 * Derive a deterministic keypair from a signature (e.g., from MetaMask)
 */
export function deriveKeyFromSignature(signatureHex: string): KeyPair {
  const result = derive_key_from_signature(signatureHex);
  return JSON.parse(result);
}

/**
 * Sign a challenge for authentication
 */
export function signChallengeAuth(privateKeyHex: string, challenge: string): string {
  return sign_challenge(privateKeyHex, challenge);
}

/**
 * Sign a message with ECDSA
 */
export function signMessageECDSA(privateKeyHex: string, messageHex: string): string {
  return sign_message(privateKeyHex, messageHex);
}

/**
 * Compute Keccak256 hash of a message
 */
export function hashKeccak256(message: string): string {
  return keccak256(message);
}

/**
 * Get FROST identifier from a numeric ID
 */
export function getIdentifierHex(id: number): string {
  return get_identifier_hex(id);
}

// ============================================================================
// DKG Round Functions
// ============================================================================

/**
 * DKG Round 1: Generate secret commitments and public package
 */
export function dkgRound1(
  identifierHex: string,
  maxSigners: number,
  minSigners: number
): DKGRound1Result {
  const result = dkg_part1(identifierHex, maxSigners, minSigners);
  return JSON.parse(result);
}

/**
 * DKG Round 2: Generate encrypted shares for other participants
 */
export function dkgRound2(
  secretPackageHex: string,
  round1PackagesMap: Record<string, string>
): DKGRound2Result {
  // Convert plain object to Map for WASM
  const packagesMap = new Map(Object.entries(round1PackagesMap));
  const result = dkg_part2(secretPackageHex, packagesMap);
  const parsed = JSON.parse(result);
  
  // Convert Map back to plain object if needed
  if (parsed.outgoing_packages instanceof Map) {
    parsed.outgoing_packages = Object.fromEntries(parsed.outgoing_packages);
  }
  
  return parsed;
}

/**
 * DKG Round 3 (Finalization): Compute final key package and group public key
 */
export function dkgFinalize(
  secretPackageHex: string,
  round1PackagesMap: Record<string, string>,
  round2PackagesMap: Record<string, string>,
  groupId: string,
  roster: Map<number, string>
): DKGFinalResult {
  const r1Map = new Map(Object.entries(round1PackagesMap));
  const r2Map = new Map(Object.entries(round2PackagesMap));
  
  const result = dkg_part3(
    secretPackageHex,
    r1Map,
    r2Map,
    groupId,
    roster
  );
  
  return JSON.parse(result);
}

// ============================================================================
// ECIES Encryption Functions (for Round 2)
// ============================================================================

/**
 * Encrypt data using ECIES (for encrypting secret shares in DKG Round 2)
 */
export function encryptShare(
  recipientPubkeyHex: string,
  plaintextHex: string
): ECIESEncryptResult {
  const result = ecies_encrypt(recipientPubkeyHex, plaintextHex);
  return JSON.parse(result);
}

/**
 * Decrypt data using ECIES (for decrypting received shares in DKG Round 2)
 */
export function decryptShare(
  recipientPrivateKeyHex: string,
  ephemeralPublicKeyHex: string,
  nonceHex: string,
  ciphertextHex: string
): string {
  return ecies_decrypt(
    recipientPrivateKeyHex,
    ephemeralPublicKeyHex,
    nonceHex,
    ciphertextHex
  );
}

// ============================================================================
// Authentication Payload Functions
// ============================================================================

/**
 * Get authentication payload for Round 1 submission
 */
export function getAuthPayloadRound1(
  sessionId: string,
  idHex: string,
  pkgHex: string
): string {
  return get_auth_payload_round1(sessionId, idHex, pkgHex);
}

/**
 * Get authentication payload for Round 2 submission
 */
export function getAuthPayloadRound2(
  sessionId: string,
  fromIdHex: string,
  toIdHex: string,
  ephPubHex: string,
  nonceHex: string,
  ctHex: string
): string {
  return get_auth_payload_round2(
    sessionId,
    fromIdHex,
    toIdHex,
    ephPubHex,
    nonceHex,
    ctHex
  );
}

/**
 * Get authentication payload for finalization submission
 */
export function getAuthPayloadFinalize(
  sessionId: string,
  idHex: string,
  groupVkHex: string
): string {
  return get_auth_payload_finalize(sessionId, idHex, groupVkHex);
}

/**
 * Get authentication payload for signing Round 1 submission
 */
export function getAuthPayloadSignR1(
  sessionId: string,
  groupId: string,
  idHex: string,
  commitsHex: string
): string {
  return get_auth_payload_sign_r1(sessionId, groupId, idHex, commitsHex);
}

/**
 * Get authentication payload for signing Round 2 submission
 */
export function getAuthPayloadSignR2(
  sessionId: string,
  groupId: string,
  idHex: string,
  sigshareHex: string,
  msg32Hex: string
): string {
  return get_auth_payload_sign_r2(sessionId, groupId, idHex, sigshareHex, msg32Hex);
}

// ============================================================================
// Threshold Signing Functions
// ============================================================================

/**
 * Get metadata from a key package
 */
export function getKeyPackageMetadata(keyPackageHex: string): KeyPackageMetadata {
  const result = get_key_package_metadata(keyPackageHex);
  return JSON.parse(result);
}

/**
 * Get signing prerequisites from a key package
 */
export function getSigningPrerequisites(keyPackageHex: string): SigningPrerequisites {
  const result = get_signing_prerequisites(keyPackageHex);
  return JSON.parse(result);
}

/**
 * Signing Round 1: Generate commitments
 */
export function signRound1Commit(keyPackageHex: string): SigningCommitResult {
  const result = sign_part1_commit(keyPackageHex);
  return JSON.parse(result);
}

/**
 * Signing Round 2: Generate signature share
 */
export function signRound2Sign(
  keyPackageHex: string,
  noncesHex: string,
  signingPackageHex: string
): string {
  return sign_part2_sign(keyPackageHex, noncesHex, signingPackageHex);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Ensure WASM is initialized before calling a function
 */
export async function ensureInitialized(): Promise<void> {
  if (!wasmInitialized) {
    await initWasm();
  }
}

