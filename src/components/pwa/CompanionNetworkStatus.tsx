'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function CompanionNetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="ac-v3-elevated mx-3 mt-2 flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs text-[var(--text-secondary)]"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-[var(--warning-500)]" aria-hidden />
      <span>You're offline. Viewing cached information where available. Actions that require confirmation need a connection.</span>
    </div>
  );
}

export default CompanionNetworkStatus;
