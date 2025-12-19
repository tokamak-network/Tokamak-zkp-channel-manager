import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';

const GITHUB_BASE_URL = 'https://github.com/mehdi-defiesta/channel-manager/releases/download/zkey-files';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');
    
    if (!filename) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
    }
    
    // Validate filename to prevent path traversal
    const allowedFiles = ['circuit_final_32.zkey', 'circuit_final_64.zkey', 'circuit_final_128.zkey'];
    if (!allowedFiles.includes(filename)) {
      return NextResponse.json({ error: 'Invalid file requested' }, { status: 400 });
    }
    
    const githubUrl = `${GITHUB_BASE_URL}/${filename}`;
    
    // Fetch the file from GitHub
    const response = await fetch(githubUrl);
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: `Failed to fetch file from GitHub: ${response.status}` 
      }, { status: response.status });
    }
    
    // Stream the response back to the client
    const blob = await response.blob();
    
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': blob.size.toString(),
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
    console.error('Proxy zkey error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while fetching zkey file' 
    }, { status: 500 });
  }
}

export async function HEAD(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');
    
    if (!filename) {
      return new NextResponse(null, { status: 400 });
    }
    
    const allowedFiles = ['circuit_final_32.zkey', 'circuit_final_64.zkey', 'circuit_final_128.zkey'];
    if (!allowedFiles.includes(filename)) {
      return new NextResponse(null, { status: 400 });
    }
    
    const githubUrl = `${GITHUB_BASE_URL}/${filename}`;
    
    // Check if file exists
    const response = await fetch(githubUrl, { method: 'HEAD' });
    
    return new NextResponse(null, {
      status: response.ok ? 200 : 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
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