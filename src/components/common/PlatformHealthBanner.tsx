'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function PlatformHealthBanner() {
  const [degraded, setDegraded] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health?deep=1', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (isMounted) {
          if (data && data.status === 'degraded') {
            setDegraded('Some supporting platform services are experiencing elevated latency. Systems are automatically recovering.');
          } else if (data && data.status === 'unhealthy') {
            setDegraded('A core service is experiencing disruption. Our automated orchestrators are resolving the issue.');
          } else {
            setDegraded(null);
          }
        }
      } catch {
        // Ignore network check glitches
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!degraded || dismissed) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-semibold">{degraded}</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/platform-status"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white font-bold"
          >
            View Live Status Page
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-400 hover:text-amber-200 p-0.5 rounded"
            title="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
