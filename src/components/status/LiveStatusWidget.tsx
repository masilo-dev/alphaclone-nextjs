'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

interface LiveStatusWidgetProps {
  initialStatus: HealthStatus;
  initialLatency: number | null;
  initialCheckedAt: string;
}

const STATUS_LABELS: Record<HealthStatus, string> = {
  healthy: 'Web app responding',
  degraded: 'Degraded',
  unhealthy: 'Disrupted',
  unknown: 'Not verified',
};

function parseHealthStatus(value: unknown): HealthStatus {
  const status = String(value || '').toLowerCase();
  if (status === 'healthy' || status === 'ok' || status === 'operational') return 'healthy';
  if (status === 'degraded' || status === 'warning') return 'degraded';
  if (status === 'unhealthy' || status === 'failed' || status === 'down') return 'unhealthy';
  return 'unknown';
}

export default function LiveStatusWidget({ initialStatus, initialLatency, initialCheckedAt }: LiveStatusWidgetProps) {
  const [status, setStatus] = useState<HealthStatus>(initialStatus);
  const [latency, setLatency] = useState<number | null>(initialStatus === 'unknown' ? null : initialLatency);
  const [lastChecked, setLastChecked] = useState(initialCheckedAt);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const fetchLiveStatus = useCallback(async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const payload = response.ok ? await response.json().catch(() => null) : null;
      const nextStatus = parseHealthStatus(payload?.status);
      setStatus(nextStatus);
      setLatency(nextStatus === 'unknown' ? null : Date.now() - start);
    } catch {
      setStatus('unknown');
      setLatency(null);
    } finally {
      setLastChecked(new Date().toISOString());
      setIsRefreshing(false);
      setCountdown(30);
    }
  }, []);

  useEffect(() => {
    const countdownTimer = window.setInterval(() => setCountdown((remaining) => Math.max(0, remaining - 1)), 1000);
    const refreshTimer = window.setInterval(() => void fetchLiveStatus(), 30_000);
    return () => {
      window.clearInterval(countdownTimer);
      window.clearInterval(refreshTimer);
    };
  }, [fetchLiveStatus]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-4">
      <div>
        <p role="status" className="type-ui font-semibold text-[var(--marketing-text-secondary)]">Live check: {STATUS_LABELS[status]}</p>
        <p className="mt-1 type-caption text-[var(--marketing-text-secondary)]">
          {status === 'unknown' ? 'Health could not be verified.' : `API responded in ${latency ?? '—'}ms.`}
          {' '}Last check attempt: <time dateTime={lastChecked}>{new Date(lastChecked).toLocaleTimeString()}</time>.
          {' '}Refreshes in {countdown}s.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void fetchLiveStatus()}
        disabled={isRefreshing}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)] px-4 type-ui font-medium text-[var(--marketing-text-secondary)] hover:bg-[var(--marketing-bg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 disabled:opacity-50"
      >
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Checking…' : 'Refresh status'}
      </button>
    </div>
  );
}
