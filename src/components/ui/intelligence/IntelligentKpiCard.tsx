'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, TrendingUp, TrendingDown, Minus, Target, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildFullKpiViewModel, type FullKpiViewModel, type KpiStatus } from '@/lib/analytics/kpiMath';
import { getSemanticStyles, kpiStatusToSeverity, type SemanticSeverity } from '@/lib/analytics/funnelAndPriority';
import { WORKSPACE } from '@/constants/design';
import type { AlphacloneIconProps } from '@/components/icons/alphaclone';
import type { ComponentType } from 'react';

export interface IntelligentKpiCardProps {
  label: string;
  current: number;
  previous?: number;
  target?: number;
  isBetterHigher?: boolean;
  unit?: string;
  isPercentage?: boolean;
  /** When set, overrides numeric formatting (e.g. pre-formatted currency strings). */
  displayValue?: string;
  referencePeriod?: string;
  href?: string;
  onClick?: () => void;
  icon?: ComponentType<AlphacloneIconProps>;
  iconColor?: string;
  trend?: number[];
  pace?: { periodStart: Date; periodEnd: Date; asOf?: Date };
  showNarrative?: boolean;
  accent?: SemanticSeverity;
  loading?: boolean;
  className?: string;
  compact?: boolean;
}

function TrendIcon({ trend }: { trend: FullKpiViewModel['trend'] }) {
  if (trend === 'up') return <TrendingUp className="w-3 h-3" />;
  if (trend === 'down') return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

function StatusBadge({ status }: { status: KpiStatus }) {
  const severity = kpiStatusToSeverity(status);
  const styles = getSemanticStyles(severity);
  const labels: Record<KpiStatus, string> = {
    healthy: 'On target',
    improving: 'Improving',
    warning: 'Attention',
    critical: 'At risk',
    stagnant: 'Stagnant',
    neutral: 'Stable',
    insufficient_data: 'New',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase',
      styles.bg, styles.text, styles.border, 'border',
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', styles.dot)} />
      {labels[status]}
    </span>
  );
}

function ProgressBar({ progress, severity }: { progress: number | null; severity: SemanticSeverity }) {
  if (progress == null) return null;
  const pct = Math.max(0, Math.min(100, progress));
  const styles = getSemanticStyles(severity);
  return (
    <div className="mt-3 space-y-1" aria-label={`Progress: ${pct.toFixed(1)}% of target`}>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            styles.dot,
          )}
          style={{ width: `${pct}%`, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

function MiniSparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const w = 72;
  const h = 22;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 3) - 1.5;
      return `${x},${y}`;
    })
    .join(' ');
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  const color = positive ? 'var(--success-500)' : 'var(--error-500)';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 mt-1">
      <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaceReadout({ vm }: { vm: FullKpiViewModel }) {
  if (vm.requiredPace == null || vm.currentPace == null || vm.daysRemaining == null) return null;
  const ahead = vm.currentPace >= (vm.requiredPace || 0);
  const styles = getSemanticStyles(ahead ? 'success' : 'warning');
  return (
    <div className={cn('mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px]', styles.text)}>
      {vm.daysRemaining != null && <span>{vm.daysRemaining}d left</span>}
      {vm.currentPace != null && <span>Current: {vm.currentPace.toLocaleString()}/d</span>}
      {vm.requiredPace != null && <span>Need: {vm.requiredPace.toLocaleString()}/d</span>}
    </div>
  );
}

export function IntelligentKpiCard({
  label,
  current,
  previous = 0,
  target,
  isBetterHigher = true,
  unit = '',
  isPercentage = false,
  displayValue,
  referencePeriod,
  href,
  onClick,
  icon: Icon,
  iconColor,
  trend,
  pace,
  showNarrative = false,
  accent,
  loading = false,
  className,
  compact = false,
}: IntelligentKpiCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className={cn(WORKSPACE.panel.base, 'p-4 min-h-[112px] ac-skeleton-pulse', className)}>
        <div className="h-3.5 w-24 rounded bg-[var(--ws-surface-tertiary)]" />
        <div className="mt-3 h-8 w-32 rounded bg-[var(--ws-surface-tertiary)]" />
        <div className="mt-3 h-3 w-36 rounded bg-[var(--ws-surface-tertiary)]" />
      </div>
    );
  }

  const vm = buildFullKpiViewModel({
    label,
    current,
    previous,
    target,
    isBetterHigher,
    unit,
    isPercentage,
    referencePeriod,
    pace,
  });

  const severity = accent ?? kpiStatusToSeverity(vm.status);
  const sem = getSemanticStyles(severity);
  const interactive = Boolean(href || onClick);
  const deltaColor = vm.isBetterHigher
    ? (vm.trend === 'up' ? 'success' : vm.trend === 'down' ? 'critical' : 'neutral')
    : (vm.trend === 'down' ? 'success' : vm.trend === 'up' ? 'critical' : 'neutral');
  const deltaSem = getSemanticStyles(deltaColor);
  const positiveTrend = vm.isBetterHigher ? vm.trend !== 'down' : vm.trend !== 'up';

  const iconBg = iconColor
    ? { background: `color-mix(in srgb, ${iconColor} 14%, transparent)`, color: iconColor }
    : { background: `color-mix(in srgb, var(--brand-blue-500) 14%, transparent)`, color: 'var(--brand-blue-400)' };

  const inner = (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-medium text-[var(--ws-text-secondary)] truncate">{vm.label}</p>
            <StatusBadge status={vm.status} />
          </div>
          <p
            className={cn(
              'mt-1.5 font-bold tabular-nums tracking-tight text-[var(--ws-text-primary)]',
              compact ? 'text-[1.25rem]' : 'text-[1.6rem] sm:text-[1.75rem]',
            )}
          >
            {displayValue ?? vm.valueFormatted}
          </p>
        </div>
        {Icon ? (
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] shrink-0"
            style={iconBg}
          >
            <Icon size={20} variant="duotone" decorative />
          </span>
        ) : null}
      </div>

      <div className="mt-auto pt-3">
        <div className="flex items-end justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            {(vm.absoluteChange !== 0 || vm.percentageChange != null) ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold tabular-nums',
                    deltaSem.bg, deltaSem.text, deltaSem.border, 'border',
                  )}
                >
                  <TrendIcon trend={vm.trend} />
                  {vm.formattedDelta}
                </span>
                <span className="text-[10.5px] text-[var(--ws-text-muted)]">{vm.referencePeriod}</span>
              </div>
            ) : (
              <p className="text-[10.5px] text-[var(--ws-text-muted)]">{vm.referencePeriod}</p>
            )}
            <PaceReadout vm={vm} />
          </div>
          {trend?.length ? <MiniSparkline values={trend} positive={positiveTrend} /> : null}
        </div>

        {(target != null || showNarrative) && !compact ? (
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            {target != null ? (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1 text-[var(--ws-text-muted)]">
                  <Target className="w-3 h-3" />
                  <span>Target</span>
                </div>
                <span className="font-bold text-[var(--ws-text-secondary)] tabular-nums">
                  {isPercentage ? `${target}%` : `${target.toLocaleString()}${unit}`}
                  {vm.progressPct != null ? (
                    <span className="ml-1.5 text-[var(--ws-text-muted)] font-medium">
                      · {vm.progressPct.toFixed(0)}%
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}
            <ProgressBar progress={vm.progressPct} severity={severity} />

            {showNarrative ? (
              <div className="mt-3">
                {expanded ? (
                  <div className={cn('rounded-lg p-2.5 text-[12px] leading-relaxed', sem.bg, sem.text)}>
                    <div className="flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <p className="min-w-0">{vm.contextNarrative}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(true);
                    }}
                    className="flex items-center gap-1 text-[10.5px] font-medium text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)] transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    Why this matters
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const classes = cn(
    WORKSPACE.panel.base,
    'ac-intelligent-kpi p-4 flex flex-col min-h-[112px] group',
    interactive && 'ac-intelligent-kpi--interactive cursor-pointer',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
        <ChevronRight className="absolute top-3 right-3 w-3.5 h-3.5 text-[var(--ws-text-disabled)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {inner}
      </button>
    );
  }

  return (
    <div className={cn(classes, 'relative')}>
      {inner}
    </div>
  );
}

export { buildFullKpiViewModel };
