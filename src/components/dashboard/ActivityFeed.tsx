'use client';

import type { DashboardFeedItem } from '@/types/dashboardStats';
import { DashboardPanelHeader } from './DashboardPanelHeader';

interface ActivityFeedProps {
  items: DashboardFeedItem[];
  title?: string;
  subtitle?: string;
}

export function ActivityFeed({
  items,
  title = 'Recent activity',
  subtitle = 'Latest updates',
}: ActivityFeedProps) {
  const visible = items.slice(0, 5);

  return (
    <div className="bg-surface-1 rounded-lg p-4 md:p-5 h-full min-h-[280px] flex flex-col">
      <DashboardPanelHeader title={title} subtitle={subtitle} />
      <div className="space-y-3 flex-1">
        {visible.length === 0 ? (
          <div className="type-ui text-[var(--ws-text-muted)] py-8 text-center">No recent activity</div>
        ) : (
          visible.map((item, i) => (
            <div key={`${item.text}-${i}`} className="flex items-start gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: item.dot }}
              />
              <div className="flex-1 min-w-0">
                <p className="type-card-description text-[var(--ws-text-secondary)] leading-snug line-clamp-2">{item.text}</p>
                <span className="type-caption text-[var(--ws-text-muted)]">{item.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
