import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getHubKpiStats } from '@/lib/dashboard/hubKpiService';
import type { HubKpiId } from '@/lib/dashboard/hubKpi';
import {
  resolveMetricDateRange,
  type MetricPeriodPreset,
} from '@/lib/metrics/dateRange';

const VALID_HUBS = new Set<HubKpiId>([
  'overview',
  'crm',
  'outreach',
  'invoicing',
  'contracts',
  'projects',
  'social',
  'deals',
  'tasks',
  'quotes',
  'leads',
  'calendar',
  'accounting',
  'campaigns',
]);

const VALID_PERIODS = new Set<MetricPeriodPreset>([
  'today',
  'last_7_days',
  'last_30_days',
  'this_month',
  'previous_month',
  'this_quarter',
  'this_year',
]);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const hub = request.nextUrl.searchParams.get('hub') as HubKpiId | null;
    const periodRaw = request.nextUrl.searchParams.get('period') ?? 'last_30_days';
    const period = VALID_PERIODS.has(periodRaw as MetricPeriodPreset)
      ? (periodRaw as MetricPeriodPreset)
      : 'last_30_days';

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }
    if (!hub || !VALID_HUBS.has(hub)) {
      return NextResponse.json({ error: 'Invalid hub' }, { status: 400 });
    }

    const { admin: supabase } = await requireTenantAccess(tenantId);
    const range = resolveMetricDateRange(period);
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
      {
        headers: {
          'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load hub stats');
  }
}
