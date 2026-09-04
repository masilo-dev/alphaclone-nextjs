import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runFollowUpEscalationEngine } from '@/lib/notifications/followUpEscalationEngine';
import { delegateLegacyFollowUpAllTenants } from '@/lib/chaser/chaseLegacyDelegation';
import { shouldDelegateLegacyScannersToChaser } from '@/lib/chaser/chaseConfig';

export const dynamic = 'force-dynamic';

/** Escalates unreplied prospect responses into needs-attention notifications */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    if (shouldDelegateLegacyScannersToChaser()) {
      const delegated = await delegateLegacyFollowUpAllTenants('follow_up_escalation');
      return NextResponse.json({ success: true, delegated: true, ...delegated, timestamp: new Date().toISOString() });
    }
    const result = await runFollowUpEscalationEngine();
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Follow-up escalation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
