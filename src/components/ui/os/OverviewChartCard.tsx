'use client';

import { ChartMount } from '@/components/dashboard/ChartMount';

import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export type OverviewChartTab = 'revenue' | 'pipeline' | 'completion';

interface ChartPoint {
  label: string;
  value: number;
  secondary?: number;
}

interface OverviewChartCardProps {
  revenue?: ChartPoint[];
  pipeline?: ChartPoint[];
  completion?: ChartPoint[];
  className?: string;
  loading?: boolean;
}

const TABS: { id: OverviewChartTab; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'completion', label: 'Tasks done' },
];

const CHART_STROKE = '#38bdf8';
const CHART_FILL = 'rgba(56, 189, 248, 0.22)';
const GRID_STROKE = 'rgba(148, 163, 184, 0.18)';
const AXIS_FILL = '#94a3b8';

function formatAxisValue(value: number): string {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function formatTooltipValue(value: number, tab: OverviewChartTab): string {
  const n = Number(value) || 0;
  if (tab === 'revenue') {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(n);
  }
  return n.toLocaleString();
}

export function OverviewChartCard({
  revenue = [],
  pipeline = [],
  completion = [],
  className,
  loading,
}: OverviewChartCardProps) {
  const [tab, setTab] = useState<OverviewChartTab>('revenue');
  const { t } = useLanguage();
  const data =
    tab === 'revenue' ? revenue : tab === 'pipeline' ? pipeline : completion;

  return (
    <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className={WORKSPACE.typography.sectionTitle}>{t('Business overview')}</h2>
        <div
          className="inline-flex rounded-[10px] bg-[var(--ws-surface-tertiary)] p-1"
          role="tablist"
          aria-label="Overview charts"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'px-3 min-h-8 rounded-[8px] text-xs font-semibold transition-colors duration-150',
                tab === item.id
                  ? 'bg-[var(--ws-surface-primary)] text-[var(--ws-text-primary)] shadow-sm'
                  : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
              )}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[260px] w-full min-w-0">
        {loading ? (
          <div className="h-full rounded-xl bg-[var(--ws-surface-tertiary)] ac-skeleton-pulse" />
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--ws-text-muted)]">
            Not enough data yet for this view.
          </div>
        ) : tab === 'pipeline' ? (
          <ChartMount height={260}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS_FILL, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: AXIS_FILL, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={formatAxisValue}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(56, 189, 248, 0.08)' }}
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: 10,
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                  formatter={(value: number | string) => [formatTooltipValue(Number(value), tab), tab === 'pipeline' ? 'Deals' : 'Value']}
                />
                <Bar dataKey="value" fill={CHART_STROKE} radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </ChartMount>
        ) : (
          <ChartMount height={260}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="osAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_STROKE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART_STROKE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS_FILL, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: AXIS_FILL, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={formatAxisValue}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: 10,
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                  formatter={(value: number | string) => [formatTooltipValue(Number(value), tab), tab === 'revenue' ? 'Revenue' : 'Completed']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_STROKE}
                  fill="url(#osAreaFill)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: CHART_STROKE, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: CHART_STROKE, stroke: '#0f172a', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartMount>
        )}
      </div>
    </section>
  );
}
