/**
 * Reject starting additional background work when heap is critically high.
 * Does not crash the process — callers skip or defer work instead.
 */

const HEAP_REJECT_MB = Number(process.env.BACKGROUND_JOB_HEAP_REJECT_MB || 3072);

export function resolveBackgroundJobHeapRejectMb(): number {
  return HEAP_REJECT_MB;
}

export function isBackgroundJobHeapBlocked(): boolean {
  const heapUsedMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  return heapUsedMb >= HEAP_REJECT_MB;
}

export function backgroundJobBlockedReason(): string | null {
  if (!isBackgroundJobHeapBlocked()) return null;
  const heapUsedMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  return `heap_used_mb=${heapUsedMb} exceeds limit=${HEAP_REJECT_MB}`;
}
