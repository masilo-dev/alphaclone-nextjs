'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock,
  DollarSign,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import type { PlatformAdvantageSnapshot } from '@/lib/platform-advantage/fetchPlatformAdvantageSnapshot';
import { buildBonnieDeepLink } from '@/lib/bonnie/bonnieDeepLink';

type QueueItem = {
  priority?: string;
  lane?: string;
  title?: string;
  reason?: string;
  approval_required?: boolean;
  recommended_tool?: string;
  href?: string;
};

type RecoveryItem = {
  id?: string;
  type?: string;
  title?: string;
  amount?: number;
  reason?: string;
  recommended_action?: string;
  approval_required?: boolean;
};

type PulseClient = {
  id?: string;
  name?: string;
  reason?: string;
  priority?: string;
  href?: string;
};

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['queue', 'actions', 'items', 'clients', 'opportunities', 'recommendations']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

function priorityClass(priority?: string): string {
  switch ((priority || '').toLowerCase()) {
    case 'critical':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    case 'high':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'medium':
      return 'border-teal-500/30 bg-teal-500/10 text-teal-200';
    default:
      return 'border-slate-700 bg-slate-900/60 text-slate-300';
  }
}

export function PlatformAdvantageHome() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const [snapshot, setSnapshot] = useState<PlatformAdvantageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform-advantage/snapshot?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load intelligence');
      setSnapshot(data.snapshot as PlatformAdvantageSnapshot);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load intelligence');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenantId) return null;

  if (loading) {
    return (
      <div className="ac-workspace-panel flex min-h-[180px] items-center justify-center gap-2 p-6 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
        Loading owner intelligence…
      </div>
    );
  }

  if (error) {
    return (
      <div className="ac-workspace-panel border border-rose-500/20 p-5">
        <p className="text-sm font-semibold text-rose-200">Intelligence unavailable</p>
        <p className="mt-1 text-xs text-slate-400">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-teal-500/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const queue = asArray<QueueItem>(snapshot?.autopilot).slice(0, 5);
  const recovery = asArray<RecoveryItem>(snapshot?.revenueRecovery).slice(0, 4);
  const pulse = asArray<PulseClient>(snapshot?.clientPulse).slice(0, 4);
  const timeSaved = snapshot?.timeSavings as Record<string, unknown> | null;
  const readiness = snapshot?.readiness as Record<string, unknown> | null;

  const hoursSaved = Number(timeSaved?.estimated_hours_saved ?? timeSaved?.hours_saved ?? 0);
  const readinessScore = Number(readiness?.score ?? readiness?.readiness_score ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-teal-400/80">Owner intelligence</p>
          <h2 className="text-lg font-black text-white">What needs your attention</h2>
          <p className="text-xs text-slate-500">Ranked by cash impact, client risk, and time saved — every card opens the exact workspace action.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/bonnie/approvals"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/15"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Approvals
          </Link>
          <Link
            href={buildBonnieDeepLink({ route: '/dashboard/bonnie', focus: 'autopilot', reason: 'Continue owner queue from home' })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-bold text-teal-100 hover:bg-teal-500/15"
          >
            <Bot className="h-3.5 w-3.5" />
            Ask Bonnie
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="ac-workspace-panel p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-400" />
            <h3 className="text-sm font-black text-white">Owner autopilot queue</h3>
          </div>
          {queue.length === 0 ? (
            <p className="text-xs text-slate-500">No urgent actions right now. Bonnie will surface new priorities as your workspace changes.</p>
          ) : (
            <ul className="space-y-2">
              {queue.map((item, idx) => (
                <li key={`${item.title}-${idx}`} className={`rounded-xl border px-3 py-2.5 ${priorityClass(item.priority)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{item.title || 'Recommended action'}</p>
                      <p className="mt-0.5 text-xs opacity-80">{item.reason}</p>
                      {item.approval_required ? (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">Approval required before send</p>
                      ) : null}
                    </div>
                    <Link
                      href={item.href || buildBonnieDeepLink({
                        route: item.lane === 'cash' ? '/dashboard/business/billing' : '/dashboard/crm',
                        focus: item.recommended_tool || 'action',
                        reason: item.reason,
                      })}
                      className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 hover:text-teal-200"
                    >
                      Open
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ac-workspace-panel p-4 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Time saved (30d)</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">{hoursSaved > 0 ? `${hoursSaved.toFixed(1)}h` : '—'}</p>
            <p className="text-[11px] text-slate-500">Estimated from automated workflows and MCP activity.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Automation readiness</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">{readinessScore > 0 ? `${Math.round(readinessScore)}%` : '—'}</p>
            <p className="text-[11px] text-slate-500">
              {typeof readiness?.summary === 'string'
                ? readiness.summary
                : 'Connect integrations and clear approvals to unlock more autonomous execution.'}
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="ac-workspace-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-black text-white">Revenue recovery</h3>
          </div>
          {recovery.length === 0 ? (
            <p className="text-xs text-slate-500">No overdue invoices or stale quotes detected in the current window.</p>
          ) : (
            <ul className="space-y-2">
              {recovery.map((item, idx) => (
                <li key={`${item.id || item.title}-${idx}`} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                  <p className="text-sm font-bold text-emerald-100">{item.title || item.type || 'Recovery opportunity'}</p>
                  <p className="text-xs text-slate-400">{item.reason || item.recommended_action}</p>
                  {typeof item.amount === 'number' && item.amount > 0 ? (
                    <p className="mt-1 text-xs font-bold text-emerald-300">${item.amount.toLocaleString()}</p>
                  ) : null}
                  <Link
                    href={buildBonnieDeepLink({
                      route: '/dashboard/business/campaigns',
                      focus: 'recovery',
                      recordId: item.id,
                      reason: item.reason,
                    }) + '&source=recovery'}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200"
                  >
                    Create recovery campaign
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    href={buildBonnieDeepLink({
                      route: '/dashboard/business/billing',
                      focus: 'overdue',
                      recordId: item.id,
                      reason: item.reason,
                    })}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200"
                  >
                    Review in billing
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ac-workspace-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-black text-white">Client pulse</h3>
          </div>
          {pulse.length === 0 ? (
            <p className="text-xs text-slate-500">No clients flagged for attention right now.</p>
          ) : (
            <ul className="space-y-2">
              {pulse.map((client, idx) => (
                <li key={`${client.id || client.name}-${idx}`} className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
                  <p className="text-sm font-bold text-indigo-100">{client.name || 'Client'}</p>
                  <p className="text-xs text-slate-400">{client.reason}</p>
                  <Link
                    href={client.href || buildBonnieDeepLink({
                      route: '/dashboard/crm',
                      recordId: client.id,
                      focus: 'follow-up',
                      reason: client.reason,
                    })}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 hover:text-indigo-200"
                  >
                    Open in CRM
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(snapshot?.errors?.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-3.5 w-3.5" />
            Partial intelligence load
          </div>
          <p className="mt-1 text-amber-100/80">{snapshot?.errors?.slice(0, 2).join(' · ')}</p>
        </div>
      ) : null}
    </div>
  );
}

export function ClientPulsePanel({ compact = false }: { compact?: boolean }) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const [clients, setClients] = useState<PulseClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    void fetch(`/api/platform-advantage/snapshot?tenantId=${encodeURIComponent(tenantId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setClients(asArray<PulseClient>(data.snapshot?.clientPulse).slice(0, compact ? 3 : 6));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenantId, compact]);

  if (loading) {
    return <div className="text-xs text-slate-500">Loading client pulse…</div>;
  }

  if (!clients.length) {
    return <div className="text-xs text-slate-500">No clients need attention right now.</div>;
  }

  return (
    <ul className="space-y-2">
      {clients.map((client, idx) => (
        <li key={`${client.id || client.name}-${idx}`} className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
          <p className="text-xs font-bold text-indigo-100">{client.name || 'Client'}</p>
          <p className="text-[11px] text-slate-400">{client.reason}</p>
        </li>
      ))}
    </ul>
  );
}
