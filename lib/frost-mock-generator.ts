/**
 * Temporary Mock FROST Package Generator
 * 
 * This generates mock FROST packages that have the correct structure and format
 * expected by the server, avoiding the "wrong format version, only 0 supported" error.
 * 
 * This is a temporary solution until the full Rust FROST DKG client integration
 * is properly implemented.
 */

/**
 * Generate a mock FROST Round 1 package that matches the expected bincode format
 * 
 * Based on the FROST specification, a Round 1 package typically contains:
 * - Format version (u8): 0
 * - Participant identifier 
 * - Commitment data
 * - Additional metadata
 */
export function generateMockFrostRound1Package(): string {
  // Create a mock package that starts with format version 0
  const formatVersion = 0;
  
  // Mock commitment data (32 bytes for secp256k1)
  const commitment = new Uint8Array(32);
  crypto.getRandomValues(commitment);
  
  // Mock identifier (4 bytes)
  const identifier = new Uint8Array(4);
  crypto.getRandomValues(identifier);
  
  // Create a simple structure that mimics bincode serialization
  // Format: [version(1)] + [identifier_len(4)] + [identifier] + [commitment_len(4)] + [commitment]
  const buffer = new ArrayBuffer(1 + 4 + 4 + 4 + 32);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  let offset = 0;
  
  // Format version (1 byte)
  view.setUint8(offset, formatVersion);
  offset += 1;
  
  // Identifier length (4 bytes, little-endian for bincode)
  view.setUint32(offset, 4, true);
  offset += 4;
  
  // Identifier (4 bytes)
  bytes.set(identifier, offset);
  offset += 4;
  
  // Commitment length (4 bytes, little-endian)
  view.setUint32(offset, 32, true);
  offset += 4;
  
  // Commitment (32 bytes)
  bytes.set(commitment, offset);
  
  // Convert to hex string
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a mock group verifying key for finalization
 */
export function generateMockGroupVerifyingKey(): string {
  // Generate a compressed secp256k1 public key (33 bytes)
  // Format: 0x02 or 0x03 prefix + 32 bytes
  const key = new Uint8Array(33);
  key[0] = 0x02 + Math.floor(Math.random() * 2); // 0x02 or 0x03
  crypto.getRandomValues(key.subarray(1));
  
  return Array.from(key)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate that a package has the correct format version
 */
export function validateFrostPackageFormat(hexPackage: string): boolean {
  try {
    if (hexPackage.length < 2) return false;
    
    // Check that first byte (format version) is 0
    const formatVersion = parseInt(hexPackage.slice(0, 2), 16);
    return formatVersion === 0;
  } catch {
    return false;
  }
}

/**
 * Create mock ECIES encrypted secret shares for Round 2
 */
export function generateMockSecretShare(): Uint8Array {
  // Generate a 32-byte secret share
  const share = new Uint8Array(32);
  crypto.getRandomValues(share);
  return share;
}

/**
 * Log package information for debugging
 */
export function logPackageInfo(packageHex: string, round: string) {
  console.log(`📦 Generated ${round} package:`, {
    length: packageHex.length,
    formatVersion: parseInt(packageHex.slice(0, 2), 16),
    preview: packageHex.slice(0, 20) + '...',
    isValidFormat: validateFrostPackageFormat(packageHex)
  });
}