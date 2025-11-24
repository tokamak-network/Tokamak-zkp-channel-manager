import { groth16 } from 'snarkjs';

export interface CircuitInput {
  storage_keys_L2MPT: string[];
  storage_values: string[];
  treeSize?: number;
}

export interface ExternalStorageConfig {
  provider: 'github-releases' | 'aws-s3' | 'ipfs' | 'vercel-blob';
  baseUrl: string;
  fallbackUrls?: string[];
}

export interface ProofResult {
  proof: {
    pA: readonly [bigint, bigint, bigint, bigint];
    pB: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    pC: readonly [bigint, bigint, bigint, bigint];
    merkleRoot: `0x${string}`;
  };
  publicSignals: string[];
  rawProof: any;
}

/**
 * Generate a Groth16 proof client-side using snarkjs
 */
export async function generateClientSideProof(
  input: CircuitInput,
  onProgress?: (status: string) => void
): Promise<ProofResult> {
  try {
    // Validate input
    if (!input.storage_keys_L2MPT || !input.storage_values) {
      throw new Error('Missing storage_keys_L2MPT or storage_values');
    }

    // Determine tree size
    const dataLength = input.storage_keys_L2MPT.length;
    let treeSize = input.treeSize || dataLength;
    
    // Validate tree size is supported
    if (![16, 32, 64, 128].includes(treeSize)) {
      throw new Error('Tree size must be 16, 32, 64, or 128');
    }
    
    if (input.storage_keys_L2MPT.length !== treeSize || input.storage_values.length !== treeSize) {
      throw new Error(`Both arrays must contain exactly ${treeSize} elements for tree size ${treeSize}`);
    }

    onProgress?.('Loading circuit files...');

    // External storage configuration for large zkey files
    const externalStorage: ExternalStorageConfig = {
      provider: 'github-releases',
      baseUrl: 'https://github.com/tokamak-network/Tokamak-zkp-channel-manager/releases/download/zkey-files',
      fallbackUrls: [
        // Add additional URLs here as backups
        // 'https://ipfs.io/ipfs/YOUR_HASH',
        // 'https://your-cdn.com/zkey-files'
      ]
    };
    
    // Get circuit configuration with external URLs for large files
    const getCircuitConfig = (size: number) => {
      const configs = {
        16: {
          wasmUrl: '/zk-assets/wasm/circuit_N4.wasm',
          zkeyUrl: `/zk-assets/zkey/circuit_final_16.zkey`, // Local file (small)
          circuitName: 'circuit_N4'
        },
        32: {
          wasmUrl: '/zk-assets/wasm/circuit_N4.wasm', // Use N4 WASM for now
          zkeyUrl: `${externalStorage.baseUrl}/circuit_final_32.zkey`, // External
          circuitName: 'circuit_N5'
        },
        64: {
          wasmUrl: '/zk-assets/wasm/circuit_N4.wasm', // Use N4 WASM for now
          zkeyUrl: `${externalStorage.baseUrl}/circuit_final_64.zkey`, // External
          circuitName: 'circuit_N6'
        },
        128: {
          wasmUrl: '/zk-assets/wasm/circuit_N4.wasm', // Use N4 WASM for now
          zkeyUrl: `${externalStorage.baseUrl}/circuit_final_128.zkey`, // External
          circuitName: 'circuit_N7'
        }
      };
      return configs[size as keyof typeof configs];
    };

    const config = getCircuitConfig(treeSize);
    if (!config) {
      throw new Error(`Unsupported tree size: ${treeSize}`);
    }

    // Try to use the specified config, with fallback to 16-leaf circuit
    let actualConfig = config;
    
    // For larger circuits, verify the external file exists before proceeding
    if (treeSize > 16) {
      try {
        onProgress?.(`Checking availability of ${treeSize}-leaf circuit...`);
        const response = await fetch(config.zkeyUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`External zkey file not available: ${response.status}`);
        }
        onProgress?.(`✓ ${treeSize}-leaf circuit available from external source`);
      } catch (error) {
        console.warn(`Large circuit not available, falling back to 16-leaf: ${error}`);
        onProgress?.(`⚠️ ${treeSize}-leaf circuit unavailable, using 16-leaf fallback`);
        actualConfig = {
          wasmUrl: '/zk-assets/wasm/circuit_N4.wasm',
          zkeyUrl: `/zk-assets/zkey/circuit_final_16.zkey`,
          circuitName: 'circuit_N4'
        };
      }
    }

    onProgress?.('Preparing circuit input...');
    
    // Prepare circuit input (remove treeSize as circuit doesn't expect it)
    const circuitInput = {
      storage_keys_L2MPT: input.storage_keys_L2MPT,
      storage_values: input.storage_values
    };

    onProgress?.('Generating proof... This may take a few minutes...');

    // Generate the proof using snarkjs
    const { proof, publicSignals } = await groth16.fullProve(
      circuitInput,
      actualConfig.wasmUrl,
      actualConfig.zkeyUrl
    );

    onProgress?.('Formatting proof for Solidity...');

    // Helper function to split BLS12-381 field element into two uint256 parts for Solidity
    const splitFieldElement = (element: string): [string, string] => {
      const bigIntElement = BigInt(element);
      // BLS12-381 field elements are ~381 bits, convert to hex and pad to 96 characters (48 bytes)
      const hex = bigIntElement.toString(16).padStart(96, '0');
      
      // Split into two 32-byte (64 hex char) chunks for uint256 compatibility
      // Low part: last 64 hex characters (32 bytes)
      const lowHex = hex.slice(-64);
      // High part: first 32 hex characters (16 bytes), padded to 32 bytes
      const highHex = hex.slice(0, 32).padStart(64, '0');
      
      const lowPart = BigInt('0x' + lowHex).toString();
      const highPart = BigInt('0x' + highHex).toString();
      
      return [highPart, lowPart];
    };

    // Format proof for BLS12-381 Solidity contract
    const [pA_x_part1, pA_x_part2] = splitFieldElement(proof.pi_a[0]);
    const [pA_y_part1, pA_y_part2] = splitFieldElement(proof.pi_a[1]);
    
    const [pB_x0_part1, pB_x0_part2] = splitFieldElement(proof.pi_b[0][1]); // Inverted
    const [pB_x1_part1, pB_x1_part2] = splitFieldElement(proof.pi_b[0][0]); // Inverted
    const [pB_y0_part1, pB_y0_part2] = splitFieldElement(proof.pi_b[1][1]); // Inverted
    const [pB_y1_part1, pB_y1_part2] = splitFieldElement(proof.pi_b[1][0]); // Inverted
    
    const [pC_x_part1, pC_x_part2] = splitFieldElement(proof.pi_c[0]);
    const [pC_y_part1, pC_y_part2] = splitFieldElement(proof.pi_c[1]);
    
    const formattedProof = {
      pA: [BigInt(pA_x_part1), BigInt(pA_x_part2), BigInt(pA_y_part1), BigInt(pA_y_part2)] as const,
      pB: [BigInt(pB_x0_part1), BigInt(pB_x0_part2), BigInt(pB_x1_part1), BigInt(pB_x1_part2), BigInt(pB_y0_part1), BigInt(pB_y0_part2), BigInt(pB_y1_part1), BigInt(pB_y1_part2)] as const,
      pC: [BigInt(pC_x_part1), BigInt(pC_x_part2), BigInt(pC_y_part1), BigInt(pC_y_part2)] as const,
      merkleRoot: `0x${BigInt(publicSignals[0]).toString(16).padStart(64, '0')}` as `0x${string}`
    };

    onProgress?.('Proof generated successfully!');

    return {
      proof: formattedProof,
      publicSignals: publicSignals.map(signal => signal.toString()),
      rawProof: proof
    };

  } catch (error) {
    console.error('Client-side proof generation error:', error);
    throw error;
  }
}

/**
 * Check if client-side proof generation is supported
 */
export function isClientProofGenerationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for WebAssembly support
  if (typeof WebAssembly === 'undefined') return false;
  
  // Check for required APIs
  return !!(typeof window.fetch !== 'undefined' && typeof window.Worker !== 'undefined');
}

/**
 * Estimate memory requirements and download size for proof generation
 */
export function getMemoryRequirement(treeSize: number): string {
  const requirements = {
    16: '~512MB RAM',
    32: '~1GB RAM + 25MB download',
    64: '~2GB RAM + 51MB download', 
    128: '~4GB RAM + 102MB download'
  };
  return requirements[treeSize as keyof typeof requirements] || 'Unknown';
}

/**
 * Check if large circuit files need to be downloaded
 */
export function requiresExternalDownload(treeSize: number): boolean {
  return treeSize > 16;
}

/**
 * Get estimated download size for circuit
 */
export function getDownloadSize(treeSize: number): string {
  const sizes = {
    16: '0MB (local)',
    32: '25MB', 
    64: '51MB',
    128: '102MB'
  };
  return sizes[treeSize as keyof typeof sizes] || 'Unknown';
}