'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PublicStatusPill() {
  const [status, setStatus] = useState<'healthy' | 'degraded' | 'unhealthy' | 'unknown'>('unknown');

  useEffect(() => {
    let isMounted = true;
    fetch('/api/health')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!isMounted) return;
        if (data?.status === 'healthy') setStatus('healthy');
        else if (data?.status === 'degraded') setStatus('degraded');
        else if (data?.status === 'unhealthy') setStatus('unhealthy');
        else setStatus('unknown');
      })
      .catch(() => {
        if (isMounted) setStatus('unknown');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const colorClass =
    status === 'healthy'
      ? 'bg-[var(--success-500)]'
      : status === 'degraded'
        ? 'bg-[var(--warning-500)]'
        : status === 'unhealthy' ? 'bg-[var(--error-500)]' : 'bg-slate-400';

  const labelText =
    status === 'healthy'
      ? 'Web App Responding'
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
