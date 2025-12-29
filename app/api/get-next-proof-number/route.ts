import { NextRequest, NextResponse } from "next/server";
import { getData, runTransaction } from "@/lib/local-db";

/**
 * POST /api/get-next-proof-number
 * 
 * Atomically calculates and reserves the next proof number and subNumber
 * for a given channel. This prevents race conditions when multiple users
 * submit proofs simultaneously.
 * 
 * Uses local database transactions to ensure atomicity.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId } = body;

    if (!channelId) {
      return NextResponse.json(
        { error: "Missing required field: channelId" },
        { status: 400 }
      );
    }

    // Get verified proofs count to determine next sequence number
    // This is the source of truth for sequence numbers
    const verifiedProofs = await getData<any>(`channels/${channelId}/verifiedProofs`);
    const verifiedCount = verifiedProofs ? Object.keys(verifiedProofs).length : 0;
    const proofNumber = verifiedCount + 1;

    // Get current submitted proofs for this sequence number
    const submittedProofs = await getData<any>(`channels/${channelId}/submittedProofs`);
    const currentSequenceProofs = submittedProofs
      ? Object.values(submittedProofs).filter(
          (p: any) => p.sequenceNumber === proofNumber
        )
      : [];
    
    // Calculate subNumber based on ACTUAL existing submissions
    // Find the highest existing subNumber for this sequence and add 1
    let maxSubNumber = 0;
    if (currentSequenceProofs.length > 0) {
      for (const proof of currentSequenceProofs) {
        const sub = (proof as any).subNumber || 1;
        if (sub > maxSubNumber) {
          maxSubNumber = sub;
        }
      }
    }
    
    // Use a transaction to atomically reserve the next subNumber
    const counterPath = `channels/${channelId}/sequenceCounters/${proofNumber}`;
    
    const nextSubNumber = await runTransaction<number>(counterPath, (current) => {
      const nextSub = maxSubNumber + 1;
      
      // If current counter is behind actual data, reset it
      if (current === null || current < nextSub) {
        return nextSub;
      }
      // Otherwise increment normally (handles concurrent submissions)
      return current + 1;
    });

    // Generate proof IDs
    const proofId =
      nextSubNumber === 1
        ? `proof#${proofNumber}`
        : `proof#${proofNumber}-${nextSubNumber}`;
    const storageProofId =
      nextSubNumber === 1 ? `proof-${proofNumber}` : `proof-${proofNumber}-${nextSubNumber}`;

    return NextResponse.json({
      success: true,
      proofNumber,
      subNumber: nextSubNumber,
      proofId,
      storageProofId,
    });
  } catch (error) {
    console.error("Error getting next proof number:", error);
    return NextResponse.json(
      {
        error: "Failed to get next proof number",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
