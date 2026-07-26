'use client';

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
  { id: 'revenue', label: 'Revenue trend' },
  { id: 'pipeline', label: 'Pipeline summary' },
  { id: 'completion', label: 'Work completion' },
];

export function OverviewChartCard({
  revenue = [],
  pipeline = [],
  completion = [],
  className,
  loading,
}: OverviewChartCardProps) {
  const [tab, setTab] = useState<OverviewChartTab>('revenue');
  const data =
    tab === 'revenue' ? revenue : tab === 'pipeline' ? pipeline : completion;

  return (
    <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className={WORKSPACE.typography.sectionTitle}>Business overview</h2>
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
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px] w-full">
        {loading ? (
          <div className="h-full rounded-xl bg-[var(--ws-surface-tertiary)] ac-skeleton-pulse" />
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--ws-text-muted)]">
            Not enough data yet for this view.
          </div>
        ) : tab === 'pipeline' ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
            <BarChart data={data}>
              <CartesianGrid stroke="var(--ws-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--ws-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--ws-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={{
                  background: 'var(--ws-surface-primary)',
                  border: '1px solid var(--ws-border)',
                  borderRadius: 10,
                  color: 'var(--ws-text-primary)',
                }}
              />
              <Bar dataKey="value" fill="var(--brand-blue-500)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="osArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-blue-500)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--brand-blue-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--ws-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--ws-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--ws-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{
                  background: 'var(--ws-surface-primary)',
                  border: '1px solid var(--ws-border)',
                  borderRadius: 10,
                  color: 'var(--ws-text-primary)',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--brand-blue-500)"
                fill="url(#osArea)"
                strokeWidth={2}
              />
              {tab === 'revenue' ? (
                <Area
                  type="monotone"
                  dataKey="secondary"
                  stroke="var(--ws-text-muted)"
                  fill="transparent"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
