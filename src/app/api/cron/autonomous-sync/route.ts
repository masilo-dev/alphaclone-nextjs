import { NextRequest, NextResponse } from 'next/server';
import { autonomousRunnerService } from '@/services/autonomousRunnerService';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  try {

    console.log('[Cron Sync] Starting autonomous background run for all active tenants...');
    const result = await autonomousRunnerService.runOnce();

    if (result.success) {
      return NextResponse.json({
        success: true,
        runsEvaluated: result.runs?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Cron Sync Error]', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown cron error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
