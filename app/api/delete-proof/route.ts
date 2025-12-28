import { NextRequest, NextResponse } from "next/server";
import { getData, deleteData } from "@/lib/realtime-db-helpers";

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
    const { channelId, proofKey, userAddress } = body;

    if (!channelId || !proofKey || !userAddress) {
      return NextResponse.json(
        { error: "Missing required fields: channelId, proofKey, userAddress" },
        { status: 400 }
      );
    }

    // Get channel info to check if user is leader
    const channel = await getData<any>(`channels/${channelId}`);
    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    const isLeader = channel.leader?.toLowerCase() === userAddress.toLowerCase();

    // Find the proof in submittedProofs
    const proof = await getData<any>(
      `channels/${channelId}/submittedProofs/${proofKey}`
    );

    if (!proof) {
      return NextResponse.json(
        { error: "Proof not found" },
        { status: 404 }
      );
    }

    // Check permissions
    const isSubmitter =
      proof.submitter?.toLowerCase() === userAddress.toLowerCase();
    const isPending = proof.status === "pending";

    if (isLeader) {
      // Leader can delete any proof
      await deleteData(`channels/${channelId}/submittedProofs/${proofKey}`);

      return NextResponse.json({
        success: true,
        message: "Proof deleted by leader",
        deletedProofKey: proofKey,
      });
    } else if (isSubmitter && isPending) {
      // Submitter can delete their own pending proof
      await deleteData(`channels/${channelId}/submittedProofs/${proofKey}`);

      return NextResponse.json({
        success: true,
        message: "Proof deleted by submitter",
        deletedProofKey: proofKey,
      });
    } else if (isSubmitter && !isPending) {
      return NextResponse.json(
        {
          error: "Cannot delete proof - only pending proofs can be deleted by submitter",
          status: proof.status,
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

