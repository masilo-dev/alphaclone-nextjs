<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.redirect(new URL('/auth/login?register=true&type=business&plan=starter', origin));
=======
import { NextResponse } from 'next/server';

export async function GET() {
  // Original human registration page redirect
  return NextResponse.redirect(new URL('/auth/login?register=true&type=business&plan=starter', 'https://www.alphaclonesystems.com'));
>>>>>>> origin/main
}

export async function POST() {
  // Moved to /api/mcp/register/route.ts
  return NextResponse.json({ error: 'Moved to /api/mcp/register' }, { status: 410 });
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
