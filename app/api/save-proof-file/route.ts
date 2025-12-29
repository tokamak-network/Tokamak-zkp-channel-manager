import { NextRequest, NextResponse } from "next/server";
import { setData } from "@/lib/local-db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const channelId = formData.get("channelId") as string;
    const filePath = formData.get("filePath") as string; // relative path in ZIP

    if (!file || !channelId || !filePath) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check file size - local DB can handle larger files
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          details: `File ${filePath} is ${(file.size / 1024 / 1024).toFixed(
            2
          )}MB. Maximum size is ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB.`,
        },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Save to local database
    const dbPath = `channels/${channelId}/submittedProofs/${filePath}`;
    await setData(dbPath, {
      content: base64,
      fileName: filePath.split("/").pop(),
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      path: dbPath,
      size: file.size,
    });
  } catch (error) {
    console.error("Save file error:", error);
    return NextResponse.json(
      {
        error: "Failed to save file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
