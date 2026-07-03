'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analyticsService, type AnalyticsData } from '@/services/analyticsService';
import { Loader2, DollarSign, Users, Target, TrendingUp, ChevronRight } from 'lucide-react';
import { MetricCard } from './MetricCard';

const GOAL_KEY = 'executive-kpi-goals';

export default function ExecutiveDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState({ revenue: 50000, clients: 100, deals: 25 });

  useEffect(() => {
    try {
      const g = localStorage.getItem(GOAL_KEY);
      if (g) setGoals(JSON.parse(g));
    } catch { /* ignore */ }
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
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-slate-800 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-slate-800 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Revenue vs Goal',
      value: `$${stats.revenue.total.toLocaleString()}`,
      delta: `${Math.round((stats.revenue.total / goals.revenue) * 100)}%`,
      deltaDir: stats.revenue.total >= goals.revenue ? 'up' : 'down' as any,
      comparisonText: `Goal: $${goals.revenue.toLocaleString()}`,
      icon: DollarSign,
      href: '/dashboard/finance',
      color: 'bg-violet-600'
    },
    {
      label: 'Client Target',
      value: stats.users.clients,
      delta: `${Math.round((stats.users.clients / goals.clients) * 100)}%`,
      deltaDir: stats.users.clients >= goals.clients ? 'up' : 'down' as any,
      comparisonText: `Target: ${goals.clients}`,
      icon: Users,
      href: '/dashboard/crm',
      color: 'bg-blue-600'
    },
    {
      label: 'Active Projects',
      value: stats.projects.active,
      delta: `${Math.round((stats.projects.active / goals.deals) * 100)}%`,
      deltaDir: stats.projects.active >= goals.deals ? 'up' : 'down' as any,
      comparisonText: `Quota: ${goals.deals}`,
      icon: Target,
      href: '/dashboard/projects',
      color: 'bg-emerald-600'
    },
    {
      label: 'Revenue Trend',
      value: `${stats.revenue.trend >= 0 ? '+' : ''}${stats.revenue.trend.toFixed(1)}%`,
      delta: stats.revenue.trend >= 0 ? '+12%' : '-5%',
      deltaDir: stats.revenue.trend >= 0 ? 'up' : 'down' as any,
      comparisonText: 'vs Last Month',
      icon: TrendingUp,
      href: '/dashboard/finance',
      color: 'bg-amber-600'
    }
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 ac-enterprise-module">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-white">Executive Oversight</h1>
          <p className="text-sm text-slate-400 mt-0.5">High-level strategic performance indicators.</p>
        </div>
        <button 
          onClick={load} 
          className="text-xs text-teal-400 font-bold bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20 hover:bg-teal-500/20 transition-all"
        >
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="relative group">
            <MetricCard
              label={kpi.label}
              value={kpi.value}
              delta={kpi.delta}
              deltaDir={kpi.deltaDir}
              comparisonText={kpi.comparisonText}
              className="cursor-pointer"
            />
            <button 
              onClick={() => router.push(kpi.href)}
              className="absolute top-3 right-3 p-1 rounded-md bg-slate-800 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Performance Goals Configuration</h3>
          <div className="space-y-4">
            {(['revenue', 'clients', 'deals'] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Target {key}</span>
                  <span className="text-white font-black">{goals[key].toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min={key === 'revenue' ? 1000 : 1}
                  max={key === 'revenue' ? 200000 : 500}
                  step={key === 'revenue' ? 1000 : 1}
                  value={goals[key]}
                  onChange={(e) => saveGoals({ ...goals, [key]: Number(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Success Rate</h3>
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
             <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                   <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                   <circle 
                    cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                    strokeDasharray={364}
                    strokeDashoffset={364 - (364 * stats.performance.onTimeDelivery) / 100}
                    className="text-teal-500" 
                   />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-2xl font-black text-white">{stats.performance.onTimeDelivery}%</span>
                   <span className="text-[9px] text-slate-500 font-bold uppercase">On-Time</span>
                </div>
             </div>
             <p className="text-[11px] text-slate-400 text-center leading-relaxed">
               System efficiency based on project milestones and automated checkpoints.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
