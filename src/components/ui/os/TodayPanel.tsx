'use client';

import Link from 'next/link';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

export interface TodayItem {
  id: string;
  label: string;
  meta?: string;
  href: string;
  kind: 'meeting' | 'task' | 'followup' | 'post' | 'deadline';
}

interface TodayPanelProps {
  items: TodayItem[];
  className?: string;
}

const KIND_LABEL: Record<TodayItem['kind'], string> = {
  meeting: 'Meeting',
  task: 'Task',
  followup: 'Follow-up',
  post: 'Post',
  deadline: 'Deadline',
};

export function TodayPanel({ items, className }: TodayPanelProps) {
  return (
    <aside className={cn(WORKSPACE.panel.base, 'p-4 md:p-5', className)}>
      <h2 className={WORKSPACE.typography.sectionTitle}>Today</h2>
      <p className="mt-1 text-sm text-[var(--ws-text-muted)]">Meetings, tasks, and deadlines.</p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ws-text-secondary)]">Your day is clear.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.slice(0, 8).map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="block rounded-[10px] px-2.5 py-2 hover:bg-[var(--ws-hover)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--ws-text-muted)]">
                    {KIND_LABEL[item.kind]}
                  </span>
                  {item.meta ? (
                    <span className="text-[11px] text-[var(--ws-text-muted)] tabular-nums">{item.meta}</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm font-medium text-[var(--ws-text-primary)] line-clamp-2">
                  {item.label}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
