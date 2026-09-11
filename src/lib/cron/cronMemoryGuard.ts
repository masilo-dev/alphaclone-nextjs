import { NextResponse } from 'next/server';
import { getMemorySnapshot, isMemoryPressureHigh } from '@/lib/runtime/memoryTelemetry';

/**
 * Skip heavy cron work when the Node heap is under pressure.
 * Prevents cron pile-ups from pushing the web process into OOM restart loops.
 */
export function denyIfCronMemoryPressure(cronName: string): NextResponse | null {
  if (process.env.DISABLE_CRON_MEMORY_GUARD === 'true') return null;
  if (!isMemoryPressureHigh()) return null;

  const snap = getMemorySnapshot();
  console.warn(`[cron:${cronName}] deferred — memory pressure ${snap.heapUsedPct}%`, snap);

  return NextResponse.json(
    {
      success: false,
      deferred: true,
      reason: 'memory_pressure',
      memory: snap,
      cron: cronName,
    },
    { status: 503 }
  );
}
