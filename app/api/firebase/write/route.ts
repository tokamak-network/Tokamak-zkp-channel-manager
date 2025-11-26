import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Firebase Firestore Write API
 * POST /api/firebase/write
 * 
 * Request Body:
 * {
 *   "operation": "create" | "update" | "delete" | "set",
 *   "collection": "Collection name",
 *   "docId": "Document ID (optional, auto-generated for create)",
 *   "data": { Data object to save },
 *   "merge": true/false (whether to merge for set operation)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, collection: collectionName, docId, data, merge = false } = body;

    if (!operation || !collectionName) {
      return NextResponse.json(
        { error: "Operation and collection are required" },
        { status: 400 }
      );
    }

    const collectionRef = collection(db, collectionName);

    switch (operation) {
      case "create": {
        // Create new document (auto-generated ID)
        if (!data) {
          return NextResponse.json(
            { error: "Data is required for create operation" },
            { status: 400 }
          );
        }

        const dataWithTimestamp = {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(collectionRef, dataWithTimestamp);

        return NextResponse.json({
          success: true,
          operation: "create",
          docId: docRef.id,
          message: "Document created successfully",
        });
      }

      case "set": {
        // Set document (overwrite or merge)
        if (!docId || !data) {
          return NextResponse.json(
            { error: "Document ID and data are required for set operation" },
            { status: 400 }
          );
        }

        const docRef = doc(db, collectionName, docId);
        const dataWithTimestamp = {
          ...data,
          updatedAt: serverTimestamp(),
        };

        await setDoc(docRef, dataWithTimestamp, { merge });

        return NextResponse.json({
          success: true,
          operation: "set",
          docId,
          merge,
          message: "Document set successfully",
        });
      }

      case "update": {
        // Update document (partial modification)
        if (!docId || !data) {
          return NextResponse.json(
            { error: "Document ID and data are required for update operation" },
            { status: 400 }
          );
        }

        const docRef = doc(db, collectionName, docId);
        const dataWithTimestamp = {
          ...data,
          updatedAt: serverTimestamp(),
        };

        await updateDoc(docRef, dataWithTimestamp);

        return NextResponse.json({
          success: true,
          operation: "update",
          docId,
          message: "Document updated successfully",
        });
      }

      case "delete": {
        // Delete document
        if (!docId) {
          return NextResponse.json(
            { error: "Document ID is required for delete operation" },
            { status: 400 }
          );
        }

        const docRef = doc(db, collectionName, docId);
        await deleteDoc(docRef);

        return NextResponse.json({
          success: true,
          operation: "delete",
          docId,
          message: "Document deleted successfully",
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid operation. Use: create, set, update, or delete" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Firebase write error:", error);
    return NextResponse.json(
      {
        error: "Failed to write to Firebase",
        details: error.message,
      },
      { status: 500 }
    );
  }
}


