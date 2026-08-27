import { NextResponse } from 'next/server';

function notFoundResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export const GET = notFoundResponse;
export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const OPTIONS = notFoundResponse;
