import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runChaseCronJob } from '@/lib/chaser/chaseCronRunner';

export const dynamic = 'force-dynamic';

/** Escalates unreplied prospect responses — phase 5 delegates to Universal Chaser. */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const result = await runChaseCronJob('follow_up_escalation');
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Follow-up escalation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
