import { NextRequest, NextResponse } from "next/server";
import { setData } from "@/lib/local-db";
import fs from "fs/promises";
import path from "path";

// Directory for storing uploaded ZIP files
const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const channelId = formData.get("channelId") as string;
    const proofId = formData.get("proofId") as string;

    if (!file || !channelId || !proofId) {
      return NextResponse.json(
        { error: "Missing required fields: file, channelId, or proofId" },
        { status: 400 }
      );
    }

    // Check file size
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB limit (increased since we're saving to file)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          details: `ZIP file is ${(file.size / 1024 / 1024).toFixed(
            2
          )}MB. Maximum size is ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB.`,
        },
        { status: 400 }
      );
    }

    // Create directory structure: data/uploads/channels/{channelId}/proofs/
    const channelDir = path.join(UPLOADS_DIR, "channels", channelId, "proofs");
    await fs.mkdir(channelDir, { recursive: true });

    // Save ZIP file to disk
    const fileName = `${proofId.replace(/[^a-zA-Z0-9_.-]/g, '')}.zip`;
    const filePath = path.join(channelDir, fileName);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    // Save metadata to database (without the actual file content)
    const dbPath = `channels/${channelId}/submittedProofs/${proofId}/zipFile`;
    const relativePath = path.relative(process.cwd(), filePath);
    
    await setData(dbPath, {
      filePath: relativePath, // Store relative path to the file
      fileName: file.name,
      mimeType: "application/zip",
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      path: dbPath,
      filePath: relativePath,
      size: file.size,
    });
  } catch (error) {
    console.error("Save ZIP file error:", error);
    return NextResponse.json(
      {
        error: "Failed to save ZIP file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
