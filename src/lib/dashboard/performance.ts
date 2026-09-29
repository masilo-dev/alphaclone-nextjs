/** Browser timing for dashboard data boundaries. Never include record data or IDs in labels. */
export function dashboardTimer(operation: string, slowThresholdMs = 1000): () => number {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return () => {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
    if (process.env.NODE_ENV !== 'production' && elapsed >= slowThresholdMs) {
      console.warn('[dashboard-performance]', { operation, durationMs: Math.round(elapsed) });
    }
    return elapsed;
  };
}
