import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { withCronJob } from '@/lib/cron/withCronJob';
import { autonomousRunnerService } from '@/services/autonomousRunnerService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  return withCronJob('autonomous-runner', async () => {
  try {
    const result = await autonomousRunnerService.runOnce();
    if (result.success) {
      return NextResponse.json({
        success: true,
        runsEvaluated: result.runs?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Trigger failed' }, { status: 500 });
  }
  }, { maxDurationMs: 25_000 });
}
