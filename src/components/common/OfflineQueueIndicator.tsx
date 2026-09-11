'use client';

import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface OfflineQueueIndicatorProps {
  tenantId?: string;
  userId?: string;
}

export function OfflineQueueIndicator({ tenantId, userId }: OfflineQueueIndicatorProps) {
  const { pendingCount, syncing, syncNow } = useOfflineSync(tenantId, userId);

  if (!pendingCount) return null;

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      disabled={syncing}
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15 transition-colors"
      title="Tap to sync queued offline changes"
    >
      {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
      <span>{pendingCount} offline</span>
    </button>
  );
}
