'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analyticsService, type AnalyticsData } from '@/services/analyticsService';
import { Loader2, GripVertical, Target, DollarSign, Users, TrendingUp } from 'lucide-react';

type WidgetId = 'revenue' | 'clients' | 'projects' | 'forecast';

const DEFAULT_WIDGETS: WidgetId[] = ['revenue', 'clients', 'projects', 'forecast'];

const GOAL_KEY = 'executive-kpi-goals';

export default function ExecutiveDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [widgets, setWidgets] = useState<WidgetId[]>(DEFAULT_WIDGETS);
  const [goals, setGoals] = useState({ revenue: 50000, clients: 100, deals: 25 });

  useEffect(() => {
    try {
      const w = localStorage.getItem('executive-widgets');
      if (w) setWidgets(JSON.parse(w));
      const g = localStorage.getItem(GOAL_KEY);
      if (g) setGoals(JSON.parse(g));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await analyticsService.getAnalytics('30d');
    setStats(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveGoals = (next: typeof goals) => {
    setGoals(next);
    localStorage.setItem(GOAL_KEY, JSON.stringify(next));
  };

  if (loading || !stats) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  const widgetConfig: Record<WidgetId, { title: string; value: string; goal: number; current: number; icon: typeof DollarSign; href: string; color: string }> = {
    revenue: {
      title: 'Revenue',
      value: `$${stats.revenue.total.toLocaleString()}`,
      goal: goals.revenue,
      current: stats.revenue.total,
      icon: DollarSign,
      href: '/dashboard/business/reports',
      color: 'text-teal-400',
    },
    clients: {
      title: 'Clients',
      value: String(stats.users.clients),
      goal: goals.clients,
      current: stats.users.clients,
      icon: Users,
      href: '/dashboard/contacts',
      color: 'text-cyan-400',
    },
    projects: {
      title: 'Active Projects',
      value: String(stats.projects.active),
      goal: goals.deals,
      current: stats.projects.active,
      icon: Target,
      href: '/dashboard/business/projects',
      color: 'text-violet-400',
    },
    forecast: {
      title: 'Revenue Trend',
      value: `${stats.revenue.trend >= 0 ? '+' : ''}${stats.revenue.trend.toFixed(1)}%`,
      goal: 100,
      current: Math.min(100, Math.max(0, 50 + stats.revenue.trend)),
      icon: TrendingUp,
      href: '/dashboard/performance',
      color: 'text-teal-300',
    },
  };

  return (
    <div className="p-4 space-y-5 overflow-y-auto pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">Executive Dashboard</h2>
        <button onClick={load} className="text-xs text-teal-400 font-bold">Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {widgets.map((id) => {
          const w = widgetConfig[id];
          const pct = w.goal ? Math.min(100, Math.round((w.current / w.goal) * 100)) : 0;
          return (
            <button
              key={id}
              onClick={() => router.push(w.href)}
              className="bg-slate-900 border border-white/5 rounded-2xl p-4 text-left hover:border-teal-500/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <w.icon className={`w-5 h-5 ${w.color}`} />
                <GripVertical className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl font-bold text-white">{w.value}</div>
              <div className="text-xs text-slate-500 mb-2">{w.title}</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-teal-500 h-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{pct}% of goal</div>
            </button>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">KPI Goals</h3>
        {(['revenue', 'clients', 'deals'] as const).map((key) => (
          <label key={key} className="flex items-center gap-3 text-sm">
            <span className="text-slate-400 w-20 capitalize">{key}</span>
            <input
              type="number"
              value={goals[key]}
              onChange={(e) => saveGoals({ ...goals, [key]: Number(e.target.value) })}
              className="flex-1 h-9 px-3 rounded-lg bg-slate-950 border border-white/5 text-white"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
