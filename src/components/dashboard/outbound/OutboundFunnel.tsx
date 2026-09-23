'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, AlertTriangle } from 'lucide-react';

export interface FunnelStageDatum {
  stage: string;
  count: number;
}

interface OutboundFunnelProps {
  data: FunnelStageDatum[];
  className?: string;
}

const STAGE_ORDER = [
  'Discovered',
  'Qualified',
  'Verified',
  'Contacted',
  'Replied',
  'Interested',
  'Meeting',
  'Customer',
];

const STAGE_COLORS: Record<string, string> = {
  Discovered: '#356AF4',
  Qualified: '#3B7FF5',
  Verified: '#4194F6',
  Contacted: '#48A8F7',
  Replied: '#22c55e',
  Interested: '#16a34a',
  Meeting: '#15803d',
  Customer: '#166534',
};

const STAGE_BG: Record<string, string> = {
  Discovered: 'bg-blue-500/10',
  Qualified: 'bg-blue-400/10',
  Verified: 'bg-sky-500/10',
  Contacted: 'bg-sky-400/10',
  Replied: 'bg-emerald-500/10',
  Interested: 'bg-emerald-400/10',
  Meeting: 'bg-green-500/10',
  Customer: 'bg-green-600/10',
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function OutboundFunnel({ data, className }: OutboundFunnelProps) {
  // Normalize: sort by STAGE_ORDER, fill missing stages with 0
  const stages = useMemo<FunnelStageDatum[]>(() => {
    const byName = new Map<string, number>(data.map((d) => [d.stage, d.count]));
    return STAGE_ORDER.map((stage) => ({ stage, count: byName.get(stage) ?? 0 }));
  }, [data]);

  const maxCount = useMemo(() => Math.max(...stages.map((s) => s.count), 1), [stages]);

  // Compute conversions and find biggest absolute drop
  const enriched = useMemo(() => {
    return stages.map((s, i) => {
      const prev = i > 0 ? stages[i - 1].count : null;
      const convPct = prev != null && prev > 0 ? (s.count / prev) * 100 : null;
      const dropAbs = prev != null ? prev - s.count : null;
      return { ...s, convPct, dropAbs };
    });
  }, [stages]);

  const maxDropIdx = useMemo(() => {
    let maxDrop = -1;
    let maxIdx = -1;
    enriched.forEach((s, i) => {
      if (i === 0) return;
      const drop = s.dropAbs ?? 0;
      if (drop > maxDrop) {
        maxDrop = drop;
        maxIdx = i;
      }
    });
    // Only highlight if there is a meaningful drop
    const firstCount = enriched[0]?.count ?? 0;
    return maxDrop > 0 && firstCount > 0 ? maxIdx : -1;
  }, [enriched]);

  if (stages.every((s) => s.count === 0)) {
    return (
      <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center', className)}>
        <TrendingUp className="mx-auto mb-3 w-8 h-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No funnel data yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Funnel data will appear once leads are discovered and processed.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Pipeline Funnel</h3>
        {maxDropIdx !== -1 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" />
            Biggest drop: {enriched[maxDropIdx].stage}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {enriched.map((s, i) => {
          const barWidth = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
          const isBiggestDrop = i === maxDropIdx;
          const stageColor = STAGE_COLORS[s.stage] ?? '#356AF4';
          const stageBg = STAGE_BG[s.stage] ?? 'bg-blue-500/10';

          return (
            <div key={s.stage}>
              <div
                className={cn(
                  'relative rounded-lg overflow-hidden border transition-all',
                  isBiggestDrop
                    ? 'border-amber-300 bg-amber-50/60'
                    : 'border-slate-100 bg-slate-50/40'
                )}
              >
                {/* Bar fill */}
                <div
                  className={cn('absolute inset-y-0 left-0 transition-all duration-500', stageBg)}
                  style={{ width: `${barWidth}%` }}
                  aria-hidden
                />

                <div className="relative flex items-center gap-3 px-3 py-2">
                  {/* Stage dot */}
                  <span
                    className="shrink-0 w-2.5 h-2.5 rounded-full"
                    style={{ background: stageColor }}
                    aria-hidden
                  />

                  {/* Stage name */}
                  <span className="w-24 shrink-0 text-[12px] font-medium text-slate-700">
                    {s.stage}
                  </span>

                  {/* Bar label: count */}
                  <span className="text-[13px] font-bold text-slate-800 tabular-nums flex-1">
                    {fmt(s.count)}
                  </span>

                  {/* Conversion from previous */}
                  {s.convPct != null && (
                    <span
                      className={cn(
                        'text-[11px] font-semibold tabular-nums',
                        s.convPct >= 50
                          ? 'text-emerald-600'
                          : s.convPct >= 25
                          ? 'text-amber-600'
                          : 'text-red-500'
                      )}
                    >
                      {s.convPct.toFixed(1)}%
                    </span>
                  )}

                  {isBiggestDrop && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                </div>
              </div>

              {/* Drop connector line between stages */}
              {i < enriched.length - 1 && (
                <div className="flex items-center gap-2 ml-[42px] my-0.5">
                  <div className="w-px h-3 bg-slate-200" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          Top → bottom: {enriched[0].count > 0
            ? `${((enriched[enriched.length - 1].count / enriched[0].count) * 100).toFixed(1)}% overall conversion`
            : 'No data'}
        </span>
        <span className="text-[11px] font-semibold text-slate-700">
          {enriched[enriched.length - 1].count} Customers
        </span>
      </div>
    </div>
  );
}
