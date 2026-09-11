import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron sets `x-vercel-cron: 1`. Other schedulers should send `Authorization: Bearer ${CRON_SECRET}`.
 * In development, requests are allowed when CRON_SECRET is unset (local testing).
 */
export function denyIfCronUnauthorized(req: NextRequest): NextResponse | null {
    if (req.headers.get('x-vercel-cron') === '1') {
        return null;
    }

    if (req.headers.get('x-railway-cron') === '1') {
        return null;
    }

    const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_KEY;
    if (secret) {
        const auth = req.headers.get('authorization');
        if (auth === `Bearer ${secret}`) {
            return null;
        }
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return null;
    }

    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'Cron misconfigured: set CRON_SECRET/INTERNAL_API_KEY or invoke from Vercel Cron' },
            { status: 503 }
        );
    }

    return null;
}
