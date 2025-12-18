/**
 * FROST DKG API Route
 * 
 * Server-side API for handling FROST DKG operations using the Rust client.
 * This prevents browser compatibility issues with Node.js modules.
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

interface FrostDKGRequest {
  action: 'round1' | 'round2' | 'finalize' | 'status';
  sessionId: string;
  participantId: string;
  threshold?: number;
  maxSigners?: number;
  participants?: string[];
  round1Packages?: Array<{ participantId: string; packageHex: string }>;
  round2Packages?: Array<{ participantId: string; packages: string[] }>;
}

interface FrostDKGResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: FrostDKGRequest = await request.json();
    const { action, sessionId, participantId } = body;

    // Create session-specific working directory
    const workingDir = path.join(process.cwd(), 'frost-dkg', 'sessions', sessionId);
    const configPath = path.join(workingDir, 'config.json');
    const outputPath = path.join(workingDir, 'output');

    // Ensure directories exist
    await fs.mkdir(workingDir, { recursive: true });
    await fs.mkdir(outputPath, { recursive: true });

    switch (action) {
      case 'round1':
        return await handleRound1(body, workingDir, configPath, outputPath);
      
      case 'round2':
        return await handleRound2(body, workingDir, configPath, outputPath);
      
      case 'finalize':
        return await handleFinalize(body, workingDir, configPath, outputPath);
      
      case 'status':
        return await handleStatus(sessionId, workingDir);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('FROST DKG API error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

async function handleRound1(
  body: FrostDKGRequest,
  workingDir: string,
  configPath: string,
  outputPath: string
): Promise<NextResponse> {
  const { sessionId, participantId, threshold, maxSigners, participants } = body;

  // Create configuration file for Rust DKG client
  const dkgConfig = {
    session_id: sessionId,
    participant_id: participantId,
    threshold: threshold || 2,
    max_signers: maxSigners || 3,
    participants: participants || [],
    working_dir: workingDir,
    output_dir: outputPath
  };

  await fs.writeFile(configPath, JSON.stringify(dkgConfig, null, 2));

  return new Promise((resolve) => {
    // Spawn the Rust DKG client for Round 1
    const dkgProcess = spawn('cargo', ['run', '--release', '--', 'round1', configPath], {
      cwd: path.join(process.cwd(), 'frost-dkg', 'keygen', 'dkg'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    dkgProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    dkgProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    dkgProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          // Read the generated Round 1 package
          const packagePath = path.join(outputPath, 'round1_package.hex');
          const packageHex = await fs.readFile(packagePath, 'utf-8');
          
          console.log('✅ FROST Round 1 package generated successfully');
          resolve(NextResponse.json({
            success: true,
            data: { packageHex: packageHex.trim() }
          }));
          
        } catch (readError) {
          console.error('Failed to read Round 1 package:', readError);
          resolve(NextResponse.json(
            { success: false, error: `Failed to read Round 1 package: ${(readError as Error).message}` },
            { status: 500 }
          ));
        }
      } else {
        console.error('FROST DKG Round 1 failed:', stderr);
        resolve(NextResponse.json(
          { success: false, error: `FROST DKG Round 1 failed with code ${code}: ${stderr}` },
          { status: 500 }
        ));
      }
    });

    dkgProcess.on('error', (error) => {
      console.error('Failed to spawn FROST DKG process:', error);
      resolve(NextResponse.json(
        { success: false, error: `Failed to spawn DKG process: ${error.message}` },
        { status: 500 }
      ));
    });
  });
}

async function handleRound2(
  body: FrostDKGRequest,
  workingDir: string,
  configPath: string,
  outputPath: string
): Promise<NextResponse> {
  const { round1Packages } = body;

  if (!round1Packages) {
    return NextResponse.json(
      { success: false, error: 'Round 1 packages required for Round 2' },
      { status: 400 }
    );
  }

  // Write received Round 1 packages to input directory
  const inputDir = path.join(workingDir, 'round1_inputs');
  await fs.mkdir(inputDir, { recursive: true });

  for (const pkg of round1Packages) {
    const inputPath = path.join(inputDir, `${pkg.participantId}_round1.hex`);
    await fs.writeFile(inputPath, pkg.packageHex);
  }

  return new Promise((resolve) => {
    // Spawn the Rust DKG client for Round 2
    const dkgProcess = spawn('cargo', ['run', '--release', '--', 'round2', configPath, inputDir], {
      cwd: path.join(process.cwd(), 'frost-dkg', 'keygen', 'dkg'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    dkgProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    dkgProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    dkgProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          // Read the generated Round 2 packages
          const round2Dir = path.join(outputPath, 'round2_packages');
          const files = await fs.readdir(round2Dir);
          
          const round2Packages: string[] = [];
          for (const file of files) {
            if (file.endsWith('.hex')) {
              const packageHex = await fs.readFile(path.join(round2Dir, file), 'utf-8');
              round2Packages.push(packageHex.trim());
            }
          }
          
          console.log('✅ FROST Round 2 packages generated successfully');
          resolve(NextResponse.json({
            success: true,
            data: { packages: round2Packages }
          }));
          
        } catch (readError) {
          console.error('Failed to read Round 2 packages:', readError);
          resolve(NextResponse.json(
            { success: false, error: `Failed to read Round 2 packages: ${(readError as Error).message}` },
            { status: 500 }
          ));
        }
      } else {
        console.error('FROST DKG Round 2 failed:', stderr);
        resolve(NextResponse.json(
          { success: false, error: `FROST DKG Round 2 failed with code ${code}: ${stderr}` },
          { status: 500 }
        ));
      }
    });
  });
}

async function handleFinalize(
  body: FrostDKGRequest,
  workingDir: string,
  configPath: string,
  outputPath: string
): Promise<NextResponse> {
  const { round2Packages } = body;

  if (!round2Packages) {
    return NextResponse.json(
      { success: false, error: 'Round 2 packages required for finalization' },
      { status: 400 }
    );
  }

  // Write received Round 2 packages to input directory
  const inputDir = path.join(workingDir, 'round2_inputs');
  await fs.mkdir(inputDir, { recursive: true });

  for (const participant of round2Packages) {
    const participantDir = path.join(inputDir, participant.participantId);
    await fs.mkdir(participantDir, { recursive: true });
    
    for (let i = 0; i < participant.packages.length; i++) {
      const packagePath = path.join(participantDir, `package_${i}.hex`);
      await fs.writeFile(packagePath, participant.packages[i]);
    }
  }

  return new Promise((resolve) => {
    // Spawn the Rust DKG client for finalization
    const dkgProcess = spawn('cargo', ['run', '--release', '--', 'finalize', configPath, inputDir], {
      cwd: path.join(process.cwd(), 'frost-dkg', 'keygen', 'dkg'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    dkgProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    dkgProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    dkgProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          // Read the generated group verification key and key share
          const groupVkPath = path.join(outputPath, 'group.json');
          const keySharePath = path.join(outputPath, 'key_share.json');
          
          const groupData = JSON.parse(await fs.readFile(groupVkPath, 'utf-8'));
          const keyShareData = JSON.parse(await fs.readFile(keySharePath, 'utf-8'));
          
          console.log('✅ FROST DKG ceremony completed successfully');
          resolve(NextResponse.json({
            success: true,
            data: {
              groupVerifyingKey: groupData.group_public_key_hex,
              keyShare: keyShareData.key_share_hex
            }
          }));
          
        } catch (readError) {
          console.error('Failed to read finalization results:', readError);
          resolve(NextResponse.json(
            { success: false, error: `Failed to read finalization results: ${(readError as Error).message}` },
            { status: 500 }
          ));
        }
      } else {
        console.error('FROST DKG finalization failed:', stderr);
        resolve(NextResponse.json(
          { success: false, error: `FROST DKG finalization failed with code ${code}: ${stderr}` },
          { status: 500 }
        ));
      }
    });
  });
}

async function handleStatus(sessionId: string, workingDir: string): Promise<NextResponse> {
  try {
    // Check if session directory exists and get file status
    const exists = await fs.access(workingDir).then(() => true).catch(() => false);
    
    if (!exists) {
      return NextResponse.json({
        success: true,
        data: { status: 'not_started', sessionId }
      });
    }

    // Check for output files to determine session status
    const outputPath = path.join(workingDir, 'output');
    const round1Path = path.join(outputPath, 'round1_package.hex');
    const groupPath = path.join(outputPath, 'group.json');

    const round1Exists = await fs.access(round1Path).then(() => true).catch(() => false);
    const groupExists = await fs.access(groupPath).then(() => true).catch(() => false);

    let status = 'not_started';
    if (groupExists) {
      status = 'completed';
    } else if (round1Exists) {
      status = 'round1_complete';
    }

    return NextResponse.json({
      success: true,
      data: { status, sessionId }
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}