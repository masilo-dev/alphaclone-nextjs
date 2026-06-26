'use client';

import type { DashboardBreakdownItem } from '@/types/dashboardStats';

interface BreakdownBarsProps {
  items: DashboardBreakdownItem[];
}

function truncateLabel(label: string, max = 10): string {
  return label.length > max ? `${label.slice(0, max)}` : label;
}

export function BreakdownBars({ items }: BreakdownBarsProps) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="bg-surface-1 rounded-lg p-4 h-full flex flex-col gap-3 min-h-[240px]">
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">No data</div>
      ) : (
        items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-16 shrink-0 truncate" title={item.label}>
              {truncateLabel(item.label)}
            </span>
            <div className="flex-1 h-2 bg-slate-800/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
              />
            </div>
            <span className="text-xs text-slate-300 w-8 text-right shrink-0">{item.value}</span>
          </div>
        ))
      )}
    </div>
  );
}
