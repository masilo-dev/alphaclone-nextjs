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
        <div className="h-[240px] relative overflow-hidden rounded-xl dashboard-panel-soft px-4 py-5">
          <div className="absolute inset-x-4 top-8 h-px bg-white/5" />
          <div className="absolute inset-x-4 top-16 h-px bg-white/5" />
          <div className="absolute inset-x-4 top-24 h-px bg-white/5" />
          <div className="absolute inset-x-4 top-32 h-px bg-white/5" />
          <div className="absolute inset-x-4 bottom-10 h-px bg-white/5" />

          <div className="relative h-full flex items-end justify-between gap-3">
            {[28, 52, 41, 66, 36, 74].map((height, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-full max-w-10 rounded-t-xl border border-white/5 ${
                    index === 3
                      ? 'bg-[#adebb3]/25'
                      : index === 4
                        ? 'bg-[#ffb347]/20'
                        : 'bg-slate-700/40'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <div className="w-full max-w-10 h-2 rounded-full bg-white/5" />
              </div>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-5 text-center space-y-1">
            <p className="text-sm font-semibold text-[#e5e7eb]">No chart data yet</p>
            <p className="text-xs text-[#94a3b8]">Numbers will plot here once records exist.</p>
          </div>
        </div>
      ) : (
        <ChartMount height={240}>
          <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="dashboard-chart-grid" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#c0c0c0', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#c0c0c0', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v: number) => `${valuePrefix}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <Tooltip
                contentStyle={{ background: 'rgba(2, 6, 23, 0.94)', border: '1px solid rgba(148, 163, 184, 0.16)', borderRadius: 8, fontSize: 12, color: '#f5f5f5' }}
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
                  wrapperStyle={{ fontSize: 11, color: '#c0c0c0' }}
                />
              ) : null}
              <Bar dataKey="value" name="value" fill={color} radius={[4, 4, 0, 0]} />
              {dual ? <Bar dataKey="value2" name="value2" fill="#adebb3" radius={[4, 4, 0, 0]} /> : null}
            </BarChart>
          </ResponsiveContainer>
        </ChartMount>
      )}
    </DashboardChartCard>
  );
}
