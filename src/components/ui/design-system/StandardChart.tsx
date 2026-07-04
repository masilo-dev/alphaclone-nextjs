'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';

// --- Helper component to handle hydration/mounting safely ---
function ChartMount({ height, children }: { height: number; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="w-full rounded-xl bg-slate-900/40 border border-white/5 animate-pulse"
        style={{ height }}
      />
    );
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      {children}
    </div>
  );
}

// --- Custom Premium Tooltip ---
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

const CustomTooltip = ({ active, payload, label, valuePrefix = '', valueSuffix = '' }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)]">
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mt-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.stroke || entry.fill || entry.color || '#2dd4bf' }} 
            />
            <span className="text-xs text-slate-400 font-medium">{entry.name || 'Value'}:</span>
            <span className="text-xs text-white font-black">
              {valuePrefix}
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- 1. Standard Line Chart ---
interface LineChartProps {
  data: any[];
  xKey?: string;
  yKey?: string;
  name?: string;
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
  className?: string;
}

export function StandardLineChart({
  data,
  xKey = 'label',
  yKey = 'value',
  name = 'Value',
  color = DASHBOARD_COLORS.teal,
  valuePrefix = '',
  valueSuffix = '',
  height = 240,
  className,
}: LineChartProps) {
  const hasValues = data && data.length > 0 && data.some((point) => point[yKey] > 0);

  return (
    <div className={cn("w-full bg-slate-900/40 backdrop-blur-md rounded-xl p-4 border border-white/5", className)}>
      {!hasValues ? (
        <div style={{ height }} className="flex flex-col items-center justify-center text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-black">No Trend Data</p>
          <p className="text-[11px] text-slate-600 mt-1">Updates will render dynamically.</p>
        </div>
      ) : (
        <ChartMount height={height}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${yKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.03} vertical={false} />
              <XAxis
                dataKey={xKey}
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${valuePrefix}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip content={<CustomTooltip valuePrefix={valuePrefix} valueSuffix={valueSuffix} />} />
              <Line
                type="monotone"
                dataKey={yKey}
                name={name}
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartMount>
      )}
    </div>
  );
}

// --- 2. Standard Bar Chart ---
interface BarChartProps {
  data: any[];
  xKey?: string;
  yKey?: string;
  name?: string;
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
  className?: string;
}

export function StandardBarChart({
  data,
  xKey = 'label',
  yKey = 'value',
  name = 'Value',
  color = DASHBOARD_COLORS.teal,
  valuePrefix = '',
  valueSuffix = '',
  height = 240,
  className,
}: BarChartProps) {
  const hasValues = data && data.length > 0 && data.some((point) => point[yKey] > 0);

  return (
    <div className={cn("w-full bg-slate-900/40 backdrop-blur-md rounded-xl p-4 border border-white/5", className)}>
      {!hasValues ? (
        <div style={{ height }} className="flex flex-col items-center justify-center text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-black">No Bar Data</p>
          <p className="text-[11px] text-slate-600 mt-1">Updates will render dynamically.</p>
        </div>
      ) : (
        <ChartMount height={height}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.03} vertical={false} />
              <XAxis
                dataKey={xKey}
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${valuePrefix}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip content={<CustomTooltip valuePrefix={valuePrefix} valueSuffix={valueSuffix} />} />
              <Bar 
                dataKey={yKey} 
                name={name} 
                fill={color} 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartMount>
      )}
    </div>
  );
}

// --- 3. Standard Donut Chart ---
interface DonutChartProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  className?: string;
  innerRadius?: number;
  outerRadius?: number;
}

export function StandardDonutChart({
  data,
  height = 240,
  className,
  innerRadius = 60,
  outerRadius = 80,
}: DonutChartProps) {
  const hasValues = data && data.length > 0 && data.some((point: { name: string; value: number }) => point.value > 0);
  const defaultColors = [
    DASHBOARD_COLORS.teal,
    DASHBOARD_COLORS.blue,
    DASHBOARD_COLORS.indigo,
    DASHBOARD_COLORS.violet,
    DASHBOARD_COLORS.slate,
  ];

  return (
    <div className={cn("w-full bg-slate-900/40 backdrop-blur-md rounded-xl p-4 border border-white/5", className)}>
      {!hasValues ? (
        <div style={{ height }} className="flex flex-col items-center justify-center text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-black">No Segment Data</p>
          <p className="text-[11px] text-slate-600 mt-1">Segments will render dynamically.</p>
        </div>
      ) : (
        <ChartMount height={height}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color || defaultColors[index % defaultColors.length]} 
                    stroke="rgba(15, 23, 42, 0.8)" 
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                iconSize={8}
                formatter={(value: string | number) => <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartMount>
      )}
    </div>
  );
}
