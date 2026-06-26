'use client';

import type { DashboardPill } from '@/types/dashboardStats';
import { DashboardPanelHeader } from './DashboardPanelHeader';

interface StatusPillsProps {
  items: DashboardPill[];
  title?: string;
  subtitle?: string;
}

export function StatusPills({
  items,
  title = 'Health',
  subtitle = 'Module snapshot',
}: StatusPillsProps) {
  return (
    <div className="bg-surface-1 rounded-lg p-4 md:p-5 h-full min-h-[280px] flex flex-col">
      <DashboardPanelHeader title={title} subtitle={subtitle} />
      <div className="flex flex-wrap gap-2 content-start">
        {items.length === 0 ? (
          <span className="text-sm text-slate-500">No health data</span>
        ) : (
          items.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${item.color}22`, color: item.color }}
            >
              {item.label}
              <span className="opacity-90 tabular-nums">{item.value}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
