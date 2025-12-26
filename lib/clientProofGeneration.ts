import { groth16 } from 'snarkjs';

export interface CircuitInput {
  storage_keys_L2MPT: string[];
  storage_values: string[];
  treeSize?: number;
}

// External storage config removed - using only local 16-leaf circuit for now
// export interface ExternalStorageConfig {
//   provider: 'github-releases' | 'aws-s3' | 'ipfs' | 'vercel-blob';
//   baseUrl: string;
//   fallbackUrls?: string[];
// }

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

    // Use appropriate circuit for each tree size 
    // Large files (64+, 128-leaf) are served via API proxy from Cloudflare R2
    const getCircuitConfig = (size: number) => {
      const configs = {
        16: {
          wasmUrl: '/zk-assets/wasm/circuit_N4.wasm',
          zkeyUrl: `/zk-assets/zkey/circuit_final_16.zkey`,
          circuitName: 'circuit_N4',
          actualTreeSize: 16
        },
        32: {
          wasmUrl: '/zk-assets/wasm/circuit_N5.wasm',
          zkeyUrl: `/zk-assets/zkey/circuit_final_32.zkey`,
          circuitName: 'circuit_N5',
          actualTreeSize: 32
        },
        64: {
          wasmUrl: '/zk-assets/wasm/circuit_N6.wasm',
          zkeyUrl: `/api/proxy-large-zkey?size=64`,
          circuitName: 'circuit_N6', 
          actualTreeSize: 64
        },
        128: {
          wasmUrl: '/zk-assets/wasm/circuit_N7.wasm',
          zkeyUrl: `/api/proxy-large-zkey?size=128`,
          circuitName: 'circuit_N7',
          actualTreeSize: 128
        }
      };
      
      return configs[size as keyof typeof configs] || configs[16]; // Fallback to 16 if unsupported size
    };

    const config = getCircuitConfig(treeSize);
    if (!config) {
      throw new Error(`Unsupported tree size: ${treeSize}`);
    }

    // Use the circuit that matches the requested tree size
    const actualConfig = config;
    
    // Verify file accessibility for larger circuits
    if (treeSize > 16) {
      console.log('🔍 VERIFYING LARGE CIRCUIT FILES:');
      console.log(`  WASM file: ${actualConfig.wasmUrl}`);
      console.log(`  zkey file: ${actualConfig.zkeyUrl}`);
      console.log(`  Expected tree size: ${treeSize} leaves`);
      
      // Info about large file serving
      if (treeSize >= 64) {
        console.log('🌐 NOTE: Large zkey files (64+ leaves) served via Cloudflare R2');
        console.log('📋 Architecture:');
        console.log('   1. Files hosted on Cloudflare R2 bucket');
        console.log('   2. Served via Next.js API proxy at /api/proxy-large-zkey');
        console.log('   3. CORS and caching handled automatically');
        console.log('   4. No manual setup required - works out of the box!');
      }
    }
    
    console.log('🔍 CLIENT PROOF GENERATION DEBUG:');
    console.log('  Requested Tree Size:', treeSize);
    console.log('  Input Keys Length:', input.storage_keys_L2MPT.length);
    console.log('  Input Values Length:', input.storage_values.length);
    console.log('  Using Config:', actualConfig);
    
    // Check if we're using the correct circuit size
    if (actualConfig.actualTreeSize === treeSize) {
      console.log('✅ PERFECT MATCH: Using', treeSize, '-leaf circuit for', treeSize, '-leaf tree');
      onProgress?.(`Using ${treeSize}-leaf circuit (perfect match)`);
      
      // Add performance warnings for larger circuits
      if (treeSize >= 64) {
        console.warn('⚠️ PERFORMANCE WARNING: Large circuit detected');
        console.warn(`  ${treeSize}-leaf proof generation requires ${getMemoryRequirement(treeSize)} and may take 5-15 minutes`);
        console.warn('  Please ensure sufficient RAM and close other applications');
        onProgress?.(`⚠️ Large circuit: ${getMemoryRequirement(treeSize)} required, this will take several minutes...`);
      }
    } else {
      console.warn('⚠️ TREE SIZE MISMATCH: Requested', treeSize, 'but using', actualConfig.actualTreeSize, '-leaf circuit');
      onProgress?.(`⚠️ Using ${actualConfig.actualTreeSize}-leaf circuit instead of ${treeSize}-leaf`);
    }

    onProgress?.('Preparing circuit input...');
    
    // Use the actual tree size from the config
    const actualTreeSize = actualConfig.actualTreeSize;
    
    console.log('  Actual Tree Size Used:', actualTreeSize);
    console.log('  Original Input Keys (first 5):', input.storage_keys_L2MPT.slice(0, 5));
    console.log('  Original Input Values (first 5):', input.storage_values.slice(0, 5));
    
    // Prepare circuit input with proper size for the actual circuit being used
    const circuitInput = {
      storage_keys_L2MPT: input.storage_keys_L2MPT.slice(0, actualTreeSize),
      storage_values: input.storage_values.slice(0, actualTreeSize)
    };
    
    console.log('  Truncated Input Keys Length:', circuitInput.storage_keys_L2MPT.length);
    console.log('  Truncated Input Values Length:', circuitInput.storage_values.length);
    console.log('  Truncated Keys (first 5):', circuitInput.storage_keys_L2MPT.slice(0, 5));
    console.log('  Truncated Values (first 5):', circuitInput.storage_values.slice(0, 5));
    
    if (actualTreeSize !== treeSize) {
      onProgress?.(`⚠️ Using ${actualTreeSize}-leaf circuit instead of ${treeSize}-leaf (input truncated)`);
    }

    onProgress?.('Generating proof... Please wait a few seconds...');

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

    console.log('🔍 PROOF GENERATION COMPLETED:');
    console.log('  Raw Proof:', proof);
    console.log('  Public Signals:', publicSignals);
    console.log('  Formatted Proof pA:', formattedProof.pA);
    console.log('  Formatted Proof pB:', formattedProof.pB);
    console.log('  Formatted Proof pC:', formattedProof.pC);
    console.log('  Merkle Root:', formattedProof.merkleRoot);
    console.log('  Public Signals Count:', publicSignals.length);

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
 * Estimate memory requirements for proof generation
 */
export function getMemoryRequirement(treeSize: number): string {
  const requirements = {
    16: '~512MB RAM',
    32: '~1GB RAM',
    64: '~2GB RAM',
    128: '~4GB RAM'
  };
  return requirements[treeSize as keyof typeof requirements] || '~512MB RAM';
}

/**
 * Check if large circuit files need to be downloaded
 * Large files (64+ leaves) are served via API proxy from Cloudflare R2
 */
export function requiresExternalDownload(treeSize: number): boolean {
  return false; // All files now available via API proxy
}

/**
 * Get estimated download size for circuit
 * Large files are served from Cloudflare R2 via API proxy
 */
export function getDownloadSize(treeSize: number): string {
  const sizes = {
    16: '0MB (local)',
    32: '0MB (local)', 
    64: '~51MB (from R2)',
    128: '~102MB (from R2)'
  };
  return sizes[treeSize as keyof typeof sizes] || '0MB (local)';
}

/**
 * Verify that all required circuit files are available
 * Useful for testing and debugging
 */
export async function verifyCircuitFiles(): Promise<{
  available: number[];
  missing: number[];
  details: Record<number, {wasmUrl: string, zkeyUrl: string, wasmExists?: boolean, zkeyExists?: boolean}>;
}> {
  const sizes = [16, 32, 64, 128];
  const available: number[] = [];
  const missing: number[] = [];
  const details: Record<number, any> = {};
  
  for (const size of sizes) {
    const configs = {
      16: { wasmUrl: '/zk-assets/wasm/circuit_N4.wasm', zkeyUrl: '/zk-assets/zkey/circuit_final_16.zkey' },
      32: { wasmUrl: '/zk-assets/wasm/circuit_N5.wasm', zkeyUrl: '/zk-assets/zkey/circuit_final_32.zkey' },
      64: { wasmUrl: '/zk-assets/wasm/circuit_N6.wasm', zkeyUrl: '/api/proxy-large-zkey?size=64' },
      128: { wasmUrl: '/zk-assets/wasm/circuit_N7.wasm', zkeyUrl: '/api/proxy-large-zkey?size=128' }
    };
    
    const config = configs[size as keyof typeof configs];
    details[size] = {
      wasmUrl: config.wasmUrl,
      zkeyUrl: config.zkeyUrl
    };
    
    try {
      // Check if files are accessible
      const wasmResponse = await fetch(config.wasmUrl, { method: 'HEAD' });
      const zkeyResponse = await fetch(config.zkeyUrl, { method: 'HEAD' });
      
      details[size].wasmExists = wasmResponse.ok;
      details[size].zkeyExists = zkeyResponse.ok;
      
      if (wasmResponse.ok && zkeyResponse.ok) {
        available.push(size);
      } else {
        missing.push(size);
      }
    } catch (error) {
      details[size].wasmExists = false;
      details[size].zkeyExists = false;
      missing.push(size);
    }
  }
  
  return { available, missing, details };
}