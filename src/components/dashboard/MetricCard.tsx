'use client';

import type { CSSProperties } from 'react';
import type { DeltaColor, DeltaDir } from '@/types/dashboardStats';
import { ENTERPRISE, WORKSPACE } from '@/constants/design';
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
  style?: CSSProperties;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaDir,
  deltaColor = 'green',
  comparisonText,
  className,
  style,
}: MetricCardProps) {
  const arrow = deltaDir === 'down' ? '↓' : deltaDir === 'up' ? '↑' : '';
  const period =
    comparisonText ?? (delta ? ENTERPRISE.metricCard.defaultComparison : undefined);

  return (
    <div
      className={cn(
        WORKSPACE.panel.base,
        ENTERPRISE.metricCard.minHeight,
        'p-4 flex flex-col justify-between shadow-none',
        className
      )}
      style={style}
    >
      <span className={cn('text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--ws-text-tertiary)] truncate')}>
        {label}
      </span>

      <div className="mt-2">
        <span
          className={cn(
            ENTERPRISE.metricCard.valueSize,
            'font-semibold text-white leading-none tabular-nums tracking-tight block',
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
                  'font-medium tabular-nums',
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

export function MetricCardSkeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        WORKSPACE.panel.base,
        ENTERPRISE.metricCard.minHeight,
        'p-4 ac-skeleton-pulse shadow-none',
        className
      )}
      style={style}
    >
      <div className="h-3.5 w-24 bg-slate-800 rounded" />
      <div className="h-8 w-32 bg-slate-800 rounded mt-3" />
      <div className="h-3 w-20 bg-slate-800/70 rounded mt-2" />
    </div>
  );
}
