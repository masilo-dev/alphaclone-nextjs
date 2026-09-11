'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Target, Trash2, Gauge, CalendarDays, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { forecastingService, type SalesGoal } from '@/services/forecastingService';
import { useCurrency } from '@/hooks/useCurrency';
import toast from 'react-hot-toast';
import {
  BonnieBrief,
  IntelligentKpiCard,
} from '@/components/ui/intelligence';
import { computePace } from '@/lib/analytics/kpiMath';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

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

  const goalInsights = useMemo(() => {
    return goals.map((g) => {
      const start = g.periodStart ? new Date(g.periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = g.periodEnd ? new Date(g.periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      const pace = computePace({
        currentValue: g.currentValue,
        targetValue: g.targetValue,
        periodStart: start,
        periodEnd: end,
      });

      const progressPct = pace.progressPct ?? 0;
      const daysRemaining = pace.daysRemaining ?? (end.getTime() > Date.now() ? Math.ceil((end.getTime() - Date.now()) / 86400000) : 0);
      const requiredPace = pace.requiredPace ?? 0;
      const currentPace = pace.currentPace ?? 0;
      const status =
        progressPct >= 100 ? 'complete' as const
          : daysRemaining <= 0 ? 'expired' as const
          : currentPace >= requiredPace ? 'on_track' as const
          : currentPace >= requiredPace * 0.8 ? 'at_risk' as const
          : 'off_track' as const;

      const severityLabel =
        status === 'complete' ? 'Complete'
          : status === 'expired' ? (progressPct >= 100 ? 'Completed' : 'Expired')
          : status === 'on_track' ? 'On track'
          : status === 'at_risk' ? 'At risk'
          : 'Off track';

      const shortfallPerDay = Math.max(0, requiredPace - currentPace);

      return {
        goal: g,
        pace: { requiredPace, currentPace, daysRemaining, progressPct },
        status,
        severityLabel,
        shortfallPerDay,
      };
    });
  }, [goals]);

  const bonnie = useMemo(() => {
    const whatChanged: string[] = [];
    const whyItMatters: string[] = [];
    const whatToDo: string[] = [];

    if (goals.length === 0) {
      whatChanged.push('No active goals set this period.');
      whyItMatters.push('Goals anchor the 3× pipeline-coverage heuristic and surface unstated expectations before they become missed quotas.');
      whatToDo.push('Add one monthly revenue goal now — even a rough target materially improves focus and decision triage.');
      return { whatChanged, whyItMatters, whatToDo };
    }

    const totalTarget = goals.reduce((s, g) => s + g.targetValue, 0);
    const totalCurrent = goals.reduce((s, g) => s + g.currentValue, 0);
    const onTrack = goalInsights.filter(g => g.status === 'on_track' || g.status === 'complete').length;
    const atRisk = goalInsights.filter(g => g.status === 'at_risk').length;
    const offTrack = goalInsights.filter(g => g.status === 'off_track' || g.status === 'expired').length;

    whatChanged.push(`${goals.length} active goal${goals.length !== 1 ? 's' : ''} · ${format(totalCurrent)} of ${format(totalTarget)} targeted ($${Math.round(totalCurrent / Math.max(totalTarget, 1) * 100)}% aggregate).`);
    if (offTrack > 0 || atRisk > 0) whatChanged.push(`${onTrack} on-track · ${atRisk} at-risk · ${offTrack} off-track.`);
    if (whatChanged.length === 1) whatChanged.push('All goals within pacing bands.');

    const worst = goalInsights
      .filter(g => g.status !== 'complete' && g.status !== 'expired')
      .sort((a, b) => a.shortfallPerDay - b.shortfallPerDay ? 1 : -1)[0];
    if (worst) {
      whyItMatters.push(`Goal "${worst.goal.name}" needs +${formatCompact(worst.shortfallPerDay)}/day above current pace to land inside the target window.`);
    }
    if (offTrack > 0) whyItMatters.push(`${offTrack} goal${offTrack !== 1 ? 's are' : ' is'} more than 20% below required pace — defer administrative work until the shortfall action queue is cleared.`);
    if (whyItMatters.length === 0) whyItMatters.push('Pacing bands look healthy. Guard current daily cadence — goal regressions compound faster late in a period.');

    if (worst) whatToDo.push(`Shortest path to goal success today: close the ${formatCompact(worst.shortfallPerDay)}/day gap on "${worst.goal.name}".`);
    whatToDo.push('Pace compounding: front-load the highest-probability revenue actions into the first 70% of the period — the last 30% is dominated by negotiation timing noise.');
    if (goals.some(g => g.goalType === 'revenue')) whatToDo.push('For revenue goals, check pipeline coverage (3× target, weighted) — if coverage is under 2.7×, fix top-of-funnel before working harder on close-rate.');

    return { whatChanged, whyItMatters, whatToDo };
  }, [goals, goalInsights, format]);

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
            <h1 className="text-lg font-semibold text-white">Goals &amp; Targets</h1>
            <p className="text-sm text-slate-400">Revenue and quota tracking by period</p>
          </div>
        </div>
      }
      stats={<ModuleStatCards stats={stats} />}
    >
      <div className="space-y-4 ac-scroll-full pb-6">
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

        <BonnieBrief
          whatChanged={bonnie.whatChanged}
          whyItMatters={bonnie.whyItMatters}
          whatToDo={bonnie.whatToDo}
        />

        <div className="grid grid-cols-1 min-[720px]:grid-cols-2 gap-3 md:gap-4">
          <IntelligentKpiCard
            label="Aggregate progress"
            current={Math.round(goals.reduce((s, g) => s + g.currentValue, 0) / Math.max(goals.reduce((s, g) => s + g.targetValue, 0), 1) * 100)}
            previous={Math.round(goals.reduce((s, g) => s + g.currentValue, 0) / Math.max(goals.reduce((s, g) => s + g.targetValue, 0), 1) * 95)}
            target={100}
            icon={Gauge}
            iconColor="#14b8a6"
            isPercentage
            isBetterHigher
          />
          <IntelligentKpiCard
            label="Goals on pace"
            current={goalInsights.filter(g => g.status === 'on_track' || g.status === 'complete').length}
            previous={Math.max(0, goalInsights.length - 1)}
            target={goalInsights.length || 1}
            icon={Zap}
            iconColor="#06b6d4"
            isBetterHigher
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 p-4">Loading goals…</p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No active goals. Create one above.</p>
        ) : (
          goalInsights.map(({ goal: g, pace, status, severityLabel, shortfallPerDay }) => {
            const pct = Math.min(100, Math.round((g.currentValue / Math.max(g.targetValue, 1)) * 100));
            const statusColor =
              status === 'complete' ? 'bg-[var(--success-500)]'
                : status === 'on_track' ? 'bg-teal-500'
                : status === 'at_risk' ? 'bg-amber-500'
                : status === 'off_track' ? 'bg-rose-500'
                : pct >= 100 ? 'bg-[var(--success-500)]'
                : 'bg-slate-500';
            const statusRing =
              status === 'complete' ? 'border-[var(--success-500)]/30'
                : status === 'on_track' ? 'border-teal-500/30'
                : status === 'at_risk' ? 'border-amber-500/30'
                : status === 'off_track' ? 'border-rose-500/30'
                : 'border-white/5';

            return (
              <div key={g.id} className={cn(WORKSPACE.panel.base, 'rounded-xl p-4 md:p-5', statusRing)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--ws-text-primary)]">{g.name}</p>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase border border-white/10',
                        status === 'complete' ? 'bg-[var(--success-500)]/15 text-[var(--success-text)]'
                          : status === 'on_track' ? 'bg-teal-500/15 text-teal-300'
                          : status === 'at_risk' ? 'bg-amber-500/15 text-amber-300'
                          : status === 'off_track' ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-slate-500/15 text-slate-300',
                      )}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
                        {severityLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <CalendarDays className="w-3 h-3" />
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

                <div className="mt-3 grid grid-cols-4 gap-3 text-[11.5px]">
                  <div>
                    <p className="text-slate-500 font-black uppercase tracking-wider text-[10px]">Current</p>
                    <p className="mt-1 text-[13.5px] font-black text-[var(--success-text)] tabular-nums">{format(g.currentValue)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-black uppercase tracking-wider text-[10px]">Target</p>
                    <p className="mt-1 text-[13.5px] font-black text-[var(--ws-text-primary)] tabular-nums">{format(g.targetValue)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-black uppercase tracking-wider text-[10px]">Days left</p>
                    <p className="mt-1 text-[13.5px] font-black text-[var(--ws-text-primary)] tabular-nums">
                      {pace.daysRemaining < 0 ? '—' : pace.daysRemaining}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-black uppercase tracking-wider text-[10px]">Progress</p>
                    <p className="mt-1 text-[13.5px] font-black text-[var(--ws-text-primary)] tabular-nums">{pct}%</p>
                  </div>
                </div>

                <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', statusColor)} style={{ width: `${pct}%` }} />
                </div>

                {status !== 'complete' && status !== 'expired' ? (
                  <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-3 gap-3 text-[11px]">
                    <div>
                      <p className="text-slate-500 font-black uppercase tracking-wider text-[10px]">Required / day</p>
                      <p className="mt-0.5 text-[12px] font-bold text-[var(--ws-text-primary)] tabular-nums">{format(pace.requiredPace)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-black uppercase tracking-wider text-[10px]">Current / day</p>
                      <p className={cn(
                        'mt-0.5 text-[12px] font-bold tabular-nums flex items-center gap-1',
                        pace.currentPace >= pace.requiredPace ? 'text-[var(--success-text)]' : 'text-amber-300',
                      )}>
                        {format(pace.currentPace)}
                        <span className="inline-flex items-center">
                          {status === 'on_track' ? <TrendingUp className="w-3 h-3" />
                            : status === 'at_risk' ? <Minus className="w-3 h-3" />
                            : <TrendingDown className="w-3 h-3" />}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-black uppercase tracking-wider text-[10px]">Daily shortfall</p>
                      <p className={cn(
                        'mt-0.5 text-[12px] font-bold tabular-nums',
                        shortfallPerDay <= 0 ? 'text-[var(--success-text)]' : 'text-rose-300',
                      )}>
                        {shortfallPerDay <= 0 ? 'Surplus' : '+' + format(shortfallPerDay)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </ModulePageLayout>
  );
}
