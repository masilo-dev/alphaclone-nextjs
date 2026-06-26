'use client';

import type { DashboardFeedItem } from '@/types/dashboardStats';

interface ActivityFeedProps {
  items: DashboardFeedItem[];
}

function truncateText(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  const visible = items.slice(0, 5);

  return (
    <div className="bg-surface-1 rounded-lg p-4 h-full min-h-[200px]">
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center">No activity</div>
        ) : (
          visible.map((item, i) => (
            <div key={`${item.text}-${i}`} className="flex items-start gap-2">
              <span
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: item.dot }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 truncate">{truncateText(item.text)}</p>
                <span className="text-[10px] text-slate-500">{item.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
