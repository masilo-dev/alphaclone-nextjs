'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, TrendingUp, Users, CheckSquare, DollarSign, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { dealService } from '@/services/dealService';
import { taskService } from '@/services/taskService';
import { forecastingService } from '@/services/forecastingService';
import { RevenueLeakagePanel } from './RevenueLeakagePanel';

export default function SalesConsole() {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    hotLeads: 0,
    openDeals: 0,
    pipelineValue: 0,
    tasksDue: 0,
    weightedForecast: 0,
  });
  const [hotLeads, setHotLeads] = useState<{ id: string; name: string; status: string }[]>([]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    (async () => {
      setLoading(true);
      try {
        const [leadsRes, pipelineRes, tasksRes, forecastRes] = await Promise.all([
          supabase
            .from('leads')
            .select('id, name, business_name, status')
            .eq('tenant_id', currentTenant.id)
            .in('status', ['new', 'contacted'])
            .order('created_at', { ascending: false })
            .limit(5),
          dealService.getPipelineStats(),
          taskService.getTasks({ dueBefore: new Date(Date.now() + 86400000 * 7).toISOString() }),
          forecastingService.getForecastSummary(),
        ]);

        const leads = (leadsRes.data || []).map((l: { id: string; name?: string; business_name?: string; status: string }) => ({
          id: l.id,
          name: l.name || l.business_name || 'Lead',
          status: l.status,
        }));
        setHotLeads(leads);

        const pipeline = pipelineRes.stats || [];
        const openDeals = pipeline.reduce((s, p) => s + (p.dealCount || 0), 0);
        const pipelineValue = pipeline.reduce((s, p) => s + (p.totalValue || 0), 0);
        const forecastSummary = forecastRes?.summary;

        setStats({
          hotLeads: leads.length,
          openDeals,
          pipelineValue,
          tasksDue: tasksRes.tasks?.length || 0,
          weightedForecast: forecastSummary?.totalWeightedPipeline ?? pipelineValue * 0.35,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentTenant?.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  const kpis = [
    { label: 'Hot Leads', value: stats.hotLeads, icon: Users, href: '/dashboard/leads', color: 'text-teal-400' },
    { label: 'Open Deals', value: stats.openDeals, icon: Target, href: '/dashboard/deals', color: 'text-cyan-400' },
    { label: 'Pipeline', value: `$${stats.pipelineValue.toLocaleString()}`, icon: DollarSign, href: '/dashboard/deals', color: 'text-violet-400' },
    { label: 'Tasks Due', value: stats.tasksDue, icon: CheckSquare, href: '/dashboard/tasks', color: 'text-teal-300' },
  ];

  return (
    <div className="p-4 space-y-5 overflow-y-auto pb-24">
      <RevenueLeakagePanel leakageOnly heading="Revenue leaks & next moves" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <button
            key={k.label}
            onClick={() => router.push(k.href)}
            className="bg-slate-900 border border-white/5 rounded-2xl p-4 text-left hover:border-teal-500/30 transition-colors"
          >
            <k.icon className={`w-5 h-5 ${k.color} mb-2`} />
            <div className="text-xl font-bold text-white">{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-400" />
            Weighted Forecast
          </h3>
          <button onClick={() => router.push('/dashboard/forecast')} className="text-xs text-teal-400 font-bold">
            View forecast
          </button>
        </div>
        <div className="text-2xl font-bold text-violet-400">${stats.weightedForecast.toLocaleString()}</div>
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
          <span className="text-sm font-bold text-white">Leads needing action</span>
          <button onClick={() => router.push('/dashboard/leads')} className="text-xs text-teal-400 font-bold flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {hotLeads.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">No new leads — use Find Leads to grow pipeline.</p>
        ) : (
          hotLeads.map((l) => (
            <button
              key={l.id}
              onClick={() => router.push('/dashboard/leads')}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 text-left"
            >
              <span className="text-sm text-white">{l.name}</span>
              <span className="text-xs text-slate-500 capitalize">{l.status}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
