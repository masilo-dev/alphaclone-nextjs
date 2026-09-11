'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CRMActionChipItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'indigo' | 'teal' | 'emerald' | 'amber' | 'slate';
}

const TONE_STYLES: Record<NonNullable<CRMActionChipItem['tone']>, string> = {
  indigo: 'border-violet-500/30 bg-violet-500/10 text-violet-200 hover:border-violet-400/40 hover:bg-violet-500/15',
  teal: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400/40 hover:bg-cyan-500/15',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/40 hover:bg-emerald-500/15',
  amber: 'border-orange-500/30 bg-orange-500/10 text-orange-200 hover:border-orange-400/40 hover:bg-orange-500/15',
  slate: 'border-white/5 bg-slate-900/70 text-slate-300 hover:border-slate-600/40 hover:bg-slate-800',
};

export function CRMActionChips({ items, className }: { items: CRMActionChipItem[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
            className={cn(
              'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50',
              TONE_STYLES[item.tone || 'slate']
            )}
          >
            <Icon className="h-3 w-3 shrink-0" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
