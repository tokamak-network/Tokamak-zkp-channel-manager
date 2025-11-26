import { NextRequest, NextResponse } from "next/server";
import { realtimeDb } from "@/lib/firebase";
import { ref, set, get, push, update, remove } from "firebase/database";

/**
 * Firebase Realtime Database Test API
 * 
 * GET /api/firebase/realtime-test - Read data
 * POST /api/firebase/realtime-test - Write data
 * 
 * This endpoint tests the connection to Firebase Realtime Database
 */

// Test read from Realtime Database
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get("path") || "test";

    console.log(`📖 Reading from Realtime Database path: ${path}`);

    const dataRef = ref(realtimeDb, path);
    const snapshot = await get(dataRef);

    if (snapshot.exists()) {
      return NextResponse.json({
        success: true,
        path,
        exists: true,
        data: snapshot.val(),
        message: "Data read successfully from Realtime Database",
      });
    } else {
      return NextResponse.json({
        success: true,
        path,
        exists: false,
        data: null,
        message: "No data found at this path",
      });
    }
  } catch (error: any) {
    console.error("❌ Firebase Realtime Database read error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to read from Realtime Database",
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}

// Test write to Realtime Database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation = "set", path = "test", data } = body;

    console.log(`✍️ Writing to Realtime Database path: ${path}, operation: ${operation}`);

    const dataRef = ref(realtimeDb, path);

    switch (operation) {
      case "set": {
        // Set data at path (overwrites existing data)
        const dataToWrite = {
          ...data,
          _metadata: {
            updatedAt: new Date().toISOString(),
            operation: "set",
          },
        };
        await set(dataRef, dataToWrite);
        return NextResponse.json({
          success: true,
          operation: "set",
          path,
          message: "Data set successfully",
          data: dataToWrite,
        });
      }

      case "push": {
        // Push new data (generates unique key)
        const dataToWrite = {
          ...data,
          _metadata: {
            createdAt: new Date().toISOString(),
            operation: "push",
          },
        };
        const newRef = push(dataRef);
        await set(newRef, dataToWrite);
        return NextResponse.json({
          success: true,
          operation: "push",
          path,
          newKey: newRef.key,
          message: "Data pushed successfully",
          data: dataToWrite,
        });
      }

      case "update": {
        // Update specific fields
        const dataToWrite = {
          ...data,
          "_metadata/updatedAt": new Date().toISOString(),
        };
        await update(dataRef, dataToWrite);
        return NextResponse.json({
          success: true,
          operation: "update",
          path,
          message: "Data updated successfully",
        });
      }

      case "delete": {
        // Delete data at path
        await remove(dataRef);
        return NextResponse.json({
          success: true,
          operation: "delete",
          path,
          message: "Data deleted successfully",
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid operation. Use: set, push, update, or delete",
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("❌ Firebase Realtime Database write error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to write to Realtime Database",
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}

