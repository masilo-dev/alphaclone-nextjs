import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runChaseCronJob } from '@/lib/chaser/chaseCronRunner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  try {
    const result = await runChaseCronJob('contract_signature_reminders');
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[cron/contract-signature-reminders] failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Contract chaser cron failed' },
      { status: 500 },
    );
  }
}
