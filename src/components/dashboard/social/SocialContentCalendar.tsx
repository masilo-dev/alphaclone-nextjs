'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type CalendarPost = {
  id: string;
  caption?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  status?: string;
};

type SocialContentCalendarProps = {
  mode: 'week' | 'month';
  anchor: Date;
  onAnchorChange: (next: Date) => void;
  posts: CalendarPost[];
  onSelectPost: (post: CalendarPost) => void;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function postDate(post: CalendarPost): Date | null {
  const raw = post.scheduled_at || post.published_at || post.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function SocialContentCalendar({
  mode,
  anchor,
  onAnchorChange,
  posts,
  onSelectPost,
}: SocialContentCalendarProps) {
  const days = useMemo(() => {
    if (mode === 'week') {
      const start = startOfDay(anchor);
      const day = start.getDay(); // 0 Sun
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = addDays(start, mondayOffset);
      return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const gridStart = addDays(first, -startPad);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [anchor, mode]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const post of posts) {
      const d = postDate(post);
      if (!d) continue;
      const key = startOfDay(d).toISOString();
      const list = map.get(key) || [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [posts]);

  const shift = (dir: -1 | 1) => {
    const next = new Date(anchor);
    if (mode === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    onAnchorChange(next);
  };

  const title =
    mode === 'week'
      ? `Week of ${days[0]?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="mb-4 rounded-xl border border-white/5 bg-slate-950/60 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-xs font-bold text-slate-200">{title}</p>
        <button
          type="button"
          onClick={() => shift(1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center py-1">
            {d}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 gap-1 ${mode === 'month' ? 'auto-rows-[72px]' : 'auto-rows-[96px]'}`}>
        {days.map((day) => {
          const key = startOfDay(day).toISOString();
          const dayPosts = byDay.get(key) || [];
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = startOfDay(day).getTime() === startOfDay(new Date()).getTime();
          return (
            <div
              key={key}
              className={`rounded-lg border p-1.5 overflow-hidden ${
                isToday
                  ? 'border-teal-500/40 bg-teal-500/5'
                  : 'border-white/5 bg-slate-900/40'
              } ${mode === 'month' && !inMonth ? 'opacity-40' : ''}`}
            >
              <p className="text-[10px] font-bold text-slate-400 mb-1">{day.getDate()}</p>
              <div className="space-y-0.5">
                {dayPosts.slice(0, mode === 'week' ? 4 : 2).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => onSelectPost(post)}
                    className="w-full text-left text-[9px] leading-tight truncate rounded px-1 py-0.5 bg-teal-500/15 text-teal-200 hover:bg-teal-500/25"
                    title={post.caption || 'Post'}
                  >
                    {(post.caption || 'Post').slice(0, 28)}
                  </button>
                ))}
                {dayPosts.length > (mode === 'week' ? 4 : 2) ? (
                  <p className="text-[9px] text-slate-500">+{dayPosts.length - (mode === 'week' ? 4 : 2)} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SocialContentCalendar;
