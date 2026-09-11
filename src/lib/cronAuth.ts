import { NextRequest, NextResponse } from 'next/server';

/**
 * Railway Cron may set `x-railway-cron: 1`, but that header is trivially spoofable.
 * In production, Authorization: Bearer ${CRON_SECRET|INTERNAL_API_KEY} is mandatory.
 * The Railway hint alone never authorizes production traffic.
 */
export function denyIfCronUnauthorized(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_KEY;
  const auth = req.headers.get('authorization');
  const bearerOk = Boolean(secret && auth === `Bearer ${secret}`);
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!secret) {
      return NextResponse.json(
        {
          error:
            'Cron misconfigured: set CRON_SECRET (or INTERNAL_API_KEY) and invoke with Authorization: Bearer <secret>',
        },
        { status: 503 }
      );
    }
    if (!bearerOk) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
  }

  // Development: allow Bearer, Railway hint, or missing secret for local testing
  if (bearerOk) return null;
  if (req.headers.get('x-railway-cron') === '1') return null;
  if (!secret) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
