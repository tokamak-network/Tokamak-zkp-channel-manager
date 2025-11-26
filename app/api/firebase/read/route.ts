import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
} from "firebase/firestore";

/**
 * Firebase Firestore Read API
 * GET /api/firebase/read
 * 
 * Query Parameters:
 * - collection: (required) Collection name
 * - docId: (optional) Specific document ID - fetches single document if provided
 * - where: (optional) Filter conditions (JSON string) - e.g., [{"field":"status","operator":"==","value":"active"}]
 * - orderBy: (optional) Sort field
 * - orderDirection: (optional) Sort direction (asc/desc)
 * - limit: (optional) Limit result count
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collectionName = searchParams.get("collection");
    const docId = searchParams.get("docId");
    const whereParam = searchParams.get("where");
    const orderByParam = searchParams.get("orderBy");
    const orderDirection = searchParams.get("orderDirection") as "asc" | "desc" || "asc";
    const limitParam = searchParams.get("limit");

    if (!collectionName) {
      return NextResponse.json(
        { error: "Collection name is required" },
        { status: 400 }
      );
    }

    // Fetch single document
    if (docId) {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: docSnap.id,
          ...docSnap.data(),
        },
      });
    }

    // Query collection
    const collectionRef = collection(db, collectionName);
    const constraints: QueryConstraint[] = [];

    // Add where conditions
    if (whereParam) {
      try {
        const whereConditions = JSON.parse(whereParam);
        if (Array.isArray(whereConditions)) {
          whereConditions.forEach((condition) => {
            constraints.push(
              where(condition.field, condition.operator, condition.value)
            );
          });
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid where parameter format" },
          { status: 400 }
        );
      }
    }

    // Add orderBy
    if (orderByParam) {
      constraints.push(orderBy(orderByParam, orderDirection));
    }

    // Add limit
    if (limitParam) {
      const limitValue = parseInt(limitParam, 10);
      if (!isNaN(limitValue)) {
        constraints.push(limit(limitValue));
      }
    }

    const q = query(collectionRef, ...constraints);
    const querySnapshot = await getDocs(q);

    const documents = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error: any) {
    console.error("Firebase read error:", error);
    return NextResponse.json(
      {
        error: "Failed to read from Firebase",
        details: error.message,
      },
      { status: 500 }
    );
  }
}


