'use client';

import Link from 'next/link';
import type { ComponentType, CSSProperties } from 'react';
import { ENTERPRISE, WORKSPACE } from '@/constants/design';
import type { AlphacloneIconProps } from '@/components/icons/alphaclone';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ComponentType<AlphacloneIconProps>;
  iconColor?: string;
  changePercent?: number | null;
  comparisonText?: string;
  href?: string;
  trend?: number[];
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  loading?: boolean;
}

function MiniTrend({ values, positive }: { values: number[]; positive: boolean }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const w = 64;
  const h = 20;
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  const stroke = positive ? 'var(--success-500)' : 'var(--error-500)';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="mt-2">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = 'var(--brand-blue-500)',
  changePercent,
  comparisonText,
  href,
  trend,
  interactive,
  className,
  style,
  loading,
}: KpiCardProps) {
  const isInteractive = Boolean(href || interactive);
  const positive = (changePercent ?? 0) >= 0;
  const period = comparisonText ?? (changePercent != null ? ENTERPRISE.metricCard.defaultComparison : undefined);

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--ws-text-secondary)] truncate">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded bg-[var(--ws-surface-tertiary)] ac-skeleton-pulse" />
          ) : (
            <p
              className={cn(
                ENTERPRISE.metricCard.valueSize,
                'mt-1.5 font-bold text-[var(--ws-text-primary)] tabular-nums tracking-tight'
              )}
            >
              {value}
            </p>
          )}
        </div>
        {Icon ? (
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] shrink-0"
            style={{ background: `color-mix(in srgb, ${iconColor} 14%, transparent)`, color: iconColor }}
          >
            <Icon size={20} variant="duotone" decorative />
          </span>
        ) : null}
      </div>

      <div className="mt-auto pt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {changePercent != null ? (
            <p
              className={cn(
                'text-xs font-medium tabular-nums',
                positive ? 'text-[var(--success-text)]' : 'text-[var(--error-text)]'
              )}
            >
              {positive ? '↑' : '↓'} {Math.abs(changePercent).toFixed(1)}%
              {period ? (
                <span className="ml-1 font-normal text-[var(--ws-text-muted)]">{period}</span>
              ) : null}
            </p>
          ) : period ? (
            <p className="text-xs text-[var(--ws-text-muted)]">{period}</p>
          ) : null}
        </div>
        {trend?.length ? <MiniTrend values={trend} positive={positive} /> : null}
      </div>
    </>
  );

  const classes = cn(
    WORKSPACE.panel.base,
    'ac-kpi-card p-4 flex flex-col min-h-[112px]',
    isInteractive && 'ac-kpi-card--interactive',
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes} style={style}>
        {content}
      </Link>
    );
  }

  return (
    <div className={classes} style={style}>
      {content}
    </div>
  );
}

export function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(WORKSPACE.panel.base, 'p-4 min-h-[112px] ac-skeleton-pulse', className)}>
      <div className="h-3.5 w-24 rounded bg-[var(--ws-surface-tertiary)]" />
      <div className="mt-3 h-8 w-32 rounded bg-[var(--ws-surface-tertiary)]" />
      <div className="mt-3 h-3 w-36 rounded bg-[var(--ws-surface-tertiary)]" />
    </div>
  );
}
