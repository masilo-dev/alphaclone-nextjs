import { NextResponse } from 'next/server';
import { acquireCronLock } from '@/lib/cron/distributedLock';
import { denyIfCronMemoryPressure } from '@/lib/cron/cronMemoryGuard';

export type CronJobOptions = {
  /** Redis lock TTL seconds (default 120). */
  lockTtlSec?: number;
  /** Max handler runtime before returning partial result (default 25s). */
  maxDurationMs?: number;
  /** HTTP status when another instance holds the lock (default 200). */
  alreadyRunningStatus?: number;
  /** Skip memory pressure guard when true. */
  skipMemoryGuard?: boolean;
};

function cronSkippedResponse(
  jobName: string,
  reason: string,
  lockReason?: string,
  status = 200
): NextResponse {
  // 204 responses must not include a JSON body (Fetch/Next.js will throw).
  if (status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(
    {
      success: true,
      skipped: true,
      reason,
      lock: lockReason,
      job: jobName,
    },
    { status }
  );
}

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
    const status = options?.alreadyRunningStatus ?? 200;
    if (lock.reason === 'redis_unavailable') {
      return cronSkippedResponse(jobName, 'redis_unavailable', lock.reason, status);
    }
    return cronSkippedResponse(jobName, 'already_running', lock.reason, status);
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
