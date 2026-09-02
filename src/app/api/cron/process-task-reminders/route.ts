import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { denyIfCronMemoryPressure } from '@/lib/cron/cronMemoryGuard';
import { executeTaskRemindersDirect } from '@/lib/cron/directCronExecutors';

export const dynamic = 'force-dynamic';

async function runTaskReminders() {
  const result = await executeTaskRemindersDirect();
  return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const memoryDenied = denyIfCronMemoryPressure('process-task-reminders');
  if (memoryDenied) return memoryDenied;

  try {
    return await runTaskReminders();
  } catch (error) {
    console.error('[cron/process-task-reminders] failed:', error);
    return NextResponse.json({ error: 'Cron execution failed', code: 'CRON_FAILED' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const memoryDenied = denyIfCronMemoryPressure('process-task-reminders');
  if (memoryDenied) return memoryDenied;

  try {
    return await runTaskReminders();
  } catch (error) {
    console.error('[cron/process-task-reminders] failed:', error);
    return NextResponse.json({ error: 'Cron execution failed', code: 'CRON_FAILED' }, { status: 500 });
  }
}
