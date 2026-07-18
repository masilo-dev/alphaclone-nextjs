'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Flame, Shield, Trophy } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import EmptyState from '@/components/ui/EmptyState';

type Payload = { profile: { xp: number; events: number; rank: number; streak: number }; badges: Array<{ id: string; name: string; icon: string; description: string; earned: boolean }>; history: Array<{ id: string; action: string; xp: number; createdAt: string }>; leaderboard: Array<{ userId: string; name: string; xp: number; events: number; rank: number; isMe: boolean }> };

export default function GamificationTab() {
  const { currentTenant } = useTenant();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!currentTenant?.id) return;
    let cancelled = false;
    fetch(`/api/tenant/${currentTenant.id}/gamification`, { cache: 'no-store' }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Achievements could not be loaded'); if (!cancelled) setData(payload); }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Achievements could not be loaded'); });
    return () => { cancelled = true; };
  }, [currentTenant?.id]);
  const level = Math.floor((data?.profile.xp || 0) / 1000) + 1;
  const levelProgress = (data?.profile.xp || 0) % 1000;
  const earned = useMemo(() => data?.badges.filter((badge) => badge.earned).length || 0, [data]);
  if (error) return <div className="m-5 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">{error}</div>;
  if (!data) return <div className="p-8 text-center text-sm text-slate-400">Loading workspace achievements…</div>;
  return <div className="ac-scroll-full space-y-5 p-4 pb-24">
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-300"><Activity className="h-4 w-4" /> Verified workspace activity</div><h1 className="mt-2 text-2xl font-bold text-white">Achievements</h1><p className="mt-1 text-sm text-slate-400">Scores come from persisted activity in this workspace. No sample users or invented events are included.</p></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ label: 'Level', value: level, icon: Shield }, { label: 'Total XP', value: data.profile.xp.toLocaleString(), icon: Trophy }, { label: 'Activity streak', value: `${data.profile.streak} days`, icon: Flame }, { label: 'Workspace rank', value: `#${data.profile.rank}`, icon: Activity }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/10 bg-slate-900 p-4"><Icon className="mb-3 h-5 w-5 text-purple-400"/><div className="text-xl font-bold text-white">{value}</div><div className="text-xs text-slate-500">{label}</div></div>)}</div>
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="mb-2 flex justify-between text-xs text-slate-400"><span>Level {level}</span><span>{levelProgress}/1000 XP</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${levelProgress / 10}%` }} /></div></div>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Badges</h2><span className="text-xs text-slate-500">{earned}/{data.badges.length} earned</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{data.badges.map((badge) => <div key={badge.id} className={`rounded-2xl border p-4 text-center ${badge.earned ? 'border-purple-500/30 bg-purple-500/10' : 'border-white/5 bg-slate-900 opacity-55'}`}><div className={`text-3xl ${badge.earned ? '' : 'grayscale'}`}>{badge.icon}</div><div className="mt-2 text-sm font-semibold text-white">{badge.name}</div><div className="mt-1 text-xs text-slate-500">{badge.description}</div></div>)}</div></section>
    <div className="grid gap-5 lg:grid-cols-2"><section><h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Recent XP</h2><div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">{data.history.length ? data.history.map((item) => <div key={item.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0"><div className="min-w-0 flex-1"><div className="truncate text-sm text-slate-200">{item.action}</div><div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div></div><span className="text-sm font-bold text-emerald-400">+{item.xp}</span></div>) : <EmptyState icon={Activity} title="No scored activity yet" description="Complete real work in this workspace to begin earning XP." />}</div></section>
    <section><h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Workspace leaderboard</h2><div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">{data.leaderboard.map((entry) => <div key={entry.userId} className={`flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0 ${entry.isMe ? 'bg-purple-500/10' : ''}`}><span className="w-7 text-lg font-black text-slate-500">{entry.rank}</span><div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">{entry.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{entry.name}{entry.isMe ? ' (you)' : ''}</div><div className="text-xs text-slate-500">{entry.events} scored activities</div></div><span className="text-sm font-mono text-slate-300">{entry.xp} XP</span></div>)}</div></section></div>
  </div>;
}
