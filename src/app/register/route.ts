import { NextResponse } from 'next/server';

export async function GET() {
  // Original human registration page redirect
  return NextResponse.redirect(new URL('/auth/login?register=true', 'https://www.alphaclonesystems.com'));
}

export async function POST() {
  // OAuth Dynamic Client Registration for AI (Claude)
  const response = NextResponse.json({
    client_id: 'alphaclone-mcp-client',
    client_secret: 'not-used',
    registration_access_token: 'not-used',
    client_id_issued_at: Math.floor(Date.now() / 1000),
    token_endpoint_auth_method: 'none',
  }, { status: 201 });

  // Prevent Vercel from caching this response
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
