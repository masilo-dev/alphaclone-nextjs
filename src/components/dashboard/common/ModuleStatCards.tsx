'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { StandardStatCard, type CardTheme } from '@/components/ui/design-system';

export type StatAccent = 'teal' | 'blue' | 'purple' | 'emerald' | 'orange' | 'rose' | 'amber' | 'sky';

export interface ModuleStat {
  label: string;
  value: string | number;
  sub?: string;
  Icon: LucideIcon;
  accent?: StatAccent;
  /** Optional percentage trend; positive renders green, negative red. */
  trend?: number;
}

/**
 * Enterprise-structured KPI row (AlphaClone brand). Icons + metric card anatomy.
 */
export function ModuleStatCards({ stats, className = '' }: { stats: ModuleStat[]; className?: string }) {
  return (
    <div className={cn(ENTERPRISE.moduleLayout.summaryGrid, className)}>
      {stats.map((s) => {
        // Map accent to themeColor safely
        const accent = s.accent || 'teal';
        let themeColor: CardTheme = 'teal';
        if (accent === 'emerald') themeColor = 'emerald';
        else if (accent === 'blue') themeColor = 'blue';
        else if (accent === 'purple') themeColor = 'purple';
        else if (accent === 'orange') themeColor = 'orange';
        else if (accent === 'rose') themeColor = 'rose';
        else if (accent === 'amber') themeColor = 'amber';
        else if (accent === 'sky') themeColor = 'sky';

        return (
          <StandardStatCard
            key={s.label}
            label={s.label}
            value={s.value}
            comparisonText={s.sub || ''}
            icon={s.Icon}
            themeColor={themeColor}
            delta={s.trend}
            interactive={false}
          />
        );
      })}
    </div>
  );
}
