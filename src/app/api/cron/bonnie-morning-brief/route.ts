import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runMorningBriefsForAllTenants } from '@/services/bonnieMorningBriefService';

export const dynamic = 'force-dynamic';

/** Daily proactive briefing — pushes to notifications for Bonnie widget */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const result = await runMorningBriefsForAllTenants();
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Morning brief cron failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
