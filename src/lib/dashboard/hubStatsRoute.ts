import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getHubKpiStats } from '@/lib/dashboard/hubKpiService';
import type { HubKpiId } from '@/lib/dashboard/hubKpi';
import {
  resolveMetricDateRange,
  type MetricPeriodPreset,
} from '@/lib/metrics/dateRange';

const CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
};

const VALID_PERIODS = new Set<MetricPeriodPreset>([
  'today',
  'last_7_days',
  'last_30_days',
  'this_month',
  'previous_month',
  'this_quarter',
  'this_year',
]);

function parsePeriod(request: NextRequest): MetricPeriodPreset {
  const periodRaw = request.nextUrl.searchParams.get('period') ?? 'last_30_days';
  return VALID_PERIODS.has(periodRaw as MetricPeriodPreset)
    ? (periodRaw as MetricPeriodPreset)
    : 'last_30_days';
}

export async function respondWithHubStats(
  request: NextRequest,
  hub: HubKpiId,
  errorMessage: string,
) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const period = parsePeriod(request);
    const range = resolveMetricDateRange(period);

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();
    const stats = await getHubKpiStats(supabase, tenantId, hub, period);

    const metrics = stats.metrics.map((m) => ({
      ...m,
      comparisonText: m.comparisonText ?? range.comparisonLabel,
    }));
    const metricsRowB = stats.metricsRowB?.map((m) => ({
      ...m,
      comparisonText: m.comparisonText ?? range.comparisonLabel,
    }));

    return NextResponse.json(
      {
        stats: { ...stats, metrics, metricsRowB },
        period: { preset: period, comparisonLabel: range.comparisonLabel },
      },
      { headers: CACHE_HEADERS },
    );
  } catch (error) {
    return routeErrorResponse(error, errorMessage);
  }
}
