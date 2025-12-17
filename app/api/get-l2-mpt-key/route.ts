import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { ethers } from 'ethers';
import { ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI } from '@/lib/contracts';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/N-Gnpjy1WvCfokwj6fiOfuAVL_At6IvE')
});

export const runtime = "nodejs";

// Check if we're in a production serverless environment (Vercel)
const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';

// Import function conditionally
async function getGenerateMptKey() {
  if (isServerless) {
    return null;
  }
  const { generateMptKey } = await import("@/lib/mptKeyUtils");
  return generateMptKey;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Get the generateMptKey function
    const generateMptKey = await getGenerateMptKey();
    
    // In serverless environment, return error indicating this functionality is not available
    if (!generateMptKey) {
      return NextResponse.json(
        { 
          error: 'MPT key generation not available in serverless environment',
          message: 'Please use the client-side MPT key generator in the UI instead'
        },
        { status: 501 }
      );
    }
    
    // Create wallet from the private key sent from client
    const wallet = new ethers.Wallet(body.privateKey);
    
    const key = generateMptKey(wallet, body.participantName, body.channelId, body.tokenAddress, body.slot);
    return NextResponse.json({ key });
  } catch (error) {
    console.error('Error generating MPT key:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate MPT key',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const participant = searchParams.get('participant');
    const channelId = searchParams.get('channelId');

    if (!participant || !channelId) {
      return NextResponse.json(
        { error: 'Missing required parameters: participant, channelId' },
        { status: 400 }
      );
    }

    // Get L2 MPT key from contract
    const l2MptKey = await publicClient.readContract({
      address: ROLLUP_BRIDGE_CORE_ADDRESS,
      abi: ROLLUP_BRIDGE_CORE_ABI,
      functionName: 'getL2MptKey',
      args: [BigInt(channelId), participant as `0x${string}`]
    });

    return NextResponse.json({
      success: true,
      key: l2MptKey?.toString() || '0',
      participant,
      channelId
    });

  } catch (error) {
    console.error('Error fetching L2 MPT key:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch L2 MPT key',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}