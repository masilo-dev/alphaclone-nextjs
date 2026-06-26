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
import type { DashboardChartPoint } from '@/types/dashboardStats';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';

interface DashboardLineChartProps {
  data: DashboardChartPoint[];
  color?: string;
  valuePrefix?: string;
}

export function DashboardLineChart({
  data,
  color = DASHBOARD_COLORS.blue,
  valuePrefix = '',
}: DashboardLineChartProps) {
  return (
    <DashboardChartCard>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${valuePrefix}${v}`}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number) => [`${valuePrefix}${value}`, '']}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </DashboardChartCard>
  );
}
