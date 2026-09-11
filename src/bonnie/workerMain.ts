/**
 * Bonnie worker loop — extracted for shared use by Railway worker service and bonnie:worker script.
 *
 * Uses a sequential non-overlapping poll loop (never setInterval for async ticks).
 * Reconciliation is NOT run here — /api/cron/bonnie-runtime-reconcile is authoritative.
 */

import { processClaimableTasks } from '@/lib/bonnie/runtime/workerService';
import { reclaimExpiredLeases } from '@/lib/bonnie/runtime/leaseService';
import { publishOutboxBatch } from '@/lib/bonnie/runtime/outboxService';
import { isDurableRuntimeEnabled } from '@/lib/bonnie/runtime/types';
import { isBackgroundJobHeapBlocked, backgroundJobBlockedReason } from '@/lib/runtime/backgroundJobGate';
import {
  decrementActiveWorkerTicks,
  incrementActiveWorkerTicks,
  setQueueDepth,
} from '@/lib/runtime/workerRuntimeCounters';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type BonnieWorkerOptions = {
  isShuttingDown?: () => boolean;
  pollMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let isTickRunning = false;

/** Test hook — verify tick guard state. */
export function isBonnieWorkerTickRunning(): boolean {
  return isTickRunning;
}

async function refreshQueueDepth(): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { count } = await admin
      .from('mcp_event_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    setQueueDepth(count || 0);
  } catch {
    // non-fatal telemetry
  }
}

export default async function runBonnieWorker(options: BonnieWorkerOptions = {}): Promise<void> {
  const pollMs = Math.max(2_000, options.pollMs ?? Number(process.env.BONNIE_WORKER_POLL_MS || 5_000));
  let idleCycles = 0;

  async function tick(): Promise<void> {
    if (options.isShuttingDown?.()) return;

    if (isTickRunning) {
      console.warn('[bonnie-worker] tick skipped — previous tick still running');
      return;
    }

    isTickRunning = true;
    incrementActiveWorkerTicks();
    const started = Date.now();

    try {
      if (!isDurableRuntimeEnabled()) {
        idleCycles += 1;
        if (idleCycles % 12 === 1) {
          console.warn(
            '[bonnie-worker] BONNIE_DURABLE_RUNTIME is not enabled; idle. Set BONNIE_DURABLE_RUNTIME=true on Railway.'
          );
        }
        return;
      }

      if (isBackgroundJobHeapBlocked()) {
        console.warn('[bonnie-worker] tick deferred — memory pressure', backgroundJobBlockedReason());
        return;
      }

      await refreshQueueDepth();

      const leases = await reclaimExpiredLeases(25);
      const outbox = await publishOutboxBatch(40);
      const work = await processClaimableTasks(
        Number(process.env.BONNIE_WORKER_CLAIM_LIMIT || 10)
      );

      if (work.processed > 0 || outbox.delivered > 0 || leases.reclaimed > 0) {
        console.info('[bonnie-worker] tick', {
          durationMs: Date.now() - started,
          leases,
          outbox,
          work,
        });
      }
    } catch (err) {
      console.error('[bonnie-worker] tick failed', err);
    } finally {
      isTickRunning = false;
      decrementActiveWorkerTicks();
    }
  }

  console.info('[bonnie-worker] starting sequential loop', {
    pollMs,
    durable: isDurableRuntimeEnabled(),
    pid: process.pid,
  });

  while (!options.isShuttingDown?.()) {
    const started = Date.now();
    try {
      await tick();
    } catch (err) {
      console.error('[bonnie-worker] loop error', err);
    }
    const elapsed = Date.now() - started;
    const waitMs = Math.max(0, pollMs - elapsed);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }

  console.info('[bonnie-worker] shut down cleanly');
}
