'use client';

import React from 'react';
import { WORKSPACE } from '@/constants/design';
import { DashboardPanelHeader } from './DashboardPanelHeader';
import { cn } from '@/lib/utils';

interface DashboardChartCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  accentColor?: string;
  badge?: string;
}

export function DashboardChartCard({
  children,
  className = '',
  title,
  subtitle,
  accentColor = 'var(--brand-blue-500)',
  badge = 'Live',
}: DashboardChartCardProps) {
  return (
    <div
      className={cn(
        WORKSPACE.panel.base,
        WORKSPACE.panel.padding,
        'relative min-h-[300px] overflow-hidden flex flex-col shadow-none',
        className,
      )}
      style={{
        ['--chart-accent' as string]: accentColor,
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--chart-accent) 9%, transparent), transparent 34%), var(--ws-surface-primary)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-4 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--chart-accent), transparent)' }}
        aria-hidden
      />
      <div className="mb-3 flex items-start justify-between gap-3">
        {title ? <DashboardPanelHeader title={title} subtitle={subtitle} /> : <div />}
        <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] px-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full" style={{ background: accentColor }} aria-hidden />
          {badge}
        </span>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
