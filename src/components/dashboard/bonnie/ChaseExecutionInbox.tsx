'use client';

/**
 * Universal Chaser execution inbox — approve, snooze, stop, and execute due chases.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  Loader2,
  PauseCircle,
  Play,
  RefreshCw,
  ShieldAlert,
  StopCircle,
  Zap,
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

type ChaseItem = {
  id: string;
  policy_key: string;
  entity_type: string;
  entity_id: string;
  state: string;
  severity: string;
  reason_code: string | null;
  attempt_count: number;
  max_attempts: number;
  next_action_at: string | null;
  approval_required: boolean;
  automation_mode: string;
  context_snapshot: Record<string, unknown>;
  updated_at: string;
};

type ChaseHealth = {
  active_total?: number;
  due_now?: number;
  resolved_24h?: number;
  by_state?: Record<string, number>;
};

const STATE_STYLES: Record<string, string> = {
  WAITING_FOR_APPROVAL: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  READY: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  EXECUTING: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  DETECTED: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  PLANNED: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  ESCALATED: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

function policyLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ChaseExecutionInbox() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [items, setItems] = useState<ChaseItem[]>([]);
  const [health, setHealth] = useState<ChaseHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'approval' | 'due'>('all');

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const [inboxRes, healthRes] = await Promise.all([
        fetch(`/api/dashboard/chase-inbox?tenantId=${encodeURIComponent(currentTenant.id)}&limit=100`),
        fetch(`/api/dashboard/chase-health?tenantId=${encodeURIComponent(currentTenant.id)}`),
      ]);
      const inboxJson = await inboxRes.json();
      const healthJson = await healthRes.json();
      if (!inboxRes.ok) throw new Error(inboxJson.error || 'Failed to load inbox');
      setItems(inboxJson.items || []);
      setHealth(healthRes.ok ? healthJson : null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load chase inbox');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'approval') {
      return items.filter((i) => i.state === 'WAITING_FOR_APPROVAL' || i.approval_required);
    }
    if (filter === 'due') {
      const now = Date.now();
      return items.filter((i) => i.next_action_at && new Date(i.next_action_at).getTime() <= now);
    }
    return items;
  }, [items, filter]);

  const runAction = async (chaseId: string, action: 'approve' | 'snooze' | 'stop' | 'execute') => {
    if (!currentTenant?.id || !user?.id) return;
    setActingId(chaseId);
    try {
      const res = await fetch('/api/dashboard/chase-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          chaseId,
          action,
          userId: user.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');
      toast.success(`Chase ${action}${json.outcome ? `: ${json.outcome}` : ''}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <BellRing className="h-7 w-7 text-teal-400" />
            Chase execution inbox
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Universal Chaser — review, approve, and execute follow-ups from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </header>

      {health && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Active', value: health.active_total ?? items.length, icon: Zap },
            {
              label: 'Awaiting approval',
              value: health.by_state?.WAITING_FOR_APPROVAL ?? 0,
              icon: ShieldAlert,
            },
            { label: 'Due now', value: health.due_now ?? 0, icon: Clock },
            { label: 'Resolved (24h)', value: health.resolved_24h ?? 0, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-slate-900/60 p-4"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['all', 'approval', 'due'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest transition',
              filter === key
                ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/40'
                : 'bg-white/5 text-slate-400 hover:text-white',
            )}
          >
            {key === 'all' ? 'All active' : key === 'approval' ? 'Needs approval' : 'Due now'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading chases…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center text-slate-500">
          No active chases in this view.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const ctx = item.context_snapshot || {};
            const title =
              String(ctx.title || ctx.quote_number || ctx.invoice_number || ctx.name || item.entity_id);
            const busy = actingId === item.id;

            return (
              <li
                key={item.id}
                className="rounded-xl border border-white/10 bg-slate-900/50 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-teal-400">
                        {policyLabel(item.policy_key)}
                      </span>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                          STATE_STYLES[item.state] || STATE_STYLES.DETECTED,
                        )}
                      >
                        {item.state.replace(/_/g, ' ')}
                      </span>
                      {item.severity === 'high' && (
                        <span className="text-[10px] font-bold uppercase text-rose-400">High</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-base font-semibold text-white">{title}</p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      {item.reason_code?.replace(/_/g, ' ') || 'Follow-up required'} · attempt{' '}
                      {item.attempt_count}/{item.max_attempts}
                      {item.next_action_at && (
                        <> · next {new Date(item.next_action_at).toLocaleString()}</>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(item.state === 'WAITING_FOR_APPROVAL' || item.approval_required) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(item.id, 'approve')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(item.id, 'execute')}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5 disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Execute
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(item.id, 'snooze')}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50"
                    >
                      <PauseCircle className="h-3.5 w-3.5" />
                      Snooze
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(item.id, 'stop')}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                    >
                      <StopCircle className="h-3.5 w-3.5" />
                      Stop
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ChaseExecutionInbox;
