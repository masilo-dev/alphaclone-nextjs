'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { syncOfflineMutations } from '@/lib/offline/syncMutations';
import { offlineService } from '@/services/offlineService';

export function useOfflineSync(tenantId?: string, userId?: string) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    if (!tenantId || !userId) {
      setPendingCount(0);
      return;
    }
    const count = await offlineService.getQueuedUpdatesCount({ tenantId, userId });
    setPendingCount(count);
  }, [tenantId, userId]);

  const syncNow = useCallback(async () => {
    if (!tenantId || !userId || syncing) return;
    setSyncing(true);
    try {
      await offlineService.init();
      const result = await syncOfflineMutations({ tenantId, userId });
      await refreshCount();
      if (result.synced > 0) {
        toast.success(`${result.synced} offline change${result.synced === 1 ? '' : 's'} synced`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} offline change${result.failed === 1 ? '' : 's'} could not sync`);
      }
    } finally {
      setSyncing(false);
    }
  }, [tenantId, userId, syncing, refreshCount]);

  useEffect(() => {
    if (!tenantId || !userId) return;

    void offlineService.init().then(refreshCount);

    const handleOnline = () => {
      void syncNow();
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ALPHACLONE_SYNC_REQUESTED') {
        void syncNow();
      }
    };

    window.addEventListener('online', handleOnline);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [tenantId, userId, syncNow, refreshCount]);

  return { pendingCount, syncing, syncNow, refreshCount };
}
