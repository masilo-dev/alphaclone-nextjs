'use client';

import type { DeltaColor, DeltaDir } from '@/types/dashboardStats';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';

const DELTA_STYLES: Record<DeltaColor, string> = {
  green: 'text-dashboard-green',
  amber: 'text-dashboard-amber',
  red: 'text-dashboard-red',
  blue: 'text-dashboard-blue',
};

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: DeltaDir;
  deltaColor?: DeltaColor;
  comparisonText?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaDir,
  deltaColor = 'green',
  comparisonText,
  className,
}: MetricCardProps) {
  const arrow = deltaDir === 'down' ? '↓' : deltaDir === 'up' ? '↑' : '';
  const period =
    comparisonText ?? (delta ? ENTERPRISE.metricCard.defaultComparison : undefined);

  return (
    <div
      className={cn(
        'bg-slate-900 rounded-xl p-4 border border-white/5 hover:border-teal-500/20 transition-colors flex flex-col justify-between',
        ENTERPRISE.metricCard.minHeight,
        className
      )}
    >
      <span className={cn(ENTERPRISE.metricCard.labelSize, 'text-slate-400 truncate')}>
        {label}
      </span>

      <div className="mt-2">
        <span
          className={cn(
            ENTERPRISE.metricCard.valueSize,
            'font-black text-white leading-none tabular-nums block tracking-tight'
          )}
        >
          {value}
        </span>

        {(delta || period) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2">
            {delta ? (
              <span
                className={cn(
                  ENTERPRISE.metricCard.trendSize,
                  'font-bold tabular-nums px-1.5 py-0.5 rounded-md',
                  deltaDir === 'up'   ? 'bg-emerald-500/10 text-emerald-400' :
                  deltaDir === 'down' ? 'bg-red-500/10 text-red-400' :
                  DELTA_STYLES[deltaColor]
                )}
              >
                {arrow} {delta}
              </span>
            ) : null}
            {period ? (
              <span className={cn(ENTERPRISE.metricCard.comparisonSize, 'text-slate-500')}>
                {period}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-slate-900 rounded-xl p-4 border border-white/5 ac-skeleton-pulse',
        ENTERPRISE.metricCard.minHeight,
        className
      )}
    >
      <div className="h-3.5 w-24 bg-slate-800 rounded" />
      <div className="h-8 w-32 bg-slate-800 rounded mt-3" />
      <div className="h-3 w-20 bg-slate-800/70 rounded mt-2" />
    </div>
  );
}
