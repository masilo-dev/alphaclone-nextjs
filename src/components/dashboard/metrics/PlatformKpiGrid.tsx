'use client';

import type { ReactNode } from 'react';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { PlatformKpiCard, PlatformKpiCardSkeleton, type PlatformKpiCardProps } from './PlatformKpiCard';

interface PlatformKpiGridProps {
  items: PlatformKpiCardProps[];
  loading?: boolean;
  skeletonCount?: number;
  className?: string;
  header?: ReactNode;
}

/**
 * Responsive KPI grid: 1 col mobile, 2 tablet, 4 desktop.
 */
export function PlatformKpiGrid({
  items,
  loading = false,
  skeletonCount = 4,
  className,
  header,
}: PlatformKpiGridProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {header}
      <div
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4',
          ENTERPRISE.moduleLayout.sectionGap,
        )}
      >
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <PlatformKpiCardSkeleton key={i} />
            ))
          : items.map((item) => (
              <PlatformKpiCard key={item.metricId ?? item.label} {...item} />
            ))}
      </div>
    </div>
  );
}
