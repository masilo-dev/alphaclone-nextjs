'use client';

import React from 'react';
import { CheckCircle2, Loader2, PauseCircle, Play, Target, XCircle } from 'lucide-react';
import type { BonnieGoalSummary } from '@/hooks/useBonnieGoals';

function statusTone(status: string) {
  switch (status) {
    case 'awaiting_approval':
      return 'text-amber-700 dark:text-amber-300';
    case 'blocked':
    case 'failed':
      return 'text-rose-700 dark:text-rose-300';
    case 'completed':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'monitoring':
      return 'text-sky-700 dark:text-sky-300';
    default:
      return 'text-teal-700 dark:text-teal-300';
  }
}

type Props = {
  goals: BonnieGoalSummary[];
  loading?: boolean;
  onChase?: () => void;
  onCancel?: (id: string) => void;
  onResume?: (id: string) => void;
  onSelect?: (id: string) => void;
  chasing?: boolean;
};

export default function BonnieGoalsPanel({
  goals,
  loading,
  onChase,
  onCancel,
  onResume,
  onSelect,
  chasing,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Active goals
          </p>
          <p className="text-xs text-slate-500">Persistent work Bonnie is chasing</p>
        </div>
        {onChase && (
          <button
            type="button"
            onClick={onChase}
            disabled={chasing || loading}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-slate-900"
          >
            {chasing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Chase
          </button>
        )}
      </div>

      {loading && goals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-800">
          Loading goals…
        </p>
      ) : goals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-800">
          No open goals yet. Ask Bonnie for an objective like “Recover overdue payments.”
        </p>
      ) : (
        <ul className="space-y-2">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelect?.(goal.id)}
              >
                <div className="flex items-start gap-2">
                  <Target className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${statusTone(goal.status)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {goal.title}
                    </p>
                    <p className={`mt-0.5 text-[11px] capitalize ${statusTone(goal.status)}`}>
                      {goal.status.replace(/_/g, ' ')}
                      {goal.waiting_for ? ` · waiting on ${goal.waiting_for}` : ''}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-teal-600 transition-all"
                        style={{ width: `${Math.max(4, Math.min(100, Number(goal.progress_pct) || 0))}%` }}
                      />
                    </div>
                    {goal.blocker_reason && (
                      <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-500">
                        {goal.blocker_reason}
                      </p>
                    )}
                  </div>
                </div>
              </button>
              <div className="mt-2 flex items-center justify-end gap-1">
                {goal.status === 'blocked' || goal.status === 'awaiting_approval' ? (
                  onResume && (
                    <button
                      type="button"
                      onClick={() => onResume(goal.id)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                    >
                      <Play className="h-3 w-3" /> Resume
                    </button>
                  )
                ) : null}
                {goal.status !== 'cancelled' && goal.status !== 'completed' && onCancel && (
                  <button
                    type="button"
                    onClick={() => onCancel(goal.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <XCircle className="h-3 w-3" /> Cancel
                  </button>
                )}
                {goal.status === 'completed' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </span>
                )}
                {goal.status === 'monitoring' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-sky-600">
                    <PauseCircle className="h-3 w-3" /> Watching
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
