import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, ref, set } from 'firebase/database';
import { initializeApp, getApps } from 'firebase/app';

/**
 * DEPRECATED: This API route is deprecated.
 * Use client-side Firebase Storage upload instead via uploadProofZipToStorage() in lib/firebase-storage.ts
 * 
 * This endpoint remains for backwards compatibility but will redirect to storage-based approach.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const channelId = formData.get('channelId') as string;
    const proofId = formData.get('proofId') as string;

    if (!file || !channelId || !proofId) {
      return NextResponse.json(
        { error: 'Missing required fields: file, channelId, or proofId' },
        { status: 400 }
      );
    }

    // Check file size (Realtime Database has limits, but we can use base64)
    // Firebase Realtime Database has a 256MB limit per write, but base64 increases size by ~33%
    // So we limit to ~150MB original file size
    const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB limit
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: 'File too large',
          details: `ZIP file is ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB.`
        },
        { status: 400 }
      );
    }

    // Initialize Firebase
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getDatabase(app);

    // Convert ZIP file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Save to Realtime Database
    const dbPath = `channels/${channelId}/submittedProofs/${proofId}/zipFile`;
    await set(ref(db, dbPath), {
      content: base64,
      fileName: file.name,
      mimeType: 'application/zip',
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      path: dbPath,
      size: file.size,
    });
  } catch (error) {
    console.error('Save ZIP file error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save ZIP file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

