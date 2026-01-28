import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    // Stub for sending receipt - functionality to be implemented
    return NextResponse.json({ sent: true });
}
