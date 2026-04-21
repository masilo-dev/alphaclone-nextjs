import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { autonomousRunnerService } from '@/services/autonomousRunnerService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const result = await autonomousRunnerService.runOnce();
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error || 'Autonomous runner failed',
        runs: result.runs,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    runs: result.runs,
    executedAt: new Date().toISOString(),
  });
}

