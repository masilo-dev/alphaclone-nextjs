'use client';

import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useMetricDateRange } from '@/hooks/useMetricDateRange';
import { HUB_TO_ENDPOINT, type HubKpiId } from '@/lib/dashboard/hubKpi';
import { MetricDateRangeSelector, ModuleKpiRichSections } from '@/components/dashboard/metrics';
import { PlatformKpiCardSkeleton } from '@/components/dashboard/metrics/PlatformKpiCard';

interface ModuleRichKpiPanelProps {
  hub: HubKpiId;
  showPlatformHealth?: boolean;
  showDateSelector?: boolean;
  compact?: boolean;
  className?: string;
}

export function ModuleRichKpiPanel({
  hub,
  showPlatformHealth = false,
  showDateSelector = true,
  compact = false,
  className,
}: ModuleRichKpiPanelProps) {
  const { currentTenant } = useTenant();
  const { preset, setPeriod, comparisonLabel } = useMetricDateRange('last_30_days');
  const endpoint = HUB_TO_ENDPOINT[hub];
  const { data, loading, error } = useDashboardStats(currentTenant?.id, endpoint, preset);

  if (!currentTenant?.id) return null;

  if (loading && !data) {
    return (
      <div className={cn('space-y-4', className)}>
        {showDateSelector ? (
          <div className="flex justify-end">
            <MetricDateRangeSelector value={preset} onChange={setPeriod} compact />
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <PlatformKpiCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn('ac-workspace-panel p-6 text-center', className)}>
        <p className="text-sm text-[var(--ws-text-secondary)]">Could not load module metrics</p>
      </div>
    );
  }

  return (
    <div className={cn(compact ? 'space-y-3' : 'space-y-4', className)}>
      {showDateSelector ? (
        <div className="flex justify-end">
          <MetricDateRangeSelector value={preset} onChange={setPeriod} compact />
        </div>
      ) : null}
      <ModuleKpiRichSections
        data={data}
        comparisonLabel={comparisonLabel}
        showPlatformHealth={showPlatformHealth}
      />
    </div>
  );
}
