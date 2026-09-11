'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { CRMNav } from './CRMNav';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

type FollowUpItem = {
  id: string;
  entityType: string;
  title: string;
  subtitle?: string;
  reason: string;
  dueAt?: string | null;
  priority: 'low' | 'medium' | 'high';
  href: string;
};

export default function FollowUpQueue() {
  const { currentTenant } = useTenant();
  const pathname = usePathname();
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, high: 0, medium: 0 });
  const [scheduleItem, setScheduleItem] = useState<FollowUpItem | null>(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/follow-ups?tenantId=${encodeURIComponent(currentTenant.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items || []);
      setCounts(data.counts || { total: 0, high: 0, medium: 0 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSchedule = (item: FollowUpItem) => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setHours(9, 0, 0, 0);
    const local = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setFollowUpDate(local);
    setScheduleItem(item);
  };

  const submitSchedule = async () => {
    if (!currentTenant?.id || !scheduleItem || !followUpDate) return;
    setScheduling(true);
    try {
      const res = await fetch('/api/crm/follow-ups/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId: currentTenant.id,
          entityType: scheduleItem.entityType,
          entityId: scheduleItem.id,
          followUpAt: new Date(followUpDate).toISOString(),
          note: scheduleItem.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Follow-up scheduled');
      setScheduleItem(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-4">
      <CRMNav pathname={pathname || '/dashboard/crm/follow-ups'} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-400" />
            Follow-up queue
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Due follow-ups and stale pipeline records across deals, leads, contacts, and accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-white">{counts.total}</p>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-red-300 uppercase tracking-wide">High priority</p>
          <p className="text-2xl font-bold text-white">{counts.high}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs text-amber-300 uppercase tracking-wide">Stale pipeline</p>
          <p className="text-2xl font-bold text-white">{counts.medium}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading follow-ups…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-10 text-center text-slate-400">
          No follow-ups due right now. Your pipeline is up to date.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${item.entityType}-${item.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3"
            >
              <Link href={item.href} className="min-w-0 flex-1 hover:opacity-90">
                <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                <p className="text-xs text-slate-400">
                  {item.reason}
                  {item.subtitle ? ` · ${item.subtitle}` : ''}
                </p>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openSchedule(item)}
                  className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-teal-500/20 text-teal-300"
                >
                  Schedule
                </button>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                    item.priority === 'high'
                      ? 'bg-red-500/20 text-red-300'
                      : item.priority === 'medium'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {item.entityType}
                </span>
                <Link href={item.href}>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {scheduleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-4">
            <h2 className="text-lg font-bold text-white">Schedule follow-up</h2>
            <p className="text-sm text-slate-400 truncate">{scheduleItem.title}</p>
            <input
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduleItem(null)}
                className="px-3 py-2 rounded-xl border border-white/10 text-slate-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!followUpDate || scheduling}
                onClick={() => void submitSchedule()}
                className="px-3 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {scheduling ? 'Saving…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
