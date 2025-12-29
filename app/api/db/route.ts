/**
 * Database API Endpoint
 * Provides a REST API for the local JSON database
 * Used by client-side components to access the database
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getData,
  setData,
  updateData,
  pushData,
  deleteData,
} from "@/lib/local-db";

// GET: Read data from a path
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    // Allow empty string path to get entire database
    if (path === null) {
      return NextResponse.json({ error: "Path parameter is required" }, { status: 400 });
    }

    const data = await getData(path);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Database GET error:", error);
    return NextResponse.json(
      { error: "Failed to read data" },
      { status: 500 }
    );
  }
}

// POST: Write data to a path
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, data, operation = "set" } = body;

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    let result: string | void;

    switch (operation) {
      case "set":
        await setData(path, data);
        result = undefined;
        break;
      case "update":
        await updateData(path, data);
        result = undefined;
        break;
      case "push":
        result = await pushData(path, data);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid operation" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      key: result || null,
    });
  } catch (error) {
    console.error("Database POST error:", error);
    return NextResponse.json(
      { error: "Failed to write data" },
      { status: 500 }
    );
  }
}

// DELETE: Delete data at a path
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    await deleteData(path);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 }
    );
  }
}

