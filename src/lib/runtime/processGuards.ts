/**
 * Process-level stability guards: uncaught errors, unhandled rejections, SIGTERM drain.
 */

import { stopMemoryTelemetry } from '@/lib/runtime/memoryTelemetry';
import { closeRedis } from '@/lib/redis/client';
import { logRateLimited } from '@/lib/runtime/logRateLimit';

let shuttingDown = false;
let activeRequests = 0;
const shutdownHooks: Array<() => void | Promise<void>> = [];

export function incrementActiveRequests(): void {
  activeRequests += 1;
}

export function decrementActiveRequests(): void {
  activeRequests = Math.max(0, activeRequests - 1);
}

export function getActiveRequestCount(): number {
  return activeRequests;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function onShutdown(hook: () => void | Promise<void>): void {
  shutdownHooks.push(hook);
}

async function runShutdownHooks(): Promise<void> {
  for (const hook of shutdownHooks) {
    try {
      await hook();
    } catch (err) {
      logRateLimited('shutdown:hook-failed', 'error', '[process] shutdown hook failed', err);
    }
  }
}

export function registerProcessGuards(): void {
  if ((globalThis as { __alphaclone_process_guards__?: boolean }).__alphaclone_process_guards__) {
    return;
  }
  (globalThis as { __alphaclone_process_guards__?: boolean }).__alphaclone_process_guards__ = true;

  process.on('uncaughtException', (err) => {
    logRateLimited('process:uncaughtException', 'error', '[process] uncaughtException', {
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 5),
      activeRequests,
    });
  });

  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack?.split('\n').slice(0, 5) : undefined;
    logRateLimited('process:unhandledRejection', 'error', '[process] unhandledRejection', {
      message,
      stack,
      activeRequests,
    });
  });

  const onSignal = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[process] ${signal} received — draining (${activeRequests} active requests)`);
    stopMemoryTelemetry();

    const drainMs = Math.min(
      Number(process.env.SHUTDOWN_DRAIN_MS || 15_000),
      30_000
    );

    void (async () => {
      await runShutdownHooks();
      try {
        await closeRedis();
      } catch (err) {
        logRateLimited('shutdown:redis-close', 'warn', '[process] Redis close failed', err);
      }
      console.info('[process] shutdown complete');
      process.exit(0);
    })();

    setTimeout(() => {
      console.warn('[process] forced exit after drain timeout');
      process.exit(0);
    }, drainMs).unref?.();
  };

  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));
}
