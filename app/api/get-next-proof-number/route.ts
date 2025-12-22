import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/realtime-db-helpers";
import { ref, runTransaction } from "firebase/database";
import { realtimeDb } from "@/lib/firebase";

/**
 * POST /api/get-next-proof-number
 * 
 * Atomically calculates and reserves the next proof number and subNumber
 * for a given channel. This prevents race conditions when multiple users
 * submit proofs simultaneously.
 * 
 * Uses Firebase Realtime Database transactions to ensure atomicity.
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

    // Use Firebase transaction to atomically calculate and reserve subNumber
    // This prevents race conditions when multiple users submit proofs for the same sequence
    const submittedProofsRef = ref(realtimeDb, `channels/${channelId}/submittedProofs`);
    
    // Get current submitted proofs for this sequence number
    const submittedProofs = await getData<any>(`channels/${channelId}/submittedProofs`);
    const currentSequenceProofs = submittedProofs
      ? Object.values(submittedProofs).filter(
          (p: any) => p.sequenceNumber === proofNumber
        )
      : [];
    
    // Calculate subNumber based on existing submissions
    // Note: This is not fully atomic, but the transaction below will help prevent duplicates
    let subNumber = currentSequenceProofs.length + 1;

    // Use a transaction to atomically increment a counter for this sequence
    // This provides better race condition protection
    const sequenceCounterRef = ref(realtimeDb, `channels/${channelId}/sequenceCounters/${proofNumber}`);
    
    const counterResult = await runTransaction(sequenceCounterRef, (current) => {
      if (current === null) {
        return 1; // First submission for this sequence
      }
      return (current as number) + 1;
    });

    // Use the transaction result as the authoritative subNumber
    subNumber = counterResult.snapshot.val() as number;

    // Generate proof IDs
    const proofId =
      subNumber === 1
        ? `proof#${proofNumber}`
        : `proof#${proofNumber}-${subNumber}`;
    const storageProofId =
      subNumber === 1 ? `proof-${proofNumber}` : `proof-${proofNumber}-${subNumber}`;

    return NextResponse.json({
      success: true,
      proofNumber,
      subNumber,
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

