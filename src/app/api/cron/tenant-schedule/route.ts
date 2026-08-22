import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { tenantScheduleEngine, ScheduleCheckpoint } from '@/services/tenantScheduleEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const checkpointParam = (searchParams.get('checkpoint') || 'morning_0900') as ScheduleCheckpoint;
  const tenantIdParam = searchParams.get('tenantId');

  const validCheckpoints: ScheduleCheckpoint[] = [
    'morning_0900',
    'midday_1300',
    'velocity_1500',
    'eod_1800',
    'outreach_2000',
  ];

  if (!validCheckpoints.includes(checkpointParam)) {
    return NextResponse.json(
      { error: `Invalid checkpoint. Valid values are: ${validCheckpoints.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    if (tenantIdParam) {
      const result = await tenantScheduleEngine.executeCheckpoint(tenantIdParam, checkpointParam);
      return NextResponse.json({
        status: 'ok',
        checkpoint: checkpointParam,
        tenantsProcessed: 1,
        results: [result],
      });
    }

    const results = await tenantScheduleEngine.executeGlobalCheckpoint(checkpointParam);
    return NextResponse.json({
      status: 'ok',
      checkpoint: checkpointParam,
      tenantsProcessed: results.length,
      results,
    });
  } catch (err: any) {
    console.error(`[API /api/cron/tenant-schedule GET] Error:`, err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
