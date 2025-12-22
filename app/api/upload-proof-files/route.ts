import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const channelId = formData.get('channelId') as string;
    const proofId = formData.get('proofId') as string; // Changed from storagePath to proofId

    console.log('Upload request received:', { 
      fileName: file?.name, 
      channelId, 
      proofId,
      fileSize: file?.size 
    });

    if (!file || !channelId || !proofId) {
      console.error('Missing required fields:', { file: !!file, channelId, proofId });
      return NextResponse.json(
        { error: 'Missing required fields: file, channelId, or proofId' },
        { status: 400 }
      );
    }

    // SECURITY: Construct storage path on server-side using trusted inputs only
    // This prevents path traversal attacks (e.g., ../)
    // Sanitize proofId to prevent path injection
    const sanitizedProofId = proofId.replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedChannelId = channelId.replace(/[^0-9]/g, '');
    const storagePath = `proofs/channel-${sanitizedChannelId}/${sanitizedProofId}.zip`;

    // Initialize Firebase app on server side
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    
    if (!storageBucket) {
      console.error('Firebase Storage bucket not configured');
      return NextResponse.json(
        { error: 'Firebase Storage bucket not configured. Please check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable.' },
        { status: 500 }
      );
    }

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: storageBucket,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

    console.log('Firebase config:', {
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      hasApiKey: !!firebaseConfig.apiKey,
    });

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    
    if (!app) {
      console.error('Firebase app not initialized');
      return NextResponse.json(
        { error: 'Firebase app not initialized' },
        { status: 500 }
      );
    }

    // Initialize Storage - try without gs:// prefix first
    let storage;
    try {
      // Try with bucket name only (without gs://)
      storage = getStorage(app, storageBucket);
    } catch (e) {
      console.error('Failed to initialize storage with bucket name, trying default:', e);
      // Fallback to default storage
      storage = getStorage(app);
    }
    
    if (!storage) {
      console.error('Firebase Storage not initialized');
      return NextResponse.json(
        { error: 'Firebase Storage not initialized' },
        { status: 500 }
      );
    }
    
    console.log('Storage initialized successfully');

    // Convert File to Blob
    const fileBlob = await file.arrayBuffer();
    const blob = new Blob([fileBlob], { type: file.type || 'application/octet-stream' });

    console.log('Uploading to Firebase Storage:', storagePath, '(sanitized path)');

    // Upload to Firebase Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    console.log('Upload successful:', downloadURL);

    return NextResponse.json({
      success: true,
      downloadURL,
      storagePath,
    });
  } catch (error) {
    console.error('Upload error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    });
    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

