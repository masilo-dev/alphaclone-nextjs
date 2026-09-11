'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PlatformKpiGrid } from '@/components/dashboard/metrics';
import { platformKpiFromNumbers } from '@/lib/metrics/metricPresentation';

type TenantOption = {
  id: string;
  name: string;
  status?: string;
  plan?: string;
};

type ErrorRow = {
  id: string;
  tenant_id?: string | null;
  error_type?: string | null;
  error_message?: string | null;
  message?: string | null;
  endpoint?: string | null;
  status_code?: number | null;
  severity?: string | null;
  created_at: string;
};

type EmailRow = {
  id: string;
  status?: string | null;
  provider?: string | null;
  to_email?: string | null;
  subject?: string | null;
  error?: string | null;
  created_at: string;
};

type ControlCenterPayload = {
  summary: {
    tenants: number;
    users: number;
    errors24h: number;
    criticalErrors24h: number;
    emails24h: number;
    emailFailures24h: number;
  };
  tenants: TenantOption[];
  recentErrors: ErrorRow[];
  recentEmails: EmailRow[];
};

type Audience = 'all' | 'tenant' | 'user';

export const SuperAdminDashboardTab: React.FC = () => {
  const [data, setData] = useState<ControlCenterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<Audience>('tenant');
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/control-center', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load control center');
      setData(json);
      if (!tenantId && json.tenants?.[0]?.id) setTenantId(json.tenants[0].id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load Super Admin');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const kpis = useMemo(
    () => [
      platformKpiFromNumbers({
        metricId: 'admin.total_users',
        label: 'Platform users',
        current: summary?.users ?? null,
        formattedValue: summary?.users != null ? String(summary.users) : undefined,
        referencePeriod: 'registered accounts',
        state: loading ? 'loading' : summary ? 'ready' : 'empty',
      }),
      platformKpiFromNumbers({
        label: 'Tenants',
        current: summary?.tenants ?? null,
        formattedValue: summary?.tenants != null ? String(summary.tenants) : undefined,
        referencePeriod: 'active workspaces',
        state: loading ? 'loading' : summary ? 'ready' : 'empty',
      }),
      platformKpiFromNumbers({
        label: 'Errors · 24h',
        current: summary?.errors24h ?? null,
        formattedValue: summary?.errors24h != null ? String(summary.errors24h) : undefined,
        isBetterHigher: false,
        referencePeriod: `${summary?.criticalErrors24h ?? 0} critical/error severity`,
        state: loading ? 'loading' : summary ? 'ready' : 'empty',
      }),
      platformKpiFromNumbers({
        label: 'Emails sent · 24h',
        current: summary?.emails24h ?? null,
        formattedValue: summary?.emails24h != null ? String(summary.emails24h) : undefined,
        referencePeriod: `${summary?.emailFailures24h ?? 0} failed`,
        state: loading ? 'loading' : summary ? 'ready' : 'empty',
      }),
    ],
    [loading, summary],
  );

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Add a subject and message first.');
      return;
    }
    if (audience === 'tenant' && !tenantId) {
      toast.error('Choose a tenant.');
      return;
    }
    if (audience === 'user' && !email.trim()) {
      toast.error('Enter a registered user email.');
      return;
    }

    const targetLabel =
      audience === 'all'
        ? 'every registered tenant user'
        : audience === 'tenant'
          ? data?.tenants.find((tenant) => tenant.id === tenantId)?.name || 'this tenant'
          : email.trim();

    if (!window.confirm(`Send “${subject.trim()}” to ${targetLabel}?`)) return;

    setSending(true);
    try {
      const res = await fetch('/api/admin/control-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          tenantId: audience === 'tenant' ? tenantId : undefined,
          email: audience === 'user' ? email.trim() : undefined,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Send failed');

      if (json.failed > 0) {
        toast.error(`Sent ${json.sent}; ${json.failed} failed.`);
      } else {
        toast.success(`Sent successfully to ${json.sent} recipient${json.sent === 1 ? '' : 's'}.`);
      }
      setSubject('');
      setMessage('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 ac-enterprise-module">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ac-accent)]">Platform owner</p>
          <h1 className="mt-1 flex items-center gap-2 text-[28px] font-bold tracking-tight text-[var(--ws-text-primary)]">
            <ShieldCheck className="h-6 w-6" />
            Super Admin Control Center
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ws-text-secondary)]">
            One place to monitor platform health, inspect global errors, manage tenant communication, and verify outbound delivery.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="ac-workspace-action-btn inline-flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <PlatformKpiGrid items={kpis} loading={loading} skeletonCount={4} />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="ac-workspace-panel p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ws-text-primary)]">
                <Mail className="h-4 w-4 text-[var(--ac-accent)]" />
                Tenant communications
              </div>
              <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">
                Send a platform message to one registered user, one tenant, or everyone. Sends are logged and admin actions are audited.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ['tenant', 'One tenant'],
              ['user', 'One user'],
              ['all', 'Everyone'],
            ] as Array<[Audience, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAudience(value)}
                className={`min-h-11 rounded-[var(--ws-radius-lg)] border px-3 text-sm font-medium transition-colors ${
                  audience === value
                    ? 'border-[var(--ac-accent)] bg-[var(--ac-accent-muted)] text-[var(--ws-text-primary)]'
                    : 'border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {audience === 'tenant' ? (
              <label className="block text-xs font-medium text-[var(--ws-text-secondary)]">
                Tenant
                <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-3 py-2.5 text-sm text-[var(--ws-text-primary)]">
                  {(data?.tenants || []).map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.plan || 'free'}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {audience === 'user' ? (
              <label className="block text-xs font-medium text-[var(--ws-text-secondary)]">
                Registered user email
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="user@example.com" className="mt-1.5 w-full rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-3 py-2.5 text-sm text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-muted)]" />
              </label>
            ) : null}

            {audience === 'all' ? (
              <div className="rounded-lg border border-[var(--warning-500)]/25 bg-[var(--warning-500)]/10 p-3 text-xs text-[var(--ws-text-secondary)]">
                This will send one email to every registered tenant user. A confirmation appears before delivery starts.
              </div>
            ) : null}

            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" className="w-full rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-3 py-2.5 text-sm text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-muted)]" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} placeholder="Write the platform message…" className="w-full resize-y rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-3 py-2.5 text-sm leading-6 text-[var(--ws-text-primary)] placeholder:text-[var(--ws-text-muted)]" />
            <div className="flex justify-end">
              <button type="button" onClick={() => void handleSend()} disabled={sending} className="ac-workspace-action-btn ac-workspace-action-btn--primary inline-flex min-h-11 items-center gap-2 disabled:opacity-50">
                <Send className="h-4 w-4" />
                {sending ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        </section>

        <section className="ac-workspace-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--ws-text-primary)]">Global error intelligence</p>
              <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">Errors captured in Supabase during the last 24 hours.</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-[var(--warning-500)]" />
          </div>

          {(data?.recentErrors || []).length === 0 ? (
            <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--success-500)]">
                <CheckCircle2 className="h-4 w-4" /> No captured errors in the last 24 hours
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--ws-text-secondary)]">
                This means the error table is quiet, not necessarily that every service is error-free. Production routes should keep forwarding failures into the central error log.
              </p>
            </div>
          ) : (
            <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {(data?.recentErrors || []).map((row) => (
                <div key={row.id} className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--ws-text-primary)]">{row.error_type || row.endpoint || 'Platform error'}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--ws-text-secondary)]">{row.error_message || row.message || 'No message recorded'}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[var(--error-500)]/25 bg-[var(--error-500)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--error-500)]">
                      {row.status_code || row.severity || 'error'}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--ws-text-muted)]">{new Date(row.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="ac-workspace-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ws-border)] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--ws-text-primary)]">Recent platform email delivery</p>
            <p className="mt-0.5 text-xs text-[var(--ws-text-secondary)]">See what was sent, provider used, and failures without opening another tool.</p>
          </div>
          <Building2 className="h-5 w-5 text-[var(--ac-accent)]" />
        </div>
        <div className="divide-y divide-[var(--ws-border)]">
          {(data?.recentEmails || []).length === 0 ? (
            <div className="p-5 text-sm text-[var(--ws-text-secondary)]">No email activity captured in the last 24 hours.</div>
          ) : (
            (data?.recentEmails || []).slice(0, 12).map((row) => (
              <div key={row.id} className="grid gap-2 px-5 py-3 text-xs sm:grid-cols-[auto_1fr_auto] sm:items-center">
                {row.status === 'sent' ? <CheckCircle2 className="h-4 w-4 text-[var(--success-500)]" /> : <XCircle className="h-4 w-4 text-[var(--error-500)]" />}
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--ws-text-primary)]">{row.subject || 'Untitled email'}</p>
                  <p className="truncate text-[var(--ws-text-muted)]">{row.to_email || 'unknown recipient'} · {row.provider || 'unknown provider'}</p>
                  {row.error ? <p className="mt-1 truncate text-[var(--error-500)]">{row.error}</p> : null}
                </div>
                <span className="text-[var(--ws-text-muted)]">{new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default SuperAdminDashboardTab;
