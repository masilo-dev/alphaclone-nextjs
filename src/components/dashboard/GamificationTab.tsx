'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Shield, Trophy } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import EmptyState from '@/components/ui/EmptyState';

type Payload = {
  profile: { xp: number; events: number };
  badges: Array<{ id: string; name: string; icon: string; description: string; earned: boolean }>;
  history: Array<{ id: string; action: string; xp: number; createdAt: string }>;
};

export default function GamificationTab() {
  const { currentTenant } = useTenant();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenant?.id) return;
    let cancelled = false;
    fetch(`/api/tenant/${currentTenant.id}/gamification`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Achievements could not be loaded');
        if (!cancelled) setData(payload);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Achievements could not be loaded');
      });
    return () => {
      cancelled = true;
    };
  }, [currentTenant?.id]);

  const earned = useMemo(() => data?.badges.filter((badge) => badge.earned).length || 0, [data]);
  const meaningfulHistory = useMemo(
    () => (data?.history || []).filter((item) => item.xp > 0).slice(0, 12),
    [data]
  );

  if (error) {
    return <div className="m-5 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">{error}</div>;
  }
  if (!data) {
    return <div className="p-8 text-center text-sm text-slate-400">Loading workspace achievements…</div>;
  }

  return (
    <div className="ac-scroll-full space-y-5 p-4 pb-24">
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-300">
          <Activity className="h-4 w-4" />
          Business outcomes
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">Achievements</h1>
        <p className="mt-1 text-sm text-slate-400">
          Only measurable business results count here: deals won, invoices paid, leads converted, and automation completed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Verified XP', value: data.profile.xp.toLocaleString(), icon: Trophy },
          { label: 'Scored activities', value: data.profile.events.toLocaleString(), icon: Activity },
          { label: 'Badges earned', value: `${earned}/${data.badges.length}`, icon: Shield },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <Icon className="mb-3 h-5 w-5 text-purple-400" />
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Badges</h2>
          <span className="text-xs text-slate-500">{earned}/{data.badges.length} earned</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {data.badges.map((badge) => (
            <div
              key={badge.id}
              className={`rounded-2xl border p-4 text-center ${badge.earned ? 'border-purple-500/30 bg-purple-500/10' : 'border-white/5 bg-slate-900 opacity-55'}`}
            >
              <div className={`text-3xl ${badge.earned ? '' : 'grayscale'}`}>{badge.icon}</div>
              <div className="mt-2 text-sm font-semibold text-white">{badge.name}</div>
              <div className="mt-1 text-xs text-slate-500">{badge.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Recent scored activity</h2>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          {meaningfulHistory.length ? (
            meaningfulHistory.map((item) => (
              <div key={item.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-200">{item.action}</div>
                  <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
                <span className="text-sm font-bold text-emerald-400">+{item.xp}</span>
              </div>
            ))
          ) : (
            <EmptyState
              icon={Activity}
              title="No scored outcomes yet"
              description="Convert a lead, send an invoice, or complete automation to start earning verified XP."
            />
          )}
        </div>
      </section>
    </div>
  );
}
