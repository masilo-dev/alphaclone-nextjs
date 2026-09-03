/**
 * Bonnie worker loop — extracted for shared use by Railway worker service and bonnie:worker script.
 */

import { processClaimableTasks } from '@/lib/bonnie/runtime/workerService';
import { reclaimExpiredLeases } from '@/lib/bonnie/runtime/leaseService';
import { publishOutboxBatch } from '@/lib/bonnie/runtime/outboxService';
import { runFullReconciliation } from '@/lib/bonnie/runtime/reconciliation';
import { isDurableRuntimeEnabled } from '@/lib/bonnie/runtime/types';

export type BonnieWorkerOptions = {
  isShuttingDown?: () => boolean;
  pollMs?: number;
};

export default async function runBonnieWorker(options: BonnieWorkerOptions = {}): Promise<void> {
  const pollMs = Math.max(2_000, options.pollMs ?? Number(process.env.BONNIE_WORKER_POLL_MS || 5_000));
  let cycle = 0;

  async function tick() {
    if (options.isShuttingDown?.()) return;
    cycle += 1;
    const started = Date.now();
    try {
      if (!isDurableRuntimeEnabled()) {
        if (cycle % 12 === 1) {
          console.warn(
            '[bonnie-worker] BONNIE_DURABLE_RUNTIME is not enabled; idle. Set BONNIE_DURABLE_RUNTIME=true on Railway.'
          );
        }
        return;
      }

      const leases = await reclaimExpiredLeases(25);
      const outbox = await publishOutboxBatch(40);
      const work = await processClaimableTasks(10);

      if (cycle % 6 === 0) {
        const reconcile = await runFullReconciliation();
        console.info('[bonnie-worker] reconcile', {
          durationMs: Date.now() - started,
          leases,
          outbox,
          work,
          reconcileSummary: {
            timers: reconcile.timers,
            inbox: reconcile.inbox,
            uncertain: reconcile.uncertain,
          },
        });
      } else if (work.processed > 0 || outbox.delivered > 0 || leases.reclaimed > 0) {
        console.info('[bonnie-worker] tick', {
          durationMs: Date.now() - started,
          leases,
          outbox,
          work,
        });
      }
    } catch (err) {
      console.error('[bonnie-worker] tick failed', err);
    }
  }

  console.info('[bonnie-worker] starting on Railway', {
    pollMs,
    durable: isDurableRuntimeEnabled(),
    pid: process.pid,
  });

  await tick();

  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (options.isShuttingDown?.()) {
        clearInterval(timer);
        resolve();
        return;
      }
      void tick();
    }, pollMs);
  });
}
