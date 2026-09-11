/**
 * Bonnie Railway durable worker.
 * Long-running process for Railway service `bonnie-worker`.
 *
 * Start: npm run bonnie:worker  OR  npm run start:worker
 */

import runBonnieWorker from '@/bonnie/workerMain';

const pollMs = Math.max(2_000, Number(process.env.BONNIE_WORKER_POLL_MS || 5_000));
let shuttingDown = false;

const onSignal = (sig: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[bonnie-worker] ${sig} received — draining and exiting`);
  setTimeout(() => process.exit(0), Math.min(pollMs, 10_000)).unref?.();
};

process.on('SIGTERM', () => onSignal('SIGTERM'));
process.on('SIGINT', () => onSignal('SIGINT'));

runBonnieWorker({ isShuttingDown: () => shuttingDown, pollMs }).catch((err) => {
  console.error('[bonnie-worker] fatal', err);
  process.exit(1);
});
