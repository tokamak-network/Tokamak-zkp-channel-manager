import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/local-db";
import fs from "fs/promises";
import path from "path";

/**
 * GET /api/get-proof-zip?channelId=1&proofId=proof-1
 * 
 * Returns the ZIP file content as base64 for client-side processing
 * or as binary for direct download
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const proofId = searchParams.get("proofId");
    const proofStatus = searchParams.get("status") || "submittedProofs"; // submittedProofs, verifiedProofs, rejectedProofs
    const format = searchParams.get("format") || "base64"; // base64 or binary

    if (!channelId || !proofId) {
      return NextResponse.json(
        { error: "Missing required parameters: channelId and proofId" },
        { status: 400 }
      );
    }

    // Get file metadata from database
    const dbPath = `channels/${channelId}/${proofStatus}/${proofId}/zipFile`;
    const zipMetadata = await getData<{
      filePath?: string;
      content?: string; // Legacy: base64 content
      fileName: string;
      size: number;
    }>(dbPath);

    if (!zipMetadata) {
      return NextResponse.json(
        { error: "ZIP file not found" },
        { status: 404 }
      );
    }

    let content: string;

    // Check if it's a file path (new format) or base64 content (legacy)
    if (zipMetadata.filePath) {
      // New format: read from file
      // Security: Validate path to prevent directory traversal attacks
      const absolutePath = path.resolve(process.cwd(), zipMetadata.filePath);
      const uploadsDir = path.join(process.cwd(), "data", "uploads");
      
      // Ensure the resolved path is within the allowed uploads directory
      if (!absolutePath.startsWith(uploadsDir)) {
        console.error("Path traversal attempt detected:", zipMetadata.filePath);
        return NextResponse.json(
          { error: "Invalid file path" },
          { status: 403 }
        );
      }
      
      try {
        const fileBuffer = await fs.readFile(absolutePath);
        
        if (format === "binary") {
          // Return as binary for direct download
          return new NextResponse(fileBuffer, {
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": `attachment; filename="${zipMetadata.fileName}"`,
              "Content-Length": fileBuffer.length.toString(),
            },
          });
        }
        
        // Convert to base64 for client-side processing
        content = fileBuffer.toString("base64");
      } catch (err) {
        console.error("Failed to read ZIP file:", err);
        return NextResponse.json(
          { error: "Failed to read ZIP file from disk" },
          { status: 500 }
        );
      }
    } else if (zipMetadata.content) {
      // Legacy format: base64 content stored in database
      content = zipMetadata.content;
      
      if (format === "binary") {
        const buffer = Buffer.from(content, "base64");
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${zipMetadata.fileName}"`,
            "Content-Length": buffer.length.toString(),
          },
        });
      }
    } else {
      return NextResponse.json(
        { error: "ZIP file content not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      content,
      fileName: zipMetadata.fileName,
      size: zipMetadata.size,
    });
  } catch (error) {
    console.error("Get ZIP file error:", error);
    return NextResponse.json(
      {
        error: "Failed to get ZIP file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

