'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Target, Trash2 } from 'lucide-react';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { forecastingService, type SalesGoal } from '@/services/forecastingService';
import { useCurrency } from '@/hooks/useCurrency';
import toast from 'react-hot-toast';

export default function GoalsTab() {
  const { format } = useCurrency();
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('10000');

  const load = useCallback(async () => {
    setLoading(true);
    const { goals: rows, error } = await forecastingService.getGoals({ active: true });
    if (error) toast.error(error);
    setGoals(rows);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats: ModuleStat[] = [
    {
      label: 'Active goals',
      value: String(goals.length),
      Icon: Target,
      accent: 'teal',
    },
    {
      label: 'Avg progress',
      value: goals.length
        ? `${Math.round(goals.reduce((s, g) => s + (g.currentValue / Math.max(g.targetValue, 1)) * 100, 0) / goals.length)}%`
        : '0%',
      Icon: Target,
      accent: 'emerald',
    },
  ];

  const handleCreate = async () => {
    if (!name.trim()) return;
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const { error } = await forecastingService.createGoal({
      name: name.trim(),
      goalType: 'revenue',
      targetValue: Number(target) || 0,
      periodStart: now.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
      isTeamGoal: false,
    });
    if (error) toast.error(error);
    else {
      toast.success('Goal created');
      setName('');
      void load();
    }
  };

  return (
    <ModulePageLayout
      header={
        <div className="px-1 pb-2 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Goals & Targets</h1>
            <p className="text-sm text-slate-400">Revenue and quota tracking by period</p>
          </div>
        </div>
      }
      stats={<ModuleStatCards stats={stats} />}
    >
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 mb-4 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Goal name"
          className="flex-1 min-w-[160px] bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target"
          type="number"
          className="w-32 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        />
        <button
          onClick={() => void handleCreate()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add goal
        </button>
      </div>

      <div className="space-y-3 ac-scroll-full">
        {loading ? (
          <p className="text-sm text-slate-500 p-4">Loading goals…</p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No active goals. Create one above.</p>
        ) : (
          goals.map((g) => {
            const pct = Math.min(100, Math.round((g.currentValue / Math.max(g.targetValue, 1)) * 100));
            return (
              <div key={g.id} className="bg-slate-900 border border-white/5 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{g.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {g.periodStart} → {g.periodEnd} · {g.goalType}
                    </p>
                  </div>
                  <button
                    onClick={() => forecastingService.deleteGoal(g.id).then(load)}
                    className="text-slate-500 hover:text-red-400"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-teal-400 font-bold">{format(g.currentValue)}</span>
                  <span className="text-slate-400">/ {format(g.targetValue)}</span>
                  <span className="text-slate-300 font-semibold">{pct}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </ModulePageLayout>
  );
}
