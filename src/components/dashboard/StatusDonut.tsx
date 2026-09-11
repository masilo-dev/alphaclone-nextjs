'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { DashboardDonutSegment } from '@/types/dashboardStats';
import { ChartMount } from './ChartMount';
import { DashboardPanelHeader } from './DashboardPanelHeader';

interface StatusDonutProps {
  segments: DashboardDonutSegment[];
  title?: string;
  subtitle?: string;
}

export function StatusDonut({
  segments,
  title = 'Status mix',
  subtitle = 'Current distribution',
}: StatusDonutProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="bg-surface-1 rounded-lg p-4 md:p-5 h-full min-h-[280px] flex flex-col">
      <DashboardPanelHeader title={title} subtitle={subtitle} />
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">No status data</div>
      ) : (
        <div className="flex-1 flex items-center gap-4 min-h-0">
          <div className="w-[132px] h-[132px] shrink-0">
            <ChartMount height={132}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segments}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={58}
                    strokeWidth={0}
                  >
                    {segments.map((seg) => (
                      <Cell key={seg.label} fill={seg.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartMount>
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            {segments.map((seg) => {
              const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
              return (
                <div key={seg.label} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-slate-300 truncate flex-1">{seg.label}</span>
                  <span className="text-slate-400 shrink-0 tabular-nums">{pct}%</span>
                  <span className="text-slate-200 shrink-0 tabular-nums w-6 text-right">{seg.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
