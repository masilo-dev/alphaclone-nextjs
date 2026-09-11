import type { SupabaseClient } from '@supabase/supabase-js';
import { dashboardStatsService } from '@/services/dashboardStatsService';
import { extendedHubStats } from '@/lib/dashboard/extendedHubStats';
import { type HubKpiId, type SlimHubStats } from '@/lib/dashboard/hubKpi';
import { getStatsCache, setStatsCache } from '@/lib/dashboard/statsCache';
import type { MetricPeriodPreset } from '@/lib/metrics/dateRange';

type HubLoader = (
  supabase: SupabaseClient,
  tenantId: string,
  period: MetricPeriodPreset,
) => Promise<SlimHubStats>;

const HUB_SERVICE: Record<HubKpiId, HubLoader> = {
  overview: (supabase, tenantId, period) =>
    dashboardStatsService.getOverviewStats(supabase, tenantId, period),
  crm: (supabase, tenantId, period) =>
    dashboardStatsService.getCrmStats(supabase, tenantId, period),
  outreach: (supabase, tenantId, period) =>
    dashboardStatsService.getOutreachStats(supabase, tenantId, period),
  invoicing: (supabase, tenantId, period) =>
    dashboardStatsService.getInvoicesStats(supabase, tenantId, period),
  contracts: (supabase, tenantId, period) =>
    dashboardStatsService.getContractsStats(supabase, tenantId, period),
  projects: (supabase, tenantId, period) =>
    dashboardStatsService.getProjectsStats(supabase, tenantId, period),
  social: (supabase, tenantId, period) =>
    dashboardStatsService.getSocialStats(supabase, tenantId, period),
  deals: (supabase, tenantId, period) =>
    extendedHubStats.getDealsStats(supabase, tenantId, period),
  tasks: (supabase, tenantId, period) =>
    extendedHubStats.getTasksStats(supabase, tenantId, period),
  quotes: (supabase, tenantId, period) =>
    extendedHubStats.getQuotesStats(supabase, tenantId, period),
  leads: (supabase, tenantId, period) =>
    extendedHubStats.getLeadsStats(supabase, tenantId, period),
  calendar: (supabase, tenantId, period) =>
    extendedHubStats.getCalendarStats(supabase, tenantId, period),
  accounting: (supabase, tenantId, period) =>
    extendedHubStats.getAccountingStats(supabase, tenantId, period),
  campaigns: (supabase, tenantId, period) =>
    extendedHubStats.getCampaignsStats(supabase, tenantId, period),
};

export async function getHubKpiStats(
  supabase: SupabaseClient,
  tenantId: string,
  hub: HubKpiId,
  period: MetricPeriodPreset = 'last_30_days',
): Promise<SlimHubStats> {
  const cacheKey = `hub-kpi:${hub}:${tenantId}:${period}`;
  const cached = getStatsCache<SlimHubStats>(cacheKey);
  if (cached) return cached;

  const loader = HUB_SERVICE[hub];
  const stats = await loader(supabase, tenantId, period);
  setStatsCache(cacheKey, stats);
  return stats;
}
