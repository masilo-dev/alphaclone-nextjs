'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PublicStatusPill() {
  const [status, setStatus] = useState<'operational' | 'degraded' | 'unhealthy' | 'unknown'>('unknown');

  useEffect(() => {
    let isMounted = true;
    fetch('/api/platform-status', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!isMounted) return;
        if (data?.overall === 'operational') setStatus('operational');
        else if (data?.overall === 'degraded' || data?.overall === 'partial_outage') setStatus('degraded');
        else if (data?.overall === 'major_outage') setStatus('unhealthy');
        else {
          // Fallback probe to basic liveness
          return fetch('/api/health')
            .then((res) => res.ok ? res.json() : null)
            .then((hData) => {
              if (!isMounted) return;
              if (hData?.status === 'healthy') setStatus('operational');
              else setStatus('unknown');
            });
        }
      })
      .catch(() => {
        if (isMounted) setStatus('unknown');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const colorClass =
    status === 'operational'
      ? 'bg-[var(--success-500)]'
      : status === 'degraded'
        ? 'bg-[var(--warning-500)]'
        : status === 'unhealthy' ? 'bg-[var(--error-500)]' : 'bg-slate-400';

  const labelText =
    status === 'operational'
      ? 'All Systems Operational'
      : status === 'degraded'
        ? 'Degraded Performance'
        : status === 'unhealthy' ? 'System Disruption' : 'Status Unavailable';

  return (
    <Link
      href="/platform-status"
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[var(--ws-panel)]/80 px-2.5 py-1 type-ui font-medium text-[var(--ws-text-secondary)] hover:border-white/20 hover:text-white transition-all"
      title={`Live Platform Status: ${labelText}`}
    >
      <span className="relative flex h-2 w-2">
        {status !== 'unknown' && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colorClass} opacity-75`} />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${colorClass}`} />
      </span>
      <span>{labelText}</span>
    </Link>
  );
}
