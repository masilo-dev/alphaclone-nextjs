/**
 * Background worker entrypoint for Railway `worker` service.
 *
 * Railway start command: npm run start:worker
 * Env: BONNIE_DURABLE_RUNTIME=true, REDIS_URL, SUPABASE_*
 * Optional: WORKER_MODE=bonnie (default)
 */

import { registerProcessGuards, onShutdown } from '@/lib/runtime/processGuards';
import { startMemoryTelemetry, stopMemoryTelemetry } from '@/lib/runtime/memoryTelemetry';

registerProcessGuards();
startMemoryTelemetry();

let workerShuttingDown = false;

onShutdown(() => {
  workerShuttingDown = true;
  stopMemoryTelemetry();
});

async function main() {
  const mode = (process.env.WORKER_MODE || 'bonnie').trim().toLowerCase();
  console.info('[worker] starting', { mode, pid: process.pid });

  if (mode === 'bonnie') {
    const runBonnieWorker = (await import('@/bonnie/workerMain')).default;
    await runBonnieWorker({ isShuttingDown: () => workerShuttingDown });
    return;
  }

  console.error(
    `[worker] WORKER_MODE="${mode}" is not supported here. Use npm run bonnie:worker or npm run leads:worker.`
  );
  process.exit(1);
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
