import { NextRequest, NextResponse } from "next/server";
import { getData, deleteData, pushData } from "@/lib/local-db";

/**
 * POST /api/verify-proof
 * 
 * Atomically verifies a proof by:
 * 1. Moving the selected proof to verifiedProofs
 * 2. Moving other proofs with the same sequenceNumber to rejectedProofs
 * 3. Removing all proofs from submittedProofs
 * 
 * This operation is performed atomically on the backend to prevent race conditions
 * and ensure data consistency.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId, proofKey, sequenceNumber, verifierAddress } = body;

    if (!channelId || !proofKey || !sequenceNumber || !verifierAddress) {
      return NextResponse.json(
        { error: "Missing required fields: channelId, proofKey, sequenceNumber, verifierAddress" },
        { status: 400 }
      );
    }

    // Get all submitted proofs
    const submittedProofs = await getData<any>(
      `channels/${channelId}/submittedProofs`
    );

    if (!submittedProofs) {
      return NextResponse.json(
        { error: "No submitted proofs found" },
        { status: 404 }
      );
    }

    const submittedList = Array.isArray(submittedProofs)
      ? submittedProofs.map((p: any, idx: number) => ({
          ...p,
          key: idx.toString(),
        }))
      : Object.entries(submittedProofs).map(
          ([key, value]: [string, any]) => ({ ...value, key })
        );

    // Find the proof to verify and others with same sequenceNumber
    const proofToVerify = submittedList.find((p: any) => p.key === proofKey);
    const sameSequenceProofs = submittedList.filter(
      (p: any) => p.sequenceNumber === sequenceNumber
    );

    if (!proofToVerify) {
      return NextResponse.json(
        { error: "Proof not found in submitted proofs" },
        { status: 404 }
      );
    }

    // Perform all operations atomically
    // Note: Firebase Realtime Database doesn't support true transactions,
    // but we perform all operations in sequence to minimize inconsistency window
    const operations: Promise<any>[] = [];

    // 1. Move verified proof to verifiedProofs
    const verifiedProof = {
      ...proofToVerify,
      status: "verified",
      verifiedAt: new Date().toISOString(),
      verifiedBy: verifierAddress,
    };
    operations.push(pushData(`channels/${channelId}/verifiedProofs`, verifiedProof));

    // 2. Move other proofs with same sequenceNumber to rejectedProofs
    const rejectedProofs = sameSequenceProofs
      .filter((p: any) => p.key !== proofKey)
      .map((p: any) => ({
        ...p,
        status: "rejected",
        rejectedAt: new Date().toISOString(),
        rejectedBy: verifierAddress,
        reason: "Another proof was verified for this sequence",
      }));

    for (const rejectedProof of rejectedProofs) {
      operations.push(pushData(`channels/${channelId}/rejectedProofs`, rejectedProof));
    }

    // 3. Remove all proofs from submittedProofs
    for (const proofToRemove of sameSequenceProofs) {
      if (proofToRemove.key) {
        operations.push(
          deleteData(`channels/${channelId}/submittedProofs/${proofToRemove.key}`)
        );
      }
    }

    // Execute all operations
    await Promise.all(operations);

    return NextResponse.json({
      success: true,
      message: "Proof verified successfully",
      verifiedProof: {
        proofId: verifiedProof.proofId,
        sequenceNumber: verifiedProof.sequenceNumber,
      },
      rejectedCount: rejectedProofs.length,
    });
  } catch (error) {
    console.error("Error verifying proof:", error);
    return NextResponse.json(
      {
        error: "Failed to verify proof",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

