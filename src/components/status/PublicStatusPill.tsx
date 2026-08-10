'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PublicStatusPill() {
  const [status, setStatus] = useState<'healthy' | 'degraded' | 'unhealthy'>('healthy');

  useEffect(() => {
    let isMounted = true;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.status === 'healthy') setStatus('healthy');
        else if (data?.status === 'degraded') setStatus('degraded');
        else setStatus('unhealthy');
      })
      .catch(() => {
        if (isMounted) setStatus('healthy');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const colorClass =
    status === 'healthy'
      ? 'bg-emerald-400'
      : status === 'degraded'
        ? 'bg-amber-400'
        : 'bg-rose-400';

  const labelText =
    status === 'healthy'
      ? 'All Systems Operational'
      : status === 'degraded'
        ? 'Degraded Performance'
        : 'System Disruption';

  return (
    <Link
      href="/platform-status"
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-white/20 hover:text-white transition-all"
      title={`Live Platform Status: ${labelText}`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colorClass} opacity-75`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${colorClass}`} />
      </span>
      <span>{labelText}</span>
    </Link>
  );
}
