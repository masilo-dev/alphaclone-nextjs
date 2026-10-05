'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarRange, Target } from 'lucide-react';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { forecastingService, type SalesGoal } from '@/services/forecastingService';
import { useCurrency } from '@/hooks/useCurrency';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

export default function AnnualPlanningTab() {
  const { format } = useCurrency();
  const year = new Date().getFullYear();
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { goals: rows } = await forecastingService.getGoals();
    const yearGoals = rows.filter((g) => {
      const start = new Date(g.periodStart).getFullYear();
      const end = new Date(g.periodEnd).getFullYear();
      return start <= year && end >= year;
    });
    setGoals(yearGoals);
    setLoading(false);
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const annualTarget = goals.reduce((s, g) => s + (g.targetValue || 0), 0);
  const annualActual = goals.reduce((s, g) => s + (g.currentValue || 0), 0);
  const pct = annualTarget ? Math.min(100, Math.round((annualActual / annualTarget) * 100)) : 0;

  const byQuarter = QUARTERS.map((q, idx) => {
    const qGoals = goals.filter((g) => {
      const m = new Date(g.periodStart).getMonth();
      return Math.floor(m / 3) === idx;
    });
    const target = qGoals.reduce((s, g) => s + g.targetValue, 0);
    const actual = qGoals.reduce((s, g) => s + g.currentValue, 0);
    return { q, target, actual, count: qGoals.length };
  });

  return (
    <ModulePageLayout
      header={
        <div className="px-1 pb-2">
          <h1 className="text-lg font-semibold text-[var(--ws-text-primary)]">Annual Planning · {year}</h1>
          <p className="type-card-description text-[var(--ws-text-muted)]">Yearly rollup from sales goals and quarterly targets</p>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-xl p-4">
          <p className="type-caption text-[var(--ws-text-muted)] uppercase tracking-wide">Annual target</p>
          <p className="text-xl font-black text-[var(--ws-text-primary)] mt-1">{format(annualTarget)}</p>
        </div>
        <div className="bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-xl p-4">
          <p className="type-caption text-[var(--ws-text-muted)] uppercase tracking-wide">Actual YTD</p>
          <p className="text-xl font-black text-teal-400 mt-1">{format(annualActual)}</p>
        </div>
        <div className="bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-xl p-4">
          <p className="type-caption text-[var(--ws-text-muted)] uppercase tracking-wide">Progress</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{pct}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ac-scroll-full pb-24">
        {byQuarter.map(({ q, target, actual, count }) => (
          <div key={q} className="bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarRange className="w-4 h-4 text-teal-400" />
              <span className="type-ui font-bold text-[var(--ws-text-primary)]">{q} {year}</span>
            </div>
            <p className="type-card-description text-[var(--ws-text-muted)]">{count} goal{count === 1 ? '' : 's'}</p>
            <p className="type-card-description text-[var(--ws-text-secondary)] mt-2">{format(actual)} / {format(target)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--ws-surface-secondary)] overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${target ? Math.min(100, (actual / target) * 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {!loading && goals.length === 0 && (
        <p className="type-card-description text-[var(--ws-text-muted)] px-1">
          No goals for {year}. Add goals in{' '}
          <a href="/dashboard/goals" className="text-teal-400 hover:underline">Goals & Targets</a>.
        </p>
      )}
    </ModulePageLayout>
  );
}
