'use client';

import type { DashboardBreakdownItem } from '@/types/dashboardStats';
import { DashboardPanelHeader } from './DashboardPanelHeader';

interface BreakdownBarsProps {
  items: DashboardBreakdownItem[];
  title?: string;
  subtitle?: string;
}

export function BreakdownBars({
  items,
  title = 'Breakdown',
  subtitle = 'Share by category',
}: BreakdownBarsProps) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="bg-surface-1 rounded-lg p-4 md:p-5 h-full flex flex-col min-h-[280px]">
      <DashboardPanelHeader title={title} subtitle={subtitle} />
      <div className="flex-1 flex flex-col gap-3 justify-center">
        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">No breakdown data</div>
        ) : (
          items.map((item) => {
            const pct = Math.round((item.value / max) * 100);
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span
                  className="text-xs text-slate-300 w-20 md:w-28 shrink-0 truncate"
                  title={item.label}
                >
                  {item.label}
                </span>
                <div className="flex-1 h-2.5 bg-slate-800/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                  />
                </div>
                <span className="text-xs text-slate-200 w-10 text-right shrink-0 tabular-nums">{item.value}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
