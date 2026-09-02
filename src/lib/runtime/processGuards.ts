/**
 * Process-level stability guards: uncaught errors, unhandled rejections, SIGTERM drain.
 */

import { stopMemoryTelemetry } from '@/lib/runtime/memoryTelemetry';

let shuttingDown = false;
let activeRequests = 0;

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

export function registerProcessGuards(): void {
  if ((globalThis as { __alphaclone_process_guards__?: boolean }).__alphaclone_process_guards__) {
    return;
  }
  (globalThis as { __alphaclone_process_guards__?: boolean }).__alphaclone_process_guards__ = true;

  process.on('uncaughtException', (err) => {
    console.error('[process] uncaughtException', {
      message: err?.message,
      stack: err?.stack,
      activeRequests,
    });
  });

  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    console.error('[process] unhandledRejection', { message, stack, activeRequests });
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
    setTimeout(() => {
      console.info('[process] shutdown complete');
      process.exit(0);
    }, drainMs).unref?.();
  };

  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));
}
