'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DashboardChartCard } from './DashboardChartCard';
import type { DashboardChartPoint } from '@/types/dashboardStats';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';

interface DashboardBarChartProps {
  data: DashboardChartPoint[];
  color?: string;
  dual?: boolean;
  valuePrefix?: string;
}

export function DashboardBarChart({
  data,
  color = DASHBOARD_COLORS.blue,
  dual = false,
  valuePrefix = '$',
}: DashboardBarChartProps) {
  return (
    <DashboardChartCard>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${valuePrefix}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
            formatter={(value: number, name: string) => [`${valuePrefix}${value}`, name === 'value2' ? 'Collected' : 'Invoiced']}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          {dual ? <Bar dataKey="value2" fill={DASHBOARD_COLORS.green} radius={[4, 4, 0, 0]} /> : null}
        </BarChart>
      </ResponsiveContainer>
    </DashboardChartCard>
  );
}
