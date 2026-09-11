'use client';

import type { CSSProperties } from 'react';
import type { DeltaColor, DeltaDir } from '@/types/dashboardStats';
import { platformKpiFromDashboardMetric } from '@/lib/metrics/metricPresentation';
import {
  PlatformKpiCard,
  PlatformKpiCardSkeleton,
} from '@/components/dashboard/metrics/PlatformKpiCard';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: DeltaDir;
  deltaColor?: DeltaColor;
  comparisonText?: string;
  className?: string;
  style?: CSSProperties;
  metricId?: string;
  href?: string;
}

/** @deprecated Prefer PlatformKpiCard directly. Kept for legacy imports. */
export function MetricCard({
  label,
  value,
  delta,
  deltaDir,
  deltaColor,
  comparisonText,
  className,
  style,
  metricId,
  href,
}: MetricCardProps) {
  const model = platformKpiFromDashboardMetric(
    { label, value, delta, deltaDir, deltaColor, comparisonText },
    { metricId, href },
  );

  return (
    <div className={className} style={style}>
      <PlatformKpiCard {...model} />
    </div>
  );
}

export function MetricCardSkeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className} style={style}>
      <PlatformKpiCardSkeleton />
    </div>
  );
}
