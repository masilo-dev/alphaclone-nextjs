'use client';

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

interface DashboardBarChartProps {
  data: DashboardChartPoint[];
  color?: string;
  dual?: boolean;
  valuePrefix?: string;
  title?: string;
  subtitle?: string;
}

export function DashboardBarChart({
  data,
  color = DASHBOARD_COLORS.blue,
  dual = false,
  valuePrefix = '$',
  title = 'Volume',
  subtitle,
}: DashboardBarChartProps) {
  const hasValues = data.some((point) => point.value > 0 || (point.value2 ?? 0) > 0);

  return (
    <DashboardChartCard title={title} subtitle={subtitle}>
      {!hasValues ? (
        <div className="h-[240px] flex flex-col items-center justify-center text-center px-4">
          <p className="text-sm text-slate-400">No chart data yet</p>
          <p className="text-xs text-slate-500 mt-1">Numbers will plot here once records exist.</p>
        </div>
      ) : (
        <ChartMount height={240}>
          <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                width={52}
                tickFormatter={(v: number) => `${valuePrefix}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [
                  `${valuePrefix}${value}`,
                  name === 'value2' ? 'Collected' : dual ? 'Invoiced' : 'Total',
                ]}
              />
              {dual ? (
                <Legend
                  verticalAlign="top"
                  height={28}
                  formatter={(value: string) => (value === 'value2' ? 'Collected' : 'Invoiced')}
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                />
              ) : null}
              <Bar dataKey="value" name="value" fill={color} radius={[4, 4, 0, 0]} />
              {dual ? <Bar dataKey="value2" name="value2" fill={DASHBOARD_COLORS.green} radius={[4, 4, 0, 0]} /> : null}
            </BarChart>
          </ResponsiveContainer>
        </ChartMount>
      )}
    </DashboardChartCard>
  );
}
