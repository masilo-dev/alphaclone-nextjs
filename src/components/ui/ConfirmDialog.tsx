'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Button } from '@/components/ui/UIComponents';

export type ConfirmDialogVariant = 'primary' | 'danger';

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
    setOptions(null);
  }, []);

  const confirm = useCallback(async (next: ConfirmDialogOptions) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setOptions(next);
    setOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <Modal
        isOpen={open}
        onClose={() => close(false)}
        title={options?.title}
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-5">
          {options?.description ? (
            <p className="text-sm text-[var(--text-secondary)]">{options.description}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              {options?.cancelLabel || 'Cancel'}
            </Button>
            <Button
              type="button"
              variant={options?.variant === 'danger' ? 'danger' : 'primary'}
              onClick={() => close(true)}
            >
              {options?.confirmLabel || (options?.variant === 'danger' ? 'Delete' : 'Confirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return ctx;
}

