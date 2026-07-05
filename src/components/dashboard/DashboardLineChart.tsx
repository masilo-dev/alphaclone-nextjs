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
        <div className="h-[240px] relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-b from-slate-950/40 to-slate-900/20 px-4 py-5">
          <div className="absolute inset-x-4 top-10 h-px bg-white/5" />
          <div className="absolute inset-x-4 top-20 h-px bg-white/5" />
          <div className="absolute inset-x-4 top-28 h-px bg-white/5" />
          <div className="absolute inset-x-4 bottom-12 h-px bg-white/5" />

          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M0,30 C12,28 18,18 28,20 C36,22 43,12 52,14 C62,16 70,10 80,12 C88,13 94,9 100,11"
              fill="none"
              stroke="rgba(45, 212, 191, 0.55)"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            {[
              [12, 28],
              [28, 20],
              [52, 14],
              [80, 12],
            ].map(([x, y], index) => (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="0.9"
                fill={index === 2 ? 'rgba(45, 212, 191, 0.95)' : 'rgba(148, 163, 184, 0.8)'}
              />
            ))}
          </svg>

          <div className="absolute inset-x-0 bottom-5 text-center space-y-1">
            <p className="text-sm font-semibold text-slate-300">No trend data yet</p>
            <p className="text-xs text-slate-500">Activity will appear here as your team works.</p>
          </div>
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
