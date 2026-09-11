import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runActivityDigestEmails } from '@/lib/email/runActivityDigestEmails';

export const dynamic = 'force-dynamic';

/** Every 3 hours — email + in-app digest of new workspace activity per user account */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const result = await runActivityDigestEmails();
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Activity digest cron failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
