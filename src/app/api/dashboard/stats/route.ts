import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { normalizeDashboardStats } from '@/lib/analytics/normalizeDashboardStats';
import { requireTenantAccess } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { dashboardStatsService } from '@/services/dashboardStatsService';
import {
  type MetricPeriodPreset,
} from '@/lib/metrics/dateRange';

const VALID_PERIODS = new Set<MetricPeriodPreset>([
  'today',
  'last_7_days',
  'last_30_days',
  'this_month',
  'previous_month',
  'this_quarter',
  'this_year',
]);

function isTransientDatabaseFailure(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  const code = candidate?.code ?? '';
  const message = candidate?.message?.toLowerCase() ?? '';
  return (
    code === 'PGRST002' ||
    code === 'PGRST003' ||
    code === '57014' ||
    message.includes('statement timeout') ||
    message.includes('schema cache') ||
    message.includes('timed out waiting for a connection')
  );
}

function parsePeriod(request: NextRequest): MetricPeriodPreset {
  const periodRaw = request.nextUrl.searchParams.get('period') ?? 'last_30_days';
  return VALID_PERIODS.has(periodRaw as MetricPeriodPreset)
    ? (periodRaw as MetricPeriodPreset)
    : 'last_30_days';
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    // Shared auth validates both bearer/cookie sessions and active tenant membership.
    // A membership lookup outage is availability failure, not proof of forbidden access.
    const { supabase, user } = await requireTenantAccess(tenantId, req);

    // ── Try the optimised consolidated RPC first ──────────────────────────
    let stats: Record<string, any> | null = null;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_consolidated_dashboard_stats',
        { p_tenant_id: tenantId, p_user_id: user.id }
      );

      if (rpcError) {
        if (isTransientDatabaseFailure(rpcError)) {
          console.warn('[dashboard/stats] transient database failure; refusing fallback fan-out:', rpcError.message);
          return NextResponse.json(
            { error: 'Dashboard data is temporarily unavailable. Please retry shortly.' },
            { status: 503, headers: { 'Retry-After': '2' } },
          );
        }
        throw rpcError;
      } else if (rpcData) {
        // Hydrate totalMessages separately (not in RPC)
        let totalMessages = 0;
        const { count: msgCount, error: messageError } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
        if (messageError) throw messageError;
        if (typeof msgCount === 'number') totalMessages = msgCount;

        stats = { ...rpcData, totalMessages };
      }
    } catch (rpcException) {
      if (isTransientDatabaseFailure(rpcException)) {
        console.warn('[dashboard/stats] transient database exception; refusing fallback fan-out:', rpcException);
        return NextResponse.json(
          { error: 'Dashboard data is temporarily unavailable. Please retry shortly.' },
          { status: 503, headers: { 'Retry-After': '2' } },
        );
      }
      throw rpcException;
    }

    // ── Fallback: direct table queries ────────────────────────────────────
    if (!stats) {
      return NextResponse.json({ error: 'Dashboard statistics are unavailable. Please retry shortly.' }, { status: 503, headers: { 'Retry-After': '2' } });
    }

    const period = parsePeriod(req);

    try {
      const admin = createSupabaseAdminClient();
      const periodMetrics = await dashboardStatsService.getHomePeriodMetrics(
        admin,
        tenantId,
        period,
      );
      stats = {
        ...stats,
        revenue: periodMetrics.revenue,
        totalRevenue: periodMetrics.revenue,
        revenuePrev: periodMetrics.revenuePrev,
        previousRevenue: periodMetrics.revenuePrev,
        newLeads: periodMetrics.newLeads,
        leadsPrev: periodMetrics.leadsPrev,
        previousLeads: periodMetrics.leadsPrev,
        dealsWon: periodMetrics.dealsWon,
        dealsWonPrev: periodMetrics.dealsWonPrev,
        previousDealsWon: periodMetrics.dealsWonPrev,
        outstanding: periodMetrics.outstanding,
        outstandingPrev: periodMetrics.outstandingPrev,
        pendingRevenue: periodMetrics.outstanding,
        overdueInvoices: periodMetrics.overdueInvoices,
        periodPreset: period,
        comparisonLabel: periodMetrics.comparisonLabel,
      };
    } catch (periodError) {
      console.warn('[dashboard/stats] Period overlay failed:', periodError);
      return NextResponse.json({ error: 'Dashboard period metrics are unavailable. Please retry shortly.' }, { status: 503, headers: { 'Retry-After': '2' } });
    }

    return NextResponse.json({ stats: normalizeDashboardStats(stats) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'dashboard/stats.GET' });
  }
}
