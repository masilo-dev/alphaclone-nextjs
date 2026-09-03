import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { withCronJob } from '@/lib/cron/withCronJob';
import { runFullReconciliation } from '@/lib/bonnie/runtime/reconciliation';
import { acquireBonnieLock } from '@/lib/cron/distributedLock';
import {
  decrementActiveReconciliation,
  incrementActiveReconciliation,
} from '@/lib/runtime/workerRuntimeCounters';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  return withCronJob('bonnie-runtime-reconcile', async () => {
    const lock = await acquireBonnieLock('reconciliation', 600);
    if (!lock.acquired) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'reconciliation_lock_held',
      }, { status: 204 });
    }

    incrementActiveReconciliation();
    try {
      const result = await runFullReconciliation();
      return NextResponse.json({ success: true, result, timestamp: new Date().toISOString() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
      decrementActiveReconciliation();
      await lock.release();
    }
  }, { lockTtlSec: 600, maxDurationMs: 45_000 });
}
