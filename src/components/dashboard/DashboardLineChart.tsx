'use client';

import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DashboardChartCard } from './DashboardChartCard';
import { ChartMount } from './ChartMount';
import type { DashboardChartPoint } from '@/types/dashboardStats';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';
import { RichChartEmptyState, RichChartTooltip, formatChartValue, resolveChartAccent } from './chartVisuals';

interface DashboardLineChartProps {
  data: DashboardChartPoint[];
  color?: string;
  moduleId?: string;
  valuePrefix?: string;
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

export function DashboardLineChart({
  data,
  color = DASHBOARD_COLORS.blue,
  moduleId,
  valuePrefix = '',
  title = 'Trend',
  subtitle,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
}: DashboardLineChartProps) {
  const hasValues = data.some((point) => point.value > 0);
  const accent = resolveChartAccent(moduleId, color);
  const gradientId = React.useId().replace(/:/g, '');

  return (
    <DashboardChartCard title={title} subtitle={subtitle} accentColor={accent} badge="Trend">
      {!hasValues ? (
        <RichChartEmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
          accentColor={accent}
        />
      ) : (
        <ChartMount height={240}>
          <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
            <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`line-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.26} />
                  <stop offset="62%" stopColor={accent} stopOpacity={0.06} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
                <filter id={`line-glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => formatChartValue(v, valuePrefix)}
              />
              <Tooltip
                cursor={{ stroke: accent, strokeOpacity: 0.22, strokeWidth: 1 }}
                content={<RichChartTooltip valuePrefix={valuePrefix} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill={`url(#line-fill-${gradientId})`}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={accent}
                strokeWidth={3}
                filter={`url(#line-glow-${gradientId})`}
                dot={{ r: 3, fill: '#0f172a', stroke: accent, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: accent, stroke: '#0f172a', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartMount>
      )}
    </DashboardChartCard>
  );
}
