'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { platformKpiFromModuleStat } from '@/lib/metrics/metricPresentation';
import { PlatformKpiGrid } from '@/components/dashboard/metrics/PlatformKpiGrid';

export type StatAccent = 'teal' | 'blue' | 'purple' | 'emerald' | 'orange' | 'rose' | 'amber' | 'sky';

export interface ModuleStat {
  label: string;
  value: string | number;
  sub?: string;
  Icon: LucideIcon;
  accent?: StatAccent;
  /** Optional percentage trend; positive renders green when higher-is-better. */
  trend?: number;
  metricId?: string;
  isBetterHigher?: boolean;
  href?: string;
}

/**
 * Enterprise KPI row using the canonical PlatformKpiCard system.
 */
export function ModuleStatCards({
  stats,
  className = '',
  loading = false,
}: {
  stats: ModuleStat[];
  className?: string;
  loading?: boolean;
}) {
  const items = stats.map((s) => ({
    ...platformKpiFromModuleStat({
      label: s.label,
      value: s.value,
      sub: s.sub,
      trend: s.trend,
      metricId: s.metricId,
      isBetterHigher: s.isBetterHigher,
      href: s.href,
    }),
  }));

  return (
    <PlatformKpiGrid
      items={items}
      loading={loading}
      skeletonCount={Math.min(stats.length || 4, 8)}
      className={cn('space-y-0', className)}
    />
  );
}
