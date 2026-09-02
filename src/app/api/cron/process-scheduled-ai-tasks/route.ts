import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { denyIfCronMemoryPressure } from '@/lib/cron/cronMemoryGuard';
import { executeScheduledAiTasksDirect } from '@/lib/cron/directCronExecutors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  const memoryDenied = denyIfCronMemoryPressure('process-scheduled-ai-tasks');
  if (memoryDenied) return memoryDenied;

  try {
    const result = await executeScheduledAiTasksDirect();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/process-scheduled-ai-tasks] failed:', error);
    return NextResponse.json({ success: false, error: 'Cron execution failed' }, { status: 500 });
  }
}
