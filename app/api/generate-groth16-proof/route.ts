import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

// Check if we're in a production serverless environment (Vercel)
const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';

// Only import these in non-serverless environments
let execSync: any, fs: any, path: any, os: any;
if (!isServerless) {
  ({ execSync } = require('child_process'));
  fs = require('fs');
  path = require('path');
  os = require('os');
}

interface CircuitInput {
  storage_keys_L2MPT: string[];
  storage_values: string[];
  treeSize?: number; // Optional tree size, defaults to infer from data length
}

export async function POST(request: NextRequest) {
  try {
    const body: CircuitInput = await request.json();
    
    // In production/serverless environment, return a mock proof for testing
    if (isServerless) {
      return await generateMockProof(body);
    }
    
    // Validate input
    if (!body.storage_keys_L2MPT || !body.storage_values) {
      return NextResponse.json(
        { error: 'Missing storage_keys_L2MPT or storage_values' },
        { status: 400 }
      );
    }

    // Determine tree size based on input length or explicit parameter
    const dataLength = body.storage_keys_L2MPT.length;
    let treeSize = body.treeSize || dataLength;
    
    // Validate tree size is supported (16, 32, 64, or 128)
    if (![16, 32, 64, 128].includes(treeSize)) {
      return NextResponse.json(
        { error: 'Tree size must be 16, 32, 64, or 128' },
        { status: 400 }
      );
    }
    
    if (body.storage_keys_L2MPT.length !== treeSize || body.storage_values.length !== treeSize) {
      return NextResponse.json(
        { error: `Both arrays must contain exactly ${treeSize} elements for tree size ${treeSize}` },
        { status: 400 }
      );
    }

    // Create temporary directory for proof generation
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'groth16-'));
    
    try {
      // Write input file
      const inputPath = path.join(tempDir, 'input.json');
      fs.writeFileSync(inputPath, JSON.stringify(body, null, 2));
      
      // Determine circuit paths based on tree size
      const getCircuitConfig = (size: number) => {
        const configs = {
          16: {
            proverDir: '16_leaves_groth',
            circuitName: 'circuit_N4',
            setupDir: '16_leaves'
          },
          32: {
            proverDir: '32_leaves_groth',
            circuitName: 'circuit_N5',
            setupDir: '32_leaves'
          },
          64: {
            proverDir: '64_leaves_groth',
            circuitName: 'circuit_N6',
            setupDir: '64_leaves'
          },
          128: {
            proverDir: '128_leaves_groth',
            circuitName: 'circuit_N7',
            setupDir: '128_leaves'
          }
        };
        return configs[size as keyof typeof configs];
      };
      
      const config = getCircuitConfig(treeSize);
      if (!config) {
        throw new Error(`Unsupported tree size: ${treeSize}`);
      }
      
      // Path to the generateProof.js script
      const proofScriptPath = path.join(
        process.cwd(),
        'proof-generation',
        config.proverDir,
        'generateProof.js'
      );
      
      // Check if script exists
      if (!fs.existsSync(proofScriptPath)) {
        throw new Error(`Proof script not found at: ${proofScriptPath}`);
      }
      
      // Copy input file to proof script directory
      const proofDir = path.dirname(proofScriptPath);
      const proofInputPath = path.join(proofDir, 'input.json');
      fs.copyFileSync(inputPath, proofInputPath);
      
      console.log('Generating proof with input:', body);
      console.log('Tree size:', treeSize);
      console.log('Circuit config:', config);
      console.log('Working directory:', proofDir);
      
      // Check if required files exist in the proof directory
      const wasmPath = path.join(proofDir, `../${config.circuitName}_js/${config.circuitName}.wasm`);
      const zkeyPath = path.join(proofDir, `../zkey/circuit_final_${treeSize}.zkey`);
      
      console.log('Checking for required files...');
      console.log('WASM path:', wasmPath);
      console.log('zKey path:', zkeyPath);
      
      if (!fs.existsSync(wasmPath)) {
        throw new Error(`WASM file not found at: ${wasmPath}. Please ensure the circuit is compiled.`);
      }
      if (!fs.existsSync(zkeyPath)) {
        throw new Error(`zKey file not found at: ${zkeyPath}. Please ensure the trusted setup is complete.`);
      }
      
      console.log('Required files found, executing proof generation...');
      
      // Execute proof generation script with longer timeout
      const output = execSync(`cd "${proofDir}" && node generateProof.js`, {
        encoding: 'utf-8',
        timeout: 600000, // 10 minutes timeout
        cwd: proofDir,
        stdio: ['inherit', 'pipe', 'pipe']
      });
      
      console.log(`Proof generation completed successfully for ${treeSize}-leaf tree`);
      console.log('Output:', output);
      
      // Read generated proof and public signals
      const proofPath = path.join(proofDir, 'proof.json');
      const publicPath = path.join(proofDir, 'public.json');
      
      if (!fs.existsSync(proofPath) || !fs.existsSync(publicPath)) {
        throw new Error('Proof generation failed - output files not found');
      }
      
      const proof = JSON.parse(fs.readFileSync(proofPath, 'utf-8'));
      const publicSignals = JSON.parse(fs.readFileSync(publicPath, 'utf-8'));
      
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
        pA: [pA_x_part1, pA_x_part2, pA_y_part1, pA_y_part2],
        pB: [pB_x0_part1, pB_x0_part2, pB_x1_part1, pB_x1_part2, pB_y0_part1, pB_y0_part2, pB_y1_part1, pB_y1_part2],
        pC: [pC_x_part1, pC_x_part2, pC_y_part1, pC_y_part2],
        merkleRoot: `0x${BigInt(publicSignals[0]).toString(16).padStart(64, '0')}`
      };
      
      // Clean up temporary files
      try {
        fs.unlinkSync(proofInputPath);
        fs.unlinkSync(path.join(proofDir, 'witness.wtns'));
        fs.unlinkSync(path.join(proofDir, 'proof.json'));
        fs.unlinkSync(path.join(proofDir, 'public.json'));
      } catch (e) {
        console.warn('Could not clean up temporary files:', e);
      }
      
      return NextResponse.json({
        success: true,
        proof: formattedProof, // Formatted for Solidity contract (BLS12-381 field elements split into uint256 pairs)
        publicSignals,
        rawProof: proof // Original snarkjs proof format
      });
      
    } finally {
      // Clean up temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Could not clean up temp directory:', e);
      }
    }
    
  } catch (error) {
    console.error('Proof generation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: 'Proof generation failed',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a mock proof for production/serverless environments
 * This returns a valid proof structure but with dummy values for testing
 * In a real production environment, this should call an external proof generation service
 */
async function generateMockProof(body: CircuitInput): Promise<NextResponse> {
  try {
    // Validate input
    if (!body.storage_keys_L2MPT || !body.storage_values) {
      return NextResponse.json(
        { error: 'Missing storage_keys_L2MPT or storage_values' },
        { status: 400 }
      );
    }

    // Determine tree size
    const dataLength = body.storage_keys_L2MPT.length;
    let treeSize = body.treeSize || dataLength;
    
    // Validate tree size is supported
    if (![16, 32, 64, 128].includes(treeSize)) {
      return NextResponse.json(
        { error: 'Tree size must be 16, 32, 64, or 128' },
        { status: 400 }
      );
    }
    
    if (body.storage_keys_L2MPT.length !== treeSize || body.storage_values.length !== treeSize) {
      return NextResponse.json(
        { error: `Both arrays must contain exactly ${treeSize} elements for tree size ${treeSize}` },
        { status: 400 }
      );
    }

    // Simulate proof generation delay (shorter for serverless)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate a deterministic mock merkle root based on input data
    const inputHash = await crypto.subtle.digest(
      'SHA-256', 
      new TextEncoder().encode(JSON.stringify(body))
    );
    const hashArray = Array.from(new Uint8Array(inputHash));
    const merkleRoot = `0x${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
    
    // Mock proof structure with dummy but properly formatted values
    const mockProof = {
      pA: [
        "1000000000000000000000000000000000000000000000000000000000000001", // Mock field element part 1
        "2000000000000000000000000000000000000000000000000000000000000002", // Mock field element part 2
        "3000000000000000000000000000000000000000000000000000000000000003", // Mock field element part 3
        "4000000000000000000000000000000000000000000000000000000000000004"  // Mock field element part 4
      ],
      pB: [
        "5000000000000000000000000000000000000000000000000000000000000005",
        "6000000000000000000000000000000000000000000000000000000000000006",
        "7000000000000000000000000000000000000000000000000000000000000007",
        "8000000000000000000000000000000000000000000000000000000000000008",
        "9000000000000000000000000000000000000000000000000000000000000009",
        "10000000000000000000000000000000000000000000000000000000000000010",
        "11000000000000000000000000000000000000000000000000000000000000011",
        "12000000000000000000000000000000000000000000000000000000000000012"
      ],
      pC: [
        "13000000000000000000000000000000000000000000000000000000000000013",
        "14000000000000000000000000000000000000000000000000000000000000014",
        "15000000000000000000000000000000000000000000000000000000000000015",
        "16000000000000000000000000000000000000000000000000000000000000016"
      ],
      merkleRoot: merkleRoot
    };

    const publicSignals = [
      BigInt(merkleRoot).toString()
    ];

    return NextResponse.json({
      success: true,
      proof: mockProof,
      publicSignals,
      rawProof: {
        pi_a: mockProof.pA.slice(0, 2),
        pi_b: [[mockProof.pB[2], mockProof.pB[0]], [mockProof.pB[6], mockProof.pB[4]]],
        pi_c: mockProof.pC.slice(0, 2)
      },
      note: "This is a mock proof generated for production environment. In a real deployment, integrate with an external proof generation service."
    });

  } catch (error) {
    console.error('Mock proof generation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Mock proof generation failed',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}