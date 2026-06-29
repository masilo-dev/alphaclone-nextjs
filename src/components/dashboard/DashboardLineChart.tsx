'use client';

import {
  LineChart,
  Line,
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

interface DashboardLineChartProps {
  data: DashboardChartPoint[];
  color?: string;
  valuePrefix?: string;
  title?: string;
  subtitle?: string;
}

export function DashboardLineChart({
  data,
  color = DASHBOARD_COLORS.blue,
  valuePrefix = '',
  title = 'Trend',
  subtitle,
}: DashboardLineChartProps) {
  const hasValues = data.some((point) => point.value > 0);

  return (
    <DashboardChartCard title={title} subtitle={subtitle}>
      {!hasValues ? (
        <div className="h-[240px] flex flex-col items-center justify-center text-center px-4">
          <p className="text-sm text-slate-400">No trend data yet</p>
          <p className="text-xs text-slate-500 mt-1">Activity will appear here as your team works.</p>
        </div>
      ) : (
        <ChartMount height={240}>
          <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
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
                tickFormatter={(v: number) => `${valuePrefix}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value: number) => [`${valuePrefix}${value}`, '']}
              />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartMount>
      )}
    </DashboardChartCard>
  );
}
