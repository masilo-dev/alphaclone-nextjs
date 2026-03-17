import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    // Stub for payment reconciliation
    return NextResponse.json({ reconciled: true, status: 'succeeded' });
}
