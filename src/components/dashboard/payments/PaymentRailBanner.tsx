'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, ExternalLink, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/UIComponents';

type PaymentRailState = {
  connected: boolean;
  accountId?: string;
  accountDisplayName?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  reconnectRequired?: boolean;
  replacementPending?: boolean;
};

export function PaymentRailBanner({ compact = false }: { compact?: boolean }) {
  const { currentTenant } = useTenant();
  const [state, setState] = useState<PaymentRailState | null>(null);

  const refresh = useCallback(async () => {
    if (!currentTenant?.id) return;
    try {
      const response = await fetch(`/api/stripe/connect/status?tenantId=${currentTenant.id}`, { cache: 'no-store' });
      if (!response.ok) return;
      setState(await response.json());
    } catch { /* Financial surfaces remain usable for manual/offline workflows. */ }
  }, [currentTenant?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openPayments = () => {
    window.location.href = '/dashboard/business/settings?tab=integrations';
  };

  if (!state) return null;
  const ready = Boolean(state.connected && state.chargesEnabled);

  if (ready) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="type-ui font-semibold text-[var(--ws-text-primary)]">Online payments active</p>
            <p className="type-card-description text-[var(--ws-text-muted)]">
              {state.accountDisplayName || 'Your Stripe account'} is connected. New invoice card payments go directly to that Stripe account.
              {state.replacementPending ? ' A replacement account is being prepared; this account stays active until the replacement is ready.' : ''}
            </p>
          </div>
        </div>
        {!compact && <Button variant="outline" onClick={openPayments} className="shrink-0"><ExternalLink className="mr-2 h-4 w-4" />Payment settings</Button>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
          {state.accountId ? <TriangleAlert className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="type-ui font-semibold text-[var(--ws-text-primary)]">{state.accountId ? 'Finish payment setup' : 'Connect payments when you are ready'}</p>
          <p className="type-card-description text-[var(--ws-text-muted)]">
            {state.accountId
              ? 'Your finance workspace is ready, but Stripe still needs information before customers can pay invoices online.'
              : 'You can create clients, invoices, receipts and keep your books without Stripe. Connect your own Stripe account only when you want customers to pay invoices online.'}
          </p>
          {!state.accountId && !compact && (
            <p className="mt-1 type-card-description text-[var(--ws-text-secondary)]"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />AlphaClone tracks the invoice; Stripe processes the payment directly to your business.</p>
          )}
        </div>
      </div>
      <Button onClick={openPayments} className="shrink-0">{state.accountId ? 'Finish setup' : 'Connect Stripe'}</Button>
    </div>
  );
}
