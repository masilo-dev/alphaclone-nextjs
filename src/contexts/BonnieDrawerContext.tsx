'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type BonnieMode =
  | 'ask'
  | 'create'
  | 'analyse'
  | 'summarise'
  | 'automate'
  | 'find'
  | 'draft'
  | 'explain';

export interface BonnieRecordContext {
  type: string;
  id?: string;
  label: string;
  href?: string;
}

interface BonnieDrawerContextValue {
  open: boolean;
  mode: BonnieMode;
  contexts: BonnieRecordContext[];
  openDrawer: (opts?: { mode?: BonnieMode; contexts?: BonnieRecordContext[] }) => void;
  closeDrawer: () => void;
  setMode: (mode: BonnieMode) => void;
  setContexts: (contexts: BonnieRecordContext[]) => void;
  clearContexts: () => void;
}

const BonnieDrawerContext = createContext<BonnieDrawerContextValue | null>(null);

export function BonnieDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BonnieMode>('ask');
  const [contexts, setContexts] = useState<BonnieRecordContext[]>([]);

  const openDrawer = useCallback((opts?: { mode?: BonnieMode; contexts?: BonnieRecordContext[] }) => {
    if (opts?.mode) setMode(opts.mode);
    if (opts?.contexts) setContexts(opts.contexts);
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setOpen(false), []);
  const clearContexts = useCallback(() => setContexts([]), []);

  const value = useMemo(
    () => ({
      open,
      mode,
      contexts,
      openDrawer,
      closeDrawer,
      setMode,
      setContexts,
      clearContexts,
    }),
    [open, mode, contexts, openDrawer, closeDrawer, clearContexts]
  );

  return <BonnieDrawerContext.Provider value={value}>{children}</BonnieDrawerContext.Provider>;
}

export function useBonnieDrawer() {
  const ctx = useContext(BonnieDrawerContext);
  if (!ctx) {
    throw new Error('useBonnieDrawer must be used within BonnieDrawerProvider');
  }
  return ctx;
}

/** Safe hook when provider may be absent (e.g. marketing shells). */
export function useBonnieDrawerOptional() {
  return useContext(BonnieDrawerContext);
}
