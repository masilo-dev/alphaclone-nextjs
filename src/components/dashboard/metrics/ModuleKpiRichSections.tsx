'use client';

import type { DashboardMetric, DashboardPill, OverviewStatsResponse } from '@/types/dashboardStats';
import { platformKpiFromDashboardMetric } from '@/lib/metrics/metricPresentation';
import { resolveMetricIdByLabel } from '@/lib/metrics/platformMetricRegistry';
import { metricLabel } from '@/lib/copy/humanLabels';
import type { ReactNode } from 'react';
import { PlatformKpiGrid } from './PlatformKpiGrid';
import type { PlatformKpiCardProps } from './PlatformKpiCard';
import { BreakdownBars } from '@/components/dashboard/BreakdownBars';
import { StatusDonut } from '@/components/dashboard/StatusDonut';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

function metricsToKpiItems(
  metrics: DashboardMetric[],
  comparisonLabel: string,
): PlatformKpiCardProps[] {
  return metrics.map((m) => ({
    ...platformKpiFromDashboardMetric(m, { metricId: resolveMetricIdByLabel(m.label) }),
    label: metricLabel(m.label),
    referencePeriod: m.comparisonText ?? comparisonLabel,
  }));
}

function pillsToKpiItems(pills: DashboardPill[], comparisonLabel: string): PlatformKpiCardProps[] {
  return pills.map((pill) => ({
    label: metricLabel(pill.label),
    current: pill.value,
    formattedValue: pill.value.toLocaleString(),
    state: 'ready' as const,
    isBetterHigher: true,
    referencePeriod: comparisonLabel,
  }));
}

function healthStatusLabel(color: string): string {
  const normalized = color.toLowerCase();
  if (normalized.includes('fb7185') || normalized.includes('red') || normalized === '#ef4444') {
    return 'Needs attention';
  }
  if (normalized.includes('fbbf24') || normalized.includes('amber') || normalized === '#f59e0b') {
    return 'Watch';
  }
  return 'Healthy';
}

function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-[11px] font-black uppercase tracking-widest text-slate-400', className)}>
      {children}
    </p>
  );
}

interface ModuleKpiRichSectionsProps {
  data: OverviewStatsResponse;
  comparisonLabel: string;
  showPlatformHealth?: boolean;
}

export function ModuleKpiRichSections({
  data,
  comparisonLabel,
  showPlatformHealth = false,
}: ModuleKpiRichSectionsProps) {
  const { t } = useLanguage();
  const primaryKpis = metricsToKpiItems(data.metrics, comparisonLabel);
  const secondaryKpis = metricsToKpiItems(data.metricsRowB ?? [], comparisonLabel);
  const signalKpis = pillsToKpiItems(data.pills ?? [], comparisonLabel);
  const allKpis = [...primaryKpis, ...secondaryKpis];

  const breakdownTitle =
    data.breakdown.length > 0 && data.breakdown[0]?.label
      ? 'Volume breakdown'
      : 'Breakdown';
  const donutTitle = 'Status mix';
  const healthItems = data.platformHealth ?? [];

  return (
    <div className="space-y-5">
      {allKpis.length > 0 ? (
        <PlatformKpiGrid
          className="ac-metric-enter"
          header={<SectionLabel>{t('Key metrics')} · {t(comparisonLabel)}</SectionLabel>}
          items={allKpis}
        />
      ) : null}

      {signalKpis.length > 0 ? (
        <PlatformKpiGrid
          className="ac-metric-enter"
          header={<SectionLabel>{t('Status signals')}</SectionLabel>}
          items={signalKpis}
        />
      ) : null}

      {showPlatformHealth && healthItems.length > 0 ? (
        <div className="ac-workspace-panel rounded-lg p-4">
          <SectionLabel className="mb-3">{t('Platform health')}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {healthItems.map((pill) => (
              <span
                key={pill.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-[11px] font-semibold text-slate-200"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: pill.color }}
                  aria-hidden
                />
                <span>{t(pill.label)}</span>
                <span className="text-slate-500">·</span>
                <span style={{ color: pill.color }}>{t(healthStatusLabel(pill.color))}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 ac-chart-enter">
        <BreakdownBars
          items={data.breakdown.map((item) => ({ ...item, label: t(item.label) }))}
          title={t(breakdownTitle)}
          subtitle={t('Share by category in this module')}
        />
        <StatusDonut
          segments={data.donut.map((segment) => ({ ...segment, label: t(segment.label) }))}
          title={t(donutTitle)}
          subtitle={t('Current distribution')}
        />
        <ActivityFeed
          items={data.feed}
          title={t('Recent activity')}
          subtitle={t('Latest updates in this module')}
        />
      </div>
    </div>
  );
}
