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
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const proofId = searchParams.get("proofId");
    const proofStatus = searchParams.get("status") || "submittedProofs"; // submittedProofs, verifiedProofs, rejectedProofs
    const format = searchParams.get("format") || "base64"; // base64 or binary

    console.log(`[${requestId}] get-proof-zip: Request received`, {
      channelId,
      proofId,
      proofStatus,
      format,
      url: request.url,
    });

    if (!channelId || !proofId) {
      console.error(`[${requestId}] get-proof-zip: Missing parameters`, { channelId, proofId });
      return NextResponse.json(
        { error: "Missing required parameters: channelId and proofId" },
        { status: 400 }
      );
    }

    // Get file metadata from database
    const dbPath = `channels/${channelId}/${proofStatus}/${proofId}/zipFile`;
    console.log(`[${requestId}] get-proof-zip: Querying database`, { dbPath });
    
    const zipMetadata = await getData<{
      filePath?: string;
      content?: string; // Legacy: base64 content
      fileName: string;
      size: number;
    }>(dbPath);

    console.log(`[${requestId}] get-proof-zip: Database query result`, {
      dbPath,
      found: !!zipMetadata,
      hasFilePath: !!zipMetadata?.filePath,
      hasContent: !!zipMetadata?.content,
      fileName: zipMetadata?.fileName,
      size: zipMetadata?.size,
      metadataKeys: zipMetadata ? Object.keys(zipMetadata) : [],
    });

    if (!zipMetadata) {
      // Try to get parent path to see what exists
      const parentPath = `channels/${channelId}/${proofStatus}/${proofId}`;
      const parentData = await getData(parentPath);
      const statusPath = `channels/${channelId}/${proofStatus}`;
      const statusData = await getData(statusPath);
      
      console.error(`[${requestId}] get-proof-zip: ZIP metadata not found`, {
        dbPath,
        parentPath,
        parentDataExists: !!parentData,
        parentDataKeys: parentData ? Object.keys(parentData) : [],
        statusPath,
        statusDataExists: !!statusData,
        statusDataKeys: statusData ? Object.keys(statusData) : [],
      });
      
      return NextResponse.json(
        { 
          error: "ZIP file not found",
          debug: {
            dbPath,
            parentPath,
            parentDataExists: !!parentData,
            statusDataExists: !!statusData,
          }
        },
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
      
      console.log(`[${requestId}] get-proof-zip: File path format detected`, {
        filePath: zipMetadata.filePath,
        absolutePath,
        uploadsDir,
        cwd: process.cwd(),
      });
      
      // Ensure the resolved path is within the allowed uploads directory
      if (!absolutePath.startsWith(uploadsDir)) {
        console.error(`[${requestId}] get-proof-zip: Path traversal attempt detected`, {
          filePath: zipMetadata.filePath,
          absolutePath,
          uploadsDir,
        });
        return NextResponse.json(
          { error: "Invalid file path" },
          { status: 403 }
        );
      }
      
      // Check if file exists
      try {
        const fileStats = await fs.stat(absolutePath);
        console.log(`[${requestId}] get-proof-zip: File exists`, {
          absolutePath,
          size: fileStats.size,
          isFile: fileStats.isFile(),
        });
      } catch (statError: any) {
        console.error(`[${requestId}] get-proof-zip: File does not exist`, {
          absolutePath,
          error: statError.message,
          code: statError.code,
        });
        return NextResponse.json(
          { 
            error: "ZIP file not found on disk",
            debug: {
              absolutePath,
              filePath: zipMetadata.filePath,
              error: statError.message,
            }
          },
          { status: 404 }
        );
      }
      
      try {
        const fileBuffer = await fs.readFile(absolutePath);
        console.log(`[${requestId}] get-proof-zip: File read successfully`, {
          absolutePath,
          bufferSize: fileBuffer.length,
        });
        
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
        console.log(`[${requestId}] get-proof-zip: Converted to base64`, {
          base64Length: content.length,
        });
      } catch (err: any) {
        console.error(`[${requestId}] get-proof-zip: Failed to read ZIP file`, {
          absolutePath,
          error: err.message,
          code: err.code,
          stack: err.stack,
        });
        return NextResponse.json(
          { 
            error: "Failed to read ZIP file from disk",
            debug: {
              absolutePath,
              error: err.message,
            }
          },
          { status: 500 }
        );
      }
    } else if (zipMetadata.content) {
      console.log(`[${requestId}] get-proof-zip: Legacy base64 format detected`, {
        contentLength: zipMetadata.content.length,
      });
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
      console.error(`[${requestId}] get-proof-zip: No filePath or content found`, {
        zipMetadata,
        metadataKeys: Object.keys(zipMetadata),
      });
      return NextResponse.json(
        { 
          error: "ZIP file content not found",
          debug: {
            hasFilePath: !!zipMetadata.filePath,
            hasContent: !!zipMetadata.content,
            metadataKeys: Object.keys(zipMetadata),
          }
        },
        { status: 404 }
      );
    }

    console.log(`[${requestId}] get-proof-zip: Success`, {
      fileName: zipMetadata.fileName,
      size: zipMetadata.size,
      contentLength: content.length,
      format,
    });

    return NextResponse.json({
      success: true,
      content,
      fileName: zipMetadata.fileName,
      size: zipMetadata.size,
    });
  } catch (error: any) {
    console.error(`[${requestId}] get-proof-zip: Unexpected error`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      {
        error: "Failed to get ZIP file",
        details: error instanceof Error ? error.message : "Unknown error",
        debug: {
          requestId,
          errorName: error?.name,
        }
      },
      { status: 500 }
    );
  }
}

