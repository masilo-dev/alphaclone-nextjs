/**
 * Lightweight process memory telemetry for production stability monitoring.
 * Logs periodically at INFO level — never generates heap snapshots.
 */

export type MemorySnapshot = {
  timestamp: string;
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
  externalMb: number;
  arrayBuffersMb: number;
  heapUsedPct: number;
};

let baseline: MemorySnapshot | null = null;
let lastLoggedAt = 0;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

function readSnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const externalMb = Math.round(mem.external / 1024 / 1024);
  const arrayBuffersMb = Math.round((mem.arrayBuffers || 0) / 1024 / 1024);
  const heapLimitMb = resolveHeapLimitMb();
  const heapUsedPct = heapLimitMb > 0 ? Math.round((mem.heapUsed / (heapLimitMb * 1024 * 1024)) * 100) : 0;

  return {
    timestamp: new Date().toISOString(),
    rssMb,
    heapTotalMb,
    heapUsedMb,
    externalMb,
    arrayBuffersMb,
    heapUsedPct,
  };
}

export function resolveHeapLimitMb(): number {
  const raw = process.env.NODE_OPTIONS || '';
  const match = raw.match(/--max-old-space-size=(\d+)/);
  if (match) return Number(match[1]);
  return 2048;
}

export function getMemorySnapshot(): MemorySnapshot {
  return readSnapshot();
}

export function getMemoryBaseline(): MemorySnapshot | null {
  return baseline;
}

/** True when heap usage exceeds the configured pressure threshold (default 80%). */
export function isMemoryPressureHigh(thresholdPct?: number): boolean {
  const threshold = thresholdPct ?? Number(process.env.MEMORY_PRESSURE_PCT || 80);
  const snap = readSnapshot();
  return snap.heapUsedPct >= threshold;
}

export function startMemoryTelemetry(): void {
  if (intervalHandle || process.env.DISABLE_MEMORY_TELEMETRY === 'true') return;

  baseline = readSnapshot();
  const intervalMs = Math.max(60_000, Number(process.env.MEMORY_TELEMETRY_INTERVAL_MS || 300_000));

  console.info('[memory] baseline', baseline);

  intervalHandle = setInterval(() => {
    const snap = readSnapshot();
    const now = Date.now();
    if (now - lastLoggedAt < intervalMs - 1000) return;
    lastLoggedAt = now;

    const growthMb = baseline ? snap.heapUsedMb - baseline.heapUsedMb : 0;
    console.info('[memory] periodic', { ...snap, growthSinceBaselineMb: growthMb });

    if (snap.heapUsedPct >= 90) {
      console.warn('[memory] critical pressure', snap);
      void import('@/lib/runtime/heapSnapshot').then(({ maybeWriteHeapSnapshot }) => {
        maybeWriteHeapSnapshot('critical-pressure');
      });
    } else if (snap.heapUsedPct >= 75) {
      console.warn('[memory] elevated pressure', snap);
    }
  }, intervalMs);

  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }
}

export function stopMemoryTelemetry(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
