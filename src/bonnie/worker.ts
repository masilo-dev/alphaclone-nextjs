/**
 * Bonnie Railway durable worker.
 * Long-running process for Railway service `bonnie-worker`.
 * Does NOT use serverless request handlers for durable work.
 *
 * Start: npm run bonnie:worker
 * Env: BONNIE_DURABLE_RUNTIME=true, SUPABASE_*, CRON_SECRET optional
 */

import { processClaimableTasks } from '@/lib/bonnie/runtime/workerService';
import { reclaimExpiredLeases } from '@/lib/bonnie/runtime/leaseService';
import { publishOutboxBatch } from '@/lib/bonnie/runtime/outboxService';
import { runFullReconciliation } from '@/lib/bonnie/runtime/reconciliation';
import { isDurableRuntimeEnabled } from '@/lib/bonnie/runtime/types';

const pollMs = Math.max(2_000, Number(process.env.BONNIE_WORKER_POLL_MS || 5_000));
let shuttingDown = false;
let cycle = 0;

async function tick() {
  if (shuttingDown) return;
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

async function main() {
  console.info('[bonnie-worker] starting on Railway', {
    pollMs,
    durable: isDurableRuntimeEnabled(),
    pid: process.pid,
  });

  const onSignal = (sig: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[bonnie-worker] ${sig} received — draining and exiting`);
    // Allow in-flight tick to finish; process exits on next loop check
    setTimeout(() => process.exit(0), Math.min(pollMs, 10_000));
  };
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));

  await tick();
  const timer = setInterval(() => {
    if (shuttingDown) {
      clearInterval(timer);
      return;
    }
    void tick();
  }, pollMs);
}

main().catch((err) => {
  console.error('[bonnie-worker] fatal', err);
  process.exit(1);
});
