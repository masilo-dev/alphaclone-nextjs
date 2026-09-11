'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { platformKpiFromModuleStat } from '@/lib/metrics/metricPresentation';
import { PlatformKpiGrid } from '@/components/dashboard/metrics/PlatformKpiGrid';
import { ModuleRichKpiPanel } from '@/components/dashboard/metrics/ModuleRichKpiPanel';
import type { HubKpiId } from '@/lib/dashboard/hubKpi';

export type StatAccent = 'teal' | 'blue' | 'purple' | 'emerald' | 'orange' | 'rose' | 'amber' | 'sky';

export interface ModuleStat {
  label: string;
  value: string | number;
  sub?: string;
  Icon: LucideIcon;
  accent?: StatAccent;
  trend?: number;
  metricId?: string;
  isBetterHigher?: boolean;
  href?: string;
}

/**
 * Enterprise KPI row — uses rich hub stats when `hub` is set, otherwise legacy stat cards.
 */
export function ModuleStatCards({
  stats,
  hub,
  showPlatformHealth = false,
  className = '',
  loading = false,
}: {
  stats: ModuleStat[];
  hub?: HubKpiId;
  showPlatformHealth?: boolean;
  className?: string;
  loading?: boolean;
}) {
  if (hub) {
    return (
      <ModuleRichKpiPanel
        hub={hub}
        showPlatformHealth={showPlatformHealth}
        compact
        className={className}
      />
    );
  }

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
