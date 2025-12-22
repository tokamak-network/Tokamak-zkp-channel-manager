import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, ref, set } from 'firebase/database';
import { initializeApp, getApps } from 'firebase/app';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const channelId = formData.get('channelId') as string;
    const filePath = formData.get('filePath') as string; // relative path in ZIP

    if (!file || !channelId || !filePath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check file size (Realtime Database has 1MB limit per node, but we can use base64)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit for base64 encoding
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: 'File too large',
          details: `File ${filePath} is ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB. Please use Firebase Storage for large files.`
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

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Save to Realtime Database
    const dbPath = `channels/${channelId}/submittedProofs/${filePath}`;
    await set(ref(db, dbPath), {
      content: base64,
      fileName: filePath.split('/').pop(),
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      path: dbPath,
      size: file.size,
    });
  } catch (error) {
    console.error('Save file error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

