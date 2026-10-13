import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { withCronJob } from '@/lib/cron/withCronJob';
import { runDueScheduledActions } from '@/lib/scheduling/scheduledActions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;
  return withCronJob('process-scheduled-actions', async () => {
    const result = await runDueScheduledActions();
    return NextResponse.json({ success: true, ...result });
  });
}
