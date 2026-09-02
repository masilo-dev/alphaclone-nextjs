/**
 * Rate-limits repeated identical log lines to prevent log-driven memory/IO pressure.
 */

const lastLoggedAt = new Map<string, number>();

export function logRateLimited(
  key: string,
  level: 'error' | 'warn' | 'info',
  message: string,
  detail?: unknown,
  intervalMs = 60_000
): void {
  const now = Date.now();
  const last = lastLoggedAt.get(key) || 0;
  if (now - last < intervalMs) return;
  lastLoggedAt.set(key, now);

  if (lastLoggedAt.size > 500) {
    const cutoff = now - intervalMs * 2;
    for (const [k, ts] of lastLoggedAt) {
      if (ts < cutoff) lastLoggedAt.delete(k);
    }
  }

  const payload = detail !== undefined ? [message, detail] : [message];
  if (level === 'error') console.error(...payload);
  else if (level === 'warn') console.warn(...payload);
  else console.info(...payload);
}
