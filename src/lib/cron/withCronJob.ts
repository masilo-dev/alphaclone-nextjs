import { NextResponse } from 'next/server';
import { acquireCronLock } from '@/lib/cron/distributedLock';
import { denyIfCronMemoryPressure } from '@/lib/cron/cronMemoryGuard';

export type CronJobOptions = {
  /** Redis lock TTL seconds (default 120). */
  lockTtlSec?: number;
  /** Max handler runtime before returning partial result (default 25s). */
  maxDurationMs?: number;
  /** HTTP status when another instance holds the lock (default 204). */
  alreadyRunningStatus?: number;
  /** Skip memory pressure guard when true. */
  skipMemoryGuard?: boolean;
};

/**
 * Wrap a cron handler with singleton locking, optional memory guard, and time budget.
 */
export async function withCronJob<T extends Record<string, unknown>>(
  jobName: string,
  handler: () => Promise<NextResponse<T> | NextResponse>,
  options?: CronJobOptions
): Promise<NextResponse> {
  if (!options?.skipMemoryGuard) {
    const memoryDenied = denyIfCronMemoryPressure(jobName);
    if (memoryDenied) return memoryDenied;
  }

  if (process.env.DISABLE_CRON_DISTRIBUTED_LOCK === 'true') {
    return runWithBudget(jobName, handler, options?.maxDurationMs);
  }

  const lock = await acquireCronLock(jobName, options?.lockTtlSec ?? 120);
  if (!lock.acquired) {
    return NextResponse.json(
      {
        success: true,
        skipped: true,
        reason: 'already_running',
        lock: lock.reason,
        job: jobName,
      },
      { status: options?.alreadyRunningStatus ?? 204 }
    );
  }

  try {
    return await runWithBudget(jobName, handler, options?.maxDurationMs);
  } finally {
    await lock.release();
  }
}

async function runWithBudget<T extends Record<string, unknown>>(
  jobName: string,
  handler: () => Promise<NextResponse<T> | NextResponse>,
  maxDurationMs?: number
): Promise<NextResponse> {
  const budgetMs = maxDurationMs ?? Number(process.env.CRON_JOB_BUDGET_MS || 25_000);
  const startedAt = Date.now();

  const result = await Promise.race([
    handler(),
    new Promise<NextResponse>((resolve) => {
      setTimeout(() => {
        resolve(
          NextResponse.json(
            {
              success: true,
              partial: true,
              reason: 'time_budget_exceeded',
              job: jobName,
              budgetMs,
              elapsedMs: Date.now() - startedAt,
            },
            { status: 200 }
          )
        );
      }, budgetMs).unref?.();
    }),
  ]);

  return result;
}
