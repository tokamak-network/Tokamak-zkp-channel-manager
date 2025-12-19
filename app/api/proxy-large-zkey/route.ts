import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';

const EXTERNAL_ZKEY_URLS = {
  '64': 'https://pub-30801471f84a46049e31eea6c3395e00.r2.dev/my-bucket/tokamak-zkp-channles/circuit_final_64.zkey',
  '128': 'https://pub-30801471f84a46049e31eea6c3395e00.r2.dev/my-bucket/tokamak-zkp-channles/circuit_final_128.zkey'
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = searchParams.get('size');
  
  if (!size || !EXTERNAL_ZKEY_URLS[size as keyof typeof EXTERNAL_ZKEY_URLS]) {
    return NextResponse.json(
      { error: 'Invalid size parameter. Must be 64 or 128.' },
      { status: 400 }
    );
  }
  
  try {
    const externalUrl = EXTERNAL_ZKEY_URLS[size as keyof typeof EXTERNAL_ZKEY_URLS];
    
    console.log(`🔍 PROXYING LARGE ZKEY FILE:`);
    console.log(`  Size: ${size} leaves`);
    console.log(`  External URL: ${externalUrl}`);
    console.log(`  Estimated size: ${size === '64' ? '~51MB' : '~102MB'}`);
    
    // Fetch the file from Cloudflare R2
    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch zkey file from R2: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch circuit file: ${response.status}` },
        { status: response.status }
      );
    }
    
    // Get the file as a stream
    const fileStream = response.body;
    const contentLength = response.headers.get('content-length');
    
    console.log(`✅ Successfully fetched zkey file (${contentLength} bytes)`);
    
    // Return the file with appropriate headers
    return new NextResponse(fileStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': contentLength || '',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Disposition': `attachment; filename="circuit_final_${size}.zkey"`
      }
    });
    
  } catch (error) {
    console.error('Error proxying zkey file:', error);
    return NextResponse.json(
      { error: 'Failed to proxy circuit file' },
      { status: 500 }
    );
  }
}

export async function HEAD(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = searchParams.get('size');
  
  if (!size || !EXTERNAL_ZKEY_URLS[size as keyof typeof EXTERNAL_ZKEY_URLS]) {
    return new NextResponse(null, { status: 400 });
  }
  
  try {
    const externalUrl = EXTERNAL_ZKEY_URLS[size as keyof typeof EXTERNAL_ZKEY_URLS];
    
    // Check if the file exists with a HEAD request
    const response = await fetch(externalUrl, {
      method: 'HEAD'
    });
    
    return new NextResponse(null, {
      status: response.status,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': response.headers.get('content-length') || '',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
    console.error('Error checking zkey file:', error);
    return new NextResponse(null, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}