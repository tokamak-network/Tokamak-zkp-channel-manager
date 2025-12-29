import { NextRequest, NextResponse } from "next/server";
import { getData, deleteData } from "@/lib/local-db";

/**
 * POST /api/delete-proof
 *
 * Delete a proof from a channel.
 * - Leader can delete any proof at any time
 * - Submitter can only delete their own proof when it's in 'pending' status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId, proofKey, userAddress, isLeader: clientIsLeader } = body;

    if (!channelId || !proofKey || !userAddress) {
      return NextResponse.json(
        { error: "Missing required fields: channelId, proofKey, userAddress" },
        { status: 400 }
      );
    }

    // Get channel info
    const channel = await getData<any>(`channels/${channelId}`);
    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    // Check if user is leader - use client-provided value (client has on-chain data)
    // or check against stored leader if available
    const isLeader = clientIsLeader === true || 
      (channel.leader && channel.leader.toLowerCase() === userAddress.toLowerCase());

    // Find the proof in any of the proof collections
    let proof: any = null;
    let proofLocation: 'submittedProofs' | 'verifiedProofs' | 'rejectedProofs' | null = null;

    // Check submittedProofs first
    proof = await getData<any>(`channels/${channelId}/submittedProofs/${proofKey}`);
    if (proof) {
      proofLocation = 'submittedProofs';
    }

    // Check verifiedProofs if not found
    if (!proof) {
      proof = await getData<any>(`channels/${channelId}/verifiedProofs/${proofKey}`);
      if (proof) {
        proofLocation = 'verifiedProofs';
      }
    }

    // Check rejectedProofs if not found
    if (!proof) {
      proof = await getData<any>(`channels/${channelId}/rejectedProofs/${proofKey}`);
      if (proof) {
        proofLocation = 'rejectedProofs';
      }
    }

    if (!proof || !proofLocation) {
      return NextResponse.json(
        { error: "Proof not found" },
        { status: 404 }
      );
    }

    // Check permissions
    const isSubmitter =
      proof.submitter?.toLowerCase() === userAddress.toLowerCase();
    const isPending = proof.status === "pending" || proofLocation === 'submittedProofs';

    if (isLeader) {
      // Leader can delete any proof from any location
      await deleteData(`channels/${channelId}/${proofLocation}/${proofKey}`);

      return NextResponse.json({
        success: true,
        message: `Proof deleted by leader from ${proofLocation}`,
        deletedProofKey: proofKey,
        location: proofLocation,
      });
    } else if (isSubmitter && isPending) {
      // Submitter can delete their own pending proof
      await deleteData(`channels/${channelId}/${proofLocation}/${proofKey}`);

      return NextResponse.json({
        success: true,
        message: "Proof deleted by submitter",
        deletedProofKey: proofKey,
        location: proofLocation,
      });
    } else if (isSubmitter && !isPending) {
      return NextResponse.json(
        {
          error: "Cannot delete proof - only pending proofs can be deleted by submitter",
          status: proof.status,
          location: proofLocation,
        },
        { status: 403 }
      );
    } else {
      return NextResponse.json(
        { error: "Permission denied - you can only delete your own pending proofs" },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error("Error deleting proof:", error);
    return NextResponse.json(
      {
        error: "Failed to delete proof",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

