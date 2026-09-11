'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { DashboardChartCard } from './DashboardChartCard';
import { ChartMount } from './ChartMount';
import type { DashboardChartPoint } from '@/types/dashboardStats';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';
import { RichChartEmptyState, RichChartTooltip, formatChartValue, resolveChartAccent } from './chartVisuals';

interface DashboardBarChartProps {
  data: DashboardChartPoint[];
  color?: string;
  moduleId?: string;
  dual?: boolean;
  valuePrefix?: string;
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

export function DashboardBarChart({
  data,
  color = DASHBOARD_COLORS.blue,
  moduleId,
  dual = false,
  valuePrefix = '$',
  title = 'Volume',
  subtitle,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
}: DashboardBarChartProps) {
  const hasValues = data.some((point) => point.value > 0 || (point.value2 ?? 0) > 0);
  const accent = resolveChartAccent(moduleId, color);
  const secondary = DASHBOARD_COLORS.green;
  const gradientId = React.useId().replace(/:/g, '');

  return (
    <DashboardChartCard title={title} subtitle={subtitle} accentColor={accent} badge={dual ? 'Compare' : 'Volume'}>
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
            <BarChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }} barGap={8}>
              <defs>
                <linearGradient id={`bar-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.96} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.42} />
                </linearGradient>
                <linearGradient id={`bar-fill-2-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={secondary} stopOpacity={0.96} />
                  <stop offset="100%" stopColor={secondary} stopOpacity={0.42} />
                </linearGradient>
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
                width={52}
                tickFormatter={(v: number) => formatChartValue(v, valuePrefix)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)', radius: 8 }}
                content={<RichChartTooltip valuePrefix={valuePrefix} dual={dual} />}
              />
              {dual ? (
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  formatter={(value: string) => (value === 'value2' ? 'Collected' : 'Invoiced')}
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                />
              ) : null}
              <Bar dataKey="value" name="value" fill={`url(#bar-fill-${gradientId})`} radius={[8, 8, 2, 2]} maxBarSize={42} />
              {dual ? <Bar dataKey="value2" name="value2" fill={`url(#bar-fill-2-${gradientId})`} radius={[8, 8, 2, 2]} maxBarSize={42} /> : null}
            </BarChart>
          </ResponsiveContainer>
        </ChartMount>
      )}
    </DashboardChartCard>
  );
}
