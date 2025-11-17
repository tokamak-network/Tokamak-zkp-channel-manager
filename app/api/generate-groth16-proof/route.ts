import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface CircuitInput {
  storage_keys_L2MPT: string[];
  storage_values: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: CircuitInput = await request.json();
    
    // Validate input
    if (!body.storage_keys_L2MPT || !body.storage_values) {
      return NextResponse.json(
        { error: 'Missing storage_keys_L2MPT or storage_values' },
        { status: 400 }
      );
    }

    if (body.storage_keys_L2MPT.length !== 16 || body.storage_values.length !== 16) {
      return NextResponse.json(
        { error: 'Both arrays must contain exactly 16 elements' },
        { status: 400 }
      );
    }

    // Create temporary directory for proof generation
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'groth16-'));
    
    try {
      // Write input file
      const inputPath = path.join(tempDir, 'input.json');
      fs.writeFileSync(inputPath, JSON.stringify(body, null, 2));
      
      // Path to the generateProof.js script
      const proofScriptPath = path.join(
        process.cwd(),
        'Tokamak-Zk-EVM',
        'packages',
        'BLS12-Poseidon-Merkle-tree-Groth16',
        'prover',
        '16_leaves',
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
      console.log('Working directory:', proofDir);
      
      // Check if required files exist in the proof directory
      const wasmPath = path.join(proofDir, '../../circuits/build/circuit_N4_js/circuit_N4.wasm');
      const zkeyPath = path.join(proofDir, '../../trusted-setup/16_leaves/circuit_final.zkey');
      
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
      
      console.log('Proof generation completed successfully');
      console.log('Output:', output);
      
      // Read generated proof and public signals
      const proofPath = path.join(proofDir, 'proof.json');
      const publicPath = path.join(proofDir, 'public.json');
      
      if (!fs.existsSync(proofPath) || !fs.existsSync(publicPath)) {
        throw new Error('Proof generation failed - output files not found');
      }
      
      const proof = JSON.parse(fs.readFileSync(proofPath, 'utf-8'));
      const publicSignals = JSON.parse(fs.readFileSync(publicPath, 'utf-8'));
      
      // Helper function to split BLS12-381 field element into PART1/PART2 format matching Solidity test
      const splitFieldElement = (element: string): [string, string] => {
        const bigIntElement = BigInt(element);
        // Convert to hex and pad to 96 characters (48 bytes for BLS12-381 field elements)
        const hex = bigIntElement.toString(16).padStart(96, '0');
        
        // PART1: 16 bytes of zeros + first 16 bytes of field element (32 bytes total)
        const part1Hex = '00000000000000000000000000000000' + hex.slice(0, 32);
        
        // PART2: last 32 bytes of field element  
        const part2Hex = hex.slice(32, 96);
        
        const part1 = BigInt('0x' + part1Hex).toString();
        const part2 = BigInt('0x' + part2Hex).toString();
        
        return [part1, part2];
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
        proof: formattedProof,
        publicSignals,
        rawProof: proof
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