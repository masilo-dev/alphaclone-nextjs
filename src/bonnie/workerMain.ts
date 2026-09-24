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

let lastQueueDepthCheck = 0;
const QUEUE_DEPTH_INTERVAL_MS = 60_000;

async function refreshQueueDepth(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastQueueDepthCheck < QUEUE_DEPTH_INTERVAL_MS) {
    return;
  }
  lastQueueDepthCheck = now;
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
  let consecutiveIdleTicks = 0;

  async function tick(): Promise<boolean> {
    if (options.isShuttingDown?.()) return false;

    if (isTickRunning) {
      console.warn('[bonnie-worker] tick skipped — previous tick still running');
      return false;
    }

    isTickRunning = true;
    incrementActiveWorkerTicks();
    const started = Date.now();
    let hadActivity = false;

    try {
      if (!isDurableRuntimeEnabled()) {
        idleCycles += 1;
        if (idleCycles % 12 === 1) {
          console.warn(
            '[bonnie-worker] BONNIE_DURABLE_RUNTIME is not enabled; idle. Set BONNIE_DURABLE_RUNTIME=true on Railway.'
          );
        }
        return false;
      }

      if (isBackgroundJobHeapBlocked()) {
        console.warn('[bonnie-worker] tick deferred — memory pressure', backgroundJobBlockedReason());
        return false;
      }

      await refreshQueueDepth(consecutiveIdleTicks === 0);

      const leases = await reclaimExpiredLeases(25);
      const outbox = await publishOutboxBatch(40);
      const work = await processClaimableTasks(
        Number(process.env.BONNIE_WORKER_CLAIM_LIMIT || 10)
      );

      if (work.processed > 0 || outbox.delivered > 0 || leases.reclaimed > 0) {
        hadActivity = true;
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

    return hadActivity;
  }

  console.info('[bonnie-worker] starting sequential loop', {
    pollMs,
    durable: isDurableRuntimeEnabled(),
    pid: process.pid,
  });

  while (!options.isShuttingDown?.()) {
    const started = Date.now();
    let hadActivity = false;
    try {
      hadActivity = await tick();
    } catch (err) {
      console.error('[bonnie-worker] loop error', err);
    }

    if (hadActivity) {
      consecutiveIdleTicks = 0;
    } else {
      consecutiveIdleTicks += 1;
    }

    const elapsed = Date.now() - started;
    // When idle, adaptively back off up to 30s to relieve Postgres connection & CPU pressure
    const idleMultiplier = Math.min(Math.pow(1.4, Math.min(consecutiveIdleTicks, 6)), 6);
    const targetInterval = hadActivity ? pollMs : Math.min(pollMs * idleMultiplier, 30_000);
    const waitMs = Math.max(0, targetInterval - elapsed);

    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }

  console.info('[bonnie-worker] shut down cleanly');
}
