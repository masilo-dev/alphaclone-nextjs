'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SuccessAction =
  | 'completed'
  | 'saved'
  | 'scheduled'
  | 'sent'
  | 'recovered'
  | 'generated'
  | 'connected';

export interface SuccessFeedbackPayload {
  action: SuccessAction;
  title: string;
  detail?: string;
  impact?: string;
  durationMs?: number;
}

interface SuccessFeedbackContextValue {
  showSuccess: (payload: SuccessFeedbackPayload) => void;
}

const SuccessFeedbackContext = createContext<SuccessFeedbackContextValue | null>(null);

const ACTION_LABELS: Record<SuccessAction, string> = {
  completed: 'Completed',
  saved: 'Saved',
  scheduled: 'Scheduled',
  sent: 'Sent',
  recovered: 'Recovered',
  generated: 'Generated',
  connected: 'Connected',
};

export function SuccessFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<SuccessFeedbackPayload | null>(null);

  const showSuccess = useCallback((payload: SuccessFeedbackPayload) => {
    setToast(payload);
    const duration = payload.durationMs ?? 5000;
    window.setTimeout(() => setToast(null), duration);
  }, []);

  return (
    <SuccessFeedbackContext.Provider value={{ showSuccess }}>
      {children}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'fixed bottom-20 md:bottom-6 right-4 z-[9999] max-w-sm',
            'ac-workspace-panel border border-emerald-500/30 shadow-xl',
            'p-4 animate-in slide-in-from-bottom-4 fade-in duration-300'
          )}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
                {ACTION_LABELS[toast.action]}
              </p>
              <p className="text-[13px] font-medium text-[var(--ws-text-primary)] mt-0.5">{toast.title}</p>
              {toast.detail ? (
                <p className="text-[12px] text-[var(--ws-text-secondary)] mt-1">{toast.detail}</p>
              ) : null}
              {toast.impact ? (
                <p className="text-[11px] text-emerald-300/80 mt-1.5">{toast.impact}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 p-1 rounded hover:bg-white/5 text-[var(--ws-text-tertiary)]"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </SuccessFeedbackContext.Provider>
  );
}

export function useSuccessFeedback(): SuccessFeedbackContextValue {
  const ctx = useContext(SuccessFeedbackContext);
  if (!ctx) {
    return {
      showSuccess: () => {
        /* no-op when provider missing */
      },
    };
  }
  return ctx;
}

/** Convenience builders for common business actions. */
export const successMessages = {
  invoiceSent: (clientName: string, amount: string, dueDays: number) => ({
    action: 'sent' as const,
    title: `Invoice sent to ${clientName}`,
    detail: `${amount} due in ${dueDays} days`,
    impact: 'Client can pay online from the secure link.',
  }),
  quoteSent: (clientName: string) => ({
    action: 'sent' as const,
    title: `Quote sent to ${clientName}`,
    impact: 'They can review, accept, or request changes online.',
  }),
  contractSent: (clientName: string) => ({
    action: 'sent' as const,
    title: `Contract sent to ${clientName}`,
    impact: 'You will be notified when they sign.',
  }),
  campaignScheduled: (name: string, sendAt: string) => ({
    action: 'scheduled' as const,
    title: `Campaign "${name}" scheduled`,
    detail: sendAt,
  }),
  taskCompleted: (title: string) => ({
    action: 'completed' as const,
    title: `Task done: ${title}`,
  }),
};
