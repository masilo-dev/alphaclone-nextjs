import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { normalizeDashboardStats } from '@/lib/analytics/normalizeDashboardStats';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { dashboardStatsService } from '@/services/dashboardStatsService';
import {
  resolveMetricDateRange,
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

function parsePeriod(request: NextRequest): MetricPeriodPreset {
  const periodRaw = request.nextUrl.searchParams.get('period') ?? 'last_30_days';
  return VALID_PERIODS.has(periodRaw as MetricPeriodPreset)
    ? (periodRaw as MetricPeriodPreset)
    : 'last_30_days';
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;

/**
 * Direct-query fallback: runs when the consolidated RPC fails (e.g. type errors, missing function).
 * Queries tables individually in parallel — returns the same shape as the RPC.
 */
async function getStatsFallback(supabase: any, tenantId: string, userId: string) {
  const safeCount = async (table: string, filters: Record<string, any> = {}) => {
    try {
      let q = supabase.from(table).select('id', { count: 'exact', head: true });
      for (const [k, v] of Object.entries(filters)) {
        if (v === null) q = q.is(k, null);
        else q = q.eq(k, v);
      }
      const { count, error } = await q;
      if (error) return 0;
      return typeof count === 'number' ? count : 0;
    } catch { return 0; }
  };

  const safeSum = async (table: string, column: string, filters: Record<string, any> = {}) => {
    try {
      let q = supabase.from(table).select(column).eq('tenant_id', tenantId);
      for (const [k, v] of Object.entries(filters)) {
        q = q.eq(k, v);
      }
      const { data, error } = await q;
      if (error || !data) return 0;
      return data.reduce((acc: number, row: any) => acc + Number(row[column] || 0), 0);
    } catch { return 0; }
  };

  const safeRows = async (table: string, select: string, filters: Record<string, any> = {}, limit = 5) => {
    try {
      let q = supabase.from(table).select(select).eq('tenant_id', tenantId);
      for (const [k, v] of Object.entries(filters)) {
        q = q.eq(k, v);
      }
      const { data } = await q.order('created_at', { ascending: false }).limit(limit);
      return data || [];
    } catch { return []; }
  };

  // Run all queries in parallel
  const [
    totalLeads,
    clientCount,
    activeProjects,
    totalTasks,
    completedTasks,
    totalMessages,
    unreadMessages,
    paidRevenue,
    pendingRevenue,
    overdueInvoices,
    pendingInvoices,
    activeCampaigns,
    upcomingMeetings,
    activity24h,
    newLeads24h,
    recentActivityRows,
    staleLeadsCount,
    qualifiedLeadsCount,
  ] = await Promise.all([
    safeCount('leads', { tenant_id: tenantId }),
    safeCount('business_clients', { tenant_id: tenantId, is_active: true }),
    // active projects = not done/cancelled — use .in() to avoid enum empty-string comparison
    (async () => {
      try {
        const { count } = await supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['planning', 'active', 'in_progress', 'on_hold', 'review', 'pending']);
        return typeof count === 'number' ? count : 0;
      } catch { return 0; }
    })(),
    safeCount('tasks', { tenant_id: tenantId }),
    (async () => {
      try {
        const { count } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'completed');
        return typeof count === 'number' ? count : 0;
      } catch { return 0; }
    })(),
    safeCount('messages', { tenant_id: tenantId }),
    (async () => {
      try {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is('read_at', null);
        return typeof count === 'number' ? count : 0;
      } catch { return 0; }
    })(),
    // 1. Paid Revenue (from General Ledger)
    (async () => {
      try {
        const { data, error } = await supabase
          .from('journal_entry_lines')
          .select(`
            debit_amount,
            credit_amount,
            account:account_id (
              account_type,
              normal_balance
            )
          `)
          .eq('tenant_id', tenantId)
          .innerJoin('journal_entries', 'entry_id', 'id')
          .filter('journal_entries.status', 'eq', 'posted')
          .filter('journal_entries.voided_at', 'is', null)
          .in('account.account_type', ['revenue', 'other_income']);

        if (error || !data) return 0;
        
        return data.reduce((acc: number, row: any) => {
          const isDebit = row.account.normal_balance === 'debit';
          const amount = isDebit 
            ? (row.debit_amount - row.credit_amount)
            : (row.credit_amount - row.debit_amount);
          return acc + amount;
        }, 0);
      } catch {
        // Fallback to business_invoices if accounting tables fail
        return safeSum('business_invoices', 'total', { status: 'paid' });
      }
    })(),
    // 2. Pending Revenue (from Invoices)
    (async () => {
      try {
        const { data } = await supabase
          .from('business_invoices')
          .select('total')
          .eq('tenant_id', tenantId)
          .in('status', ['sent', 'overdue']);
        if (!data) return 0;
        return data.reduce((acc: number, r: any) => acc + Number(r.total || 0), 0);
      } catch { return 0; }
    })(),
    (async () => {
      try {
        const { count } = await supabase
          .from('business_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'overdue');
        return typeof count === 'number' ? count : 0;
      } catch { return 0; }
    })(),
    (async () => {
      try {
        const { count } = await supabase
          .from('business_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'sent');
        return typeof count === 'number' ? count : 0;
      } catch { return 0; }
    })(),
    (async () => {
      try {
        const { count } = await supabase
          .from('email_campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['scheduled', 'sending']);
        return typeof count === 'number' ? count : 0;
      } catch { return 0; }
    })(),
    (async () => {
      try {
        const { count } = await supabase
          .from('calendar_events')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gt('start_time', new Date().toISOString());
        return typeof count === 'number' ? count : 0;
      } catch { return 0; }
    })(),
    (async () => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', since);
        return typeof count === 'number' ? count : 0;
      } catch { return 0; }
    })(),
    (async () => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', since);
        return typeof count === 'number' ? count : 0;
      } catch { return 0; }
    })(),
    safeRows('audit_logs', 'action,metadata,created_at'),
    (async () => {
      try {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .lt('created_at', cutoff)
          .not('status', 'in', '("closed_won","closed_lost","won","lost")');
        return typeof count === 'number' ? count : 0;
      } catch {
        try {
          const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .lt('created_at', cutoff);
          return typeof count === 'number' ? count : 0;
        } catch {
          return 0;
        }
      }
    })(),
    (async () => {
      try {
        const { count } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('stage', ['qualified', 'proposal', 'negotiation', 'discovery', 'contacted', 'engaged']);
        return typeof count === 'number' ? count : 0;
      } catch {
        try {
          const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'qualified');
          return typeof count === 'number' ? count : 0;
        } catch {
          return 0;
        }
      }
    })(),
  ]);

  const recentActivity = recentActivityRows.map((r: any) => ({
    type: r.action,
    title: r.metadata?.clientName || r.action,
    date: r.created_at,
  }));

  const momentumScore = Math.min(100, activity24h * 5 + newLeads24h * 10);

  return {
    totalRevenue: paidRevenue,
    pendingRevenue,
    pendingInvoices,
    overdueInvoices,
    activeProjects,
    totalLeads,
    clientCount,
    weightedPipeline: 0,
    salesForecast: 0,
    totalWonValue: 0,
    recentActivity,
    pipeline: {},
    momentumScore,
    loginStreak: 1,
    activity24h,
    newLeads24h,
    staleLeads: staleLeadsCount,
    qualifiedLeads: qualifiedLeadsCount,
    activeCampaigns,
    upcomingMeetings,
    unreadMessages,
    totalTasks,
    completedTasks,
    totalMessages,
    serverTime: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { data: member, error: membershipError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Try the optimised consolidated RPC first ──────────────────────────
    let stats: Record<string, any> | null = null;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_consolidated_dashboard_stats',
        { p_tenant_id: tenantId, p_user_id: user.id }
      );

      if (rpcError) {
        console.warn('[dashboard/stats] RPC failed, using direct-query fallback:', rpcError.message);
      } else if (rpcData) {
        // Hydrate totalMessages separately (not in RPC)
        let totalMessages = 0;
        const { count: msgCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
        if (typeof msgCount === 'number') totalMessages = msgCount;

        stats = { ...rpcData, totalMessages };
      }
    } catch (rpcException) {
      console.warn('[dashboard/stats] RPC threw exception, falling back:', rpcException);
    }

    // ── Fallback: direct table queries ────────────────────────────────────
    if (!stats) {
      console.info('[dashboard/stats] Running direct-query fallback for tenant:', tenantId);
      stats = await getStatsFallback(supabase, tenantId, user.id);
    }

    const period = parsePeriod(req);
    const range = resolveMetricDateRange(period);
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
      stats = { ...stats, comparisonLabel: range.comparisonLabel, periodPreset: period };
    }

    return NextResponse.json({ stats: normalizeDashboardStats(stats) });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'dashboard/stats.GET' });
  }
}
