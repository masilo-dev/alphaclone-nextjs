'use client';

import type { DashboardPill } from '@/types/dashboardStats';

interface StatusPillsProps {
  items: DashboardPill[];
}

export function StatusPills({ items }: StatusPillsProps) {
  return (
    <div className="bg-surface-1 rounded-lg p-4 h-full min-h-[200px]">
      <div className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-xs text-slate-500">No data</span>
        ) : (
          items.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${item.color}22`, color: item.color }}
            >
              {item.label}
              <span className="opacity-80">{item.value}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
