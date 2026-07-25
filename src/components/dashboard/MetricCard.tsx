'use client';

import type { CSSProperties } from 'react';
import type { DeltaColor, DeltaDir } from '@/types/dashboardStats';
import { ENTERPRISE, WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const DELTA_STYLES: Record<DeltaColor, string> = {
  green: 'text-dashboard-green',
  amber: 'text-dashboard-amber',
  red: 'text-dashboard-red',
  blue: 'text-dashboard-blue',
  teal: 'text-teal-400',
};

export interface MetricCardProps {
  label: string;
  value: string | number | null;
  delta?: string;
  deltaDir?: DeltaDir;
  deltaColor?: DeltaColor;
  comparisonText?: string;
  period?: string;
  loading?: boolean;
  error?: string;
  unavailableReason?: string;
  href?: string;
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
  period,
  loading,
  error,
  unavailableReason,
  href,
  className,
  style,
}: MetricCardProps) {
  if (loading) {
    return <MetricCardSkeleton className={className} style={style} />;
  }

  const arrow = deltaDir === 'down' ? '↓' : deltaDir === 'up' ? '↑' : '';
  const periodLabel =
    period ?? comparisonText ?? (delta ? ENTERPRISE.metricCard.defaultComparison : undefined);
  const isUnavailable = value == null || Boolean(unavailableReason) || Boolean(error);
  const displayValue = error
    ? 'Unavailable'
    : unavailableReason
      ? 'Not tracked'
      : value == null
        ? '—'
        : value;

  const body = (
    <>
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--ws-text-tertiary)] truncate">
        {label}
      </span>

      <div className="mt-2">
        <span
          className={cn(
            ENTERPRISE.metricCard.valueSize,
            'font-semibold leading-none tabular-nums tracking-tight block',
            isUnavailable ? 'text-slate-500 text-[1.25rem]' : 'text-white'
          )}
        >
          {displayValue}
        </span>

        {(error || unavailableReason) && (
          <p className="text-[11px] text-slate-500 mt-2 leading-snug">
            {error || unavailableReason}
          </p>
        )}

        {!isUnavailable && (delta || periodLabel) && (
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
            {periodLabel ? (
              <span className={cn(ENTERPRISE.metricCard.comparisonSize, 'text-slate-500')}>
                {periodLabel}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </>
  );

  const shellClass = cn(
    WORKSPACE.panel.base,
    ENTERPRISE.metricCard.minHeight,
    'p-4 flex flex-col justify-between shadow-none',
    href && 'hover:border-teal-500/30 transition-colors',
    className
  );

  if (href) {
    return (
      <Link href={href} className={shellClass} style={style}>
        {body}
      </Link>
    );
  }

  return (
    <div className={shellClass} style={style}>
      {body}
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
      role="status"
      aria-busy="true"
      aria-label="Loading metric"
    >
      <div className="h-3.5 w-24 bg-slate-800 rounded" />
      <div className="h-8 w-32 bg-slate-800 rounded mt-3" />
      <div className="h-3 w-20 bg-slate-800/70 rounded mt-2" />
    </div>
  );
}
