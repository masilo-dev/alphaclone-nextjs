'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'ac-module-context-';

export interface ModuleContext {
  lastClientId?: string;
  lastInvoiceId?: string;
  lastDealId?: string;
  lastCampaignId?: string;
  lastProjectId?: string;
  lastViewedAt?: string;
}

export function useModuleContext(moduleId: string) {
  const storageKey = `${STORAGE_PREFIX}${moduleId}`;
  const [context, setContextState] = useState<ModuleContext>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setContextState(JSON.parse(raw) as ModuleContext);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const setContext = useCallback(
    (update: Partial<ModuleContext>) => {
      setContextState((prev) => {
        const next = { ...prev, ...update, lastViewedAt: new Date().toISOString() };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey]
  );

  const clearContext = useCallback(() => {
    setContextState({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { context, setContext, clearContext };
}

export default useModuleContext;
