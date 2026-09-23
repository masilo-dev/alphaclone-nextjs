'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Globe,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Mail,
  Loader2,
  X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DnsHealth {
  spf: 'pass' | 'fail' | 'unknown';
  dkim: 'pass' | 'fail' | 'unknown';
  dmarc: 'pass' | 'fail' | 'unknown';
  mx: 'pass' | 'fail' | 'unknown';
}

interface Mailbox {
  id: string;
  tenant_id: string;
  email: string;
  provider: string;
  connection_state: 'connected' | 'error' | 'pending' | string;
  daily_limit: number;
  messages_sent_today: number;
  dns_health: DnsHealth | null;
  warnings: string[];
}

// ── Provider config ───────────────────────────────────────────────────────────

const PROVIDER_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  microsoft: { label: 'Microsoft', bg: 'bg-blue-100', text: 'text-blue-700' },
  google: { label: 'Google', bg: 'bg-red-100', text: 'text-red-700' },
  zoho: { label: 'Zoho', bg: 'bg-orange-100', text: 'text-orange-700' },
  brevo: { label: 'Brevo', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  resend: { label: 'Resend', bg: 'bg-violet-100', text: 'text-violet-700' },
  sendgrid: { label: 'SendGrid', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  smtp: { label: 'SMTP', bg: 'bg-slate-100', text: 'text-slate-700' },
};

function providerStyle(p: string) {
  return PROVIDER_STYLES[p?.toLowerCase()] ?? { label: p ?? 'Unknown', bg: 'bg-slate-100', text: 'text-slate-600' };
}

// ── DNS badge ─────────────────────────────────────────────────────────────────

function DnsBadge({ label, status }: { label: string; status: 'pass' | 'fail' | 'unknown' }) {
  const styles =
    status === 'pass'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'fail'
      ? 'bg-red-50 text-red-600 border-red-200'
      : 'bg-slate-50 text-slate-500 border-slate-200';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        styles
      )}
    >
      {status === 'pass' ? (
        <CheckCircle2 className="w-2.5 h-2.5" />
      ) : status === 'fail' ? (
        <AlertTriangle className="w-2.5 h-2.5" />
      ) : null}
      {label}
    </span>
  );
}

// ── Connection dot ────────────────────────────────────────────────────────────

function ConnectionDot({ state }: { state: string }) {
  const isConnected = state === 'connected';
  const isError = state === 'error';
  return (
    <span
      className={cn(
        'inline-block w-2.5 h-2.5 rounded-full shrink-0',
        isConnected ? 'bg-emerald-500' : isError ? 'bg-red-500' : 'bg-amber-400'
      )}
      title={state}
    />
  );
}

// ── Inline Add-Mailbox Form ───────────────────────────────────────────────────

interface AddMailboxFormProps {
  tenantId: string;
  onCreated: () => void;
  onCancel: () => void;
}

function AddMailboxForm({ tenantId, onCreated, onCancel }: AddMailboxFormProps) {
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState('smtp');
  const [dailyLimit, setDailyLimit] = useState(100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/outbound/mailboxes', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, email, provider, daily_limit: dailyLimit }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to add mailbox');
        onCreated();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to add mailbox');
      } finally {
        setSaving(false);
      }
    },
    [tenantId, email, provider, dailyLimit, onCreated]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">Add Mailbox</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Email address
          </label>
          <Input
            type="email"
            placeholder="outreach@yourdomain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {Object.entries(PROVIDER_STYLES).map(([key, ps]) => (
              <option key={key} value={key}>
                {ps.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Daily send limit
          </label>
          <Input
            type="number"
            min={1}
            max={2000}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Number(e.target.value))}
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving} className="bg-[#356AF4] hover:bg-[#2a5cd8] text-white">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
          Add Mailbox
        </Button>
      </div>
    </form>
  );
}

// ── Mailbox Card ─────────────────────────────────────────────────────────────

interface MailboxCardProps {
  mailbox: Mailbox;
  onCheckDns: (id: string) => void;
  checkingDns: boolean;
}

function MailboxCard({ mailbox, onCheckDns, checkingDns }: MailboxCardProps) {
  const ps = providerStyle(mailbox.provider);
  const used = mailbox.messages_sent_today ?? 0;
  const limit = mailbox.daily_limit ?? 100;
  const pct = Math.min(100, limit > 0 ? (used / limit) * 100 : 0);
  const dns = mailbox.dns_health;

  const progressColor =
    pct >= 90
      ? 'bg-red-500'
      : pct >= 70
      ? 'bg-amber-400'
      : 'bg-emerald-500';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ConnectionDot state={mailbox.connection_state} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{mailbox.email}</p>
            <p className="text-[11px] text-slate-500 capitalize mt-0.5">
              {mailbox.connection_state}
            </p>
          </div>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', ps.bg, ps.text)}>
          {ps.label}
        </span>
      </div>

      {/* Daily limit progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-medium">Daily sends</span>
          <span className="tabular-nums font-semibold text-slate-700">
            {used} / {limit}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', progressColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* DNS Health */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            DNS Health
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <DnsBadge label="SPF" status={dns?.spf ?? 'unknown'} />
          <DnsBadge label="DKIM" status={dns?.dkim ?? 'unknown'} />
          <DnsBadge label="DMARC" status={dns?.dmarc ?? 'unknown'} />
          <DnsBadge label="MX" status={dns?.mx ?? 'unknown'} />
        </div>
      </div>

      {/* Warnings */}
      {mailbox.warnings && mailbox.warnings.length > 0 && (
        <div className="space-y-1">
          {mailbox.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5"
            >
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="pt-1">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => onCheckDns(mailbox.id)}
          disabled={checkingDns}
        >
          {checkingDns ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <Globe className="w-3.5 h-3.5 mr-1.5" />
          )}
          Check DNS
        </Button>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MailboxSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
        <div className="h-4 w-40 rounded bg-slate-200" />
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200" />
      <div className="flex gap-2">
        <div className="h-5 w-10 rounded-full bg-slate-200" />
        <div className="h-5 w-10 rounded-full bg-slate-200" />
        <div className="h-5 w-12 rounded-full bg-slate-200" />
        <div className="h-5 w-8 rounded-full bg-slate-200" />
      </div>
      <div className="h-8 w-full rounded-lg bg-slate-200" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MailboxHealthPanel() {
  const { currentTenant } = useTenant();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingDnsId, setCheckingDnsId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant?.id) {
      setMailboxes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/outbound/mailboxes?tenantId=${currentTenant.id}`,
        { credentials: 'include' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load mailboxes');
      setMailboxes(Array.isArray(json.mailboxes) ? json.mailboxes : Array.isArray(json) ? json : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load mailboxes');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCheckDns = useCallback(
    async (mailboxId: string) => {
      if (!currentTenant?.id) return;
      setCheckingDnsId(mailboxId);
      try {
        const res = await fetch(
          `/api/outbound/mailboxes?action=dns&mailboxId=${mailboxId}&tenantId=${currentTenant.id}`,
          { credentials: 'include' }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'DNS check failed');
        // Merge updated mailbox dns_health into state
        setMailboxes((prev) =>
          prev.map((m) =>
            m.id === mailboxId
              ? { ...m, dns_health: json.dns_health ?? m.dns_health, warnings: json.warnings ?? m.warnings }
              : m
          )
        );
      } catch {
        // Silent – user still sees old data
      } finally {
        setCheckingDnsId(null);
      }
    },
    [currentTenant?.id]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!currentTenant?.id) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-8 text-center">
        <Mail className="mx-auto mb-3 w-8 h-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">Select a workspace to view mailboxes</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Mailbox Health</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Monitor sending limits, DNS records, and connection status for all mailboxes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="text-xs">
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-[#356AF4] hover:bg-[#2a5cd8] text-white text-xs"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Mailbox
          </Button>
        </div>
      </div>

      {/* Add Mailbox Form */}
      {showAddForm && currentTenant?.id && (
        <AddMailboxForm
          tenantId={currentTenant.id}
          onCreated={() => {
            setShowAddForm(false);
            load();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Failed to load mailboxes</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <MailboxSkeleton key={n} />
          ))}
        </div>
      )}

      {/* Mailbox grid */}
      {!loading && !error && mailboxes.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Mail className="mx-auto mb-3 w-9 h-9 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No mailboxes configured</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Add a sending mailbox to start dispatching outbound campaigns.
          </p>
          <Button
            size="sm"
            className="bg-[#356AF4] hover:bg-[#2a5cd8] text-white"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add your first mailbox
          </Button>
        </div>
      )}

      {!loading && !error && mailboxes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {mailboxes.map((m) => (
            <MailboxCard
              key={m.id}
              mailbox={m}
              onCheckDns={handleCheckDns}
              checkingDns={checkingDnsId === m.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
