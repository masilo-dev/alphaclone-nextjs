'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../ui/UIComponents';
import { AlertCircle, CheckCircle2, CreditCard, ExternalLink, RefreshCw, ShieldCheck, Unlink } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

interface StripeConnectStatus {
  connected: boolean;
  reconnectRequired?: boolean;
  accountId?: string;
  accountDisplayName?: string | null;
  country?: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements?: unknown[];
}

export const StripeConnectOnboarding: React.FC = () => {
  const { currentTenant } = useTenant();
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [businessCountry, setBusinessCountry] = useState('');

  const checkConnectStatus = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/stripe/connect/status?tenantId=${currentTenant.id}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Stripe status could not be loaded');
      setStatus(data);
      if (data.country) setBusinessCountry(String(data.country).toUpperCase());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stripe status could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  const startOnboarding = async (replaceAccount = false) => {
    if (!currentTenant?.id) return toast.error('No active organization selected');
    if (businessCountry.length !== 2) return toast.error('Enter the 2-letter country code where the business is legally registered.');
    if (replaceAccount && !window.confirm('Change the Stripe account used for new payments? Existing invoice and payment history will remain linked to the original account.')) return;

    setLoading(true);
    try {
      const response = await fetch('/api/stripe/connect/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          returnUrl: `${window.location.origin}/dashboard/business/settings?tab=integrations&connect=success`,
          refreshUrl: `${window.location.origin}/dashboard/business/settings?tab=integrations&connect=refresh`,
          country: businessCountry,
          replaceAccount,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Stripe onboarding could not be started');
      window.location.assign(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect Stripe account');
      setLoading(false);
    }
  };

  const handleManageAccount = async () => {
    if (!status?.accountId || !currentTenant?.id) return;
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/connect/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Stripe dashboard could not be opened');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open Stripe dashboard');
    } finally { setLoading(false); }
  };

  const handleDisconnect = async () => {
    if (!currentTenant?.id || !status?.accountId) return;
    if (!window.confirm('Disconnect Stripe from AlphaClone? New invoice payments will stop until another account is connected. Historical payments will be preserved.')) return;
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/connect/disconnect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Stripe account could not be disconnected');
      setStatus({ connected: false, chargesEnabled: false, payoutsEnabled: false, requirements: [] });
      setBusinessCountry('');
      toast.success('Stripe disconnected. Historical invoice and payment records were preserved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stripe account could not be disconnected');
    } finally { setLoading(false); }
  };

  useEffect(() => { void checkConnectStatus(); }, [checkConnectStatus]);

  const hasAccount = Boolean(status?.accountId);
  const ready = Boolean(status?.connected && status.chargesEnabled);
  const needsAction = Boolean(status?.reconnectRequired || (hasAccount && (!status?.chargesEnabled || (status?.requirements?.length || 0) > 0)));

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]">
      <header className="flex flex-col gap-4 border-b border-[var(--ws-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--ws-border)] bg-white p-1.5 shadow-sm">
            <Image src="/logo.png" alt="AlphaClone Systems" width={34} height={34} className="h-full w-full object-contain" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--ws-text-primary)]">AlphaClone Payments</h3>
            <p className="type-card-description text-[var(--ws-text-muted)]">Payments powered by Stripe</p>
          </div>
        </div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 type-label font-medium ${ready ? 'bg-emerald-500/10 text-emerald-400' : needsAction ? 'bg-amber-500/10 text-amber-400' : 'bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-muted)]'}`}>
          {ready ? <CheckCircle2 className="h-4 w-4" /> : needsAction ? <AlertCircle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
          {ready ? 'Ready to accept payments' : needsAction ? 'Action required' : 'Not connected'}
        </div>
      </header>

      <div className="space-y-5 p-5">
        {loading && !status ? (
          <div className="flex min-h-32 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-[var(--ws-text-muted)]" /></div>
        ) : hasAccount ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatusCell label="Connected account" value={status?.accountDisplayName || maskAccount(status?.accountId)} ok />
              <StatusCell label="Payments" value={status?.chargesEnabled ? 'Active' : 'Not active'} ok={Boolean(status?.chargesEnabled)} />
              <StatusCell label="Payouts" value={status?.payoutsEnabled ? 'Active' : 'Not active'} ok={Boolean(status?.payoutsEnabled)} />
            </div>

            {needsAction && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-300">{status?.reconnectRequired ? 'Stripe needs to be reconnected' : 'Finish your Stripe setup'}</p>
                    <p className="mt-1 type-card-description text-[var(--ws-text-muted)]">Complete Stripe’s required business information before AlphaClone enables new invoice payments.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
                <p className="type-card-description text-[var(--ws-text-secondary)]">Customer payments are created on this business’s connected Stripe account. AlphaClone synchronizes invoice status, refunds and payment records; it does not reroute tenant revenue through AlphaClone.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {ready && <Button onClick={handleManageAccount} disabled={loading} variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Manage Stripe</Button>}
              {!ready && <Button onClick={() => startOnboarding(false)} disabled={loading || businessCountry.length !== 2}>Continue Stripe setup</Button>}
              <Button onClick={() => startOnboarding(true)} disabled={loading || businessCountry.length !== 2} variant="outline">Change account</Button>
              <Button onClick={checkConnectStatus} disabled={loading} variant="outline"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
              <Button onClick={handleDisconnect} disabled={loading} variant="outline" className="text-red-400 hover:text-red-300"><Unlink className="mr-2 h-4 w-4" />Disconnect</Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h4 className="font-medium text-[var(--ws-text-primary)]">Connect the account that should receive your customer payments</h4>
              <p className="mt-1 type-card-description text-[var(--ws-text-muted)]">Invoices created in AlphaClone will use this Stripe account for new online payments. You can change it later without rewriting historical transactions.</p>
            </div>
            <div className="max-w-sm">
              <label htmlFor="stripe-business-country" className="mb-1 block type-label font-medium text-[var(--ws-text-secondary)]">Business country</label>
              <input id="stripe-business-country" value={businessCountry}
                onChange={(event) => setBusinessCountry(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                maxLength={2} autoComplete="country" placeholder="e.g. US, PL, ZW"
                className="w-full rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-tertiary)] px-3 py-2 text-[var(--ws-text-primary)] uppercase" />
              <p className="mt-1 type-card-description text-[var(--ws-text-muted)]">2-letter code for the country where the business is legally registered.</p>
            </div>
            <Button onClick={() => startOnboarding(false)} disabled={loading || businessCountry.length !== 2} className="w-full sm:w-auto">
              {loading ? 'Opening Stripe…' : 'Connect Stripe'}
            </Button>
          </>
        )}
      </div>
    </section>
  );
};

function StatusCell({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-3">
    <p className="type-label text-[var(--ws-text-muted)]">{label}</p>
    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-[var(--ws-text-primary)]">
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />{value}
    </div>
  </div>;
}

function maskAccount(accountId?: string) {
  if (!accountId) return 'Stripe account';
  return accountId.length > 10 ? `${accountId.slice(0, 7)}…${accountId.slice(-4)}` : accountId;
}
