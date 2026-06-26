'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { DashboardDonutSegment } from '@/types/dashboardStats';

interface StatusDonutProps {
  segments: DashboardDonutSegment[];
}

export function StatusDonut({ segments }: StatusDonutProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="bg-surface-1 rounded-lg p-4 h-full min-h-[200px] flex items-center gap-3">
      {total === 0 ? (
        <div className="flex-1 text-xs text-slate-500 text-center">No data</div>
      ) : (
        <>
          <div className="w-[120px] h-[120px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segments}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={52}
                  strokeWidth={0}
                >
                  {segments.map((seg) => (
                    <Cell key={seg.label} fill={seg.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {segments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-slate-400 truncate flex-1">{seg.label}</span>
                <span className="text-slate-200 shrink-0">{seg.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
