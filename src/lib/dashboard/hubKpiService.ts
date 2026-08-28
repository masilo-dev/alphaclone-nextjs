import type { SupabaseClient } from '@supabase/supabase-js';
import { dashboardStatsService } from '@/services/dashboardStatsService';
import {
  type HubKpiId,
  type SlimHubStats,
  slimHubStats,
} from '@/lib/dashboard/hubKpi';
import { getStatsCache, setStatsCache } from '@/lib/dashboard/statsCache';

const HUB_SERVICE: Record<
  HubKpiId,
  (supabase: SupabaseClient, tenantId: string) => Promise<{ metrics: SlimHubStats['metrics']; mainChart: SlimHubStats['mainChart'] }>
> = {
  overview: async (supabase, tenantId) => {
    const full = await dashboardStatsService.getOverviewStats(supabase, tenantId);
    return slimHubStats(full, 4);
  },
  crm: async (supabase, tenantId) => {
    const full = await dashboardStatsService.getCrmStats(supabase, tenantId);
    return slimHubStats(full, 4);
  },
  outreach: async (supabase, tenantId) => {
    const full = await dashboardStatsService.getOutreachStats(supabase, tenantId);
    return slimHubStats(full, 4);
  },
  invoicing: async (supabase, tenantId) => {
    const full = await dashboardStatsService.getInvoicesStats(supabase, tenantId);
    return slimHubStats(full, 4);
  },
  contracts: async (supabase, tenantId) => {
    const full = await dashboardStatsService.getContractsStats(supabase, tenantId);
    return slimHubStats(full, 4);
  },
  projects: async (supabase, tenantId) => {
    const full = await dashboardStatsService.getProjectsStats(supabase, tenantId);
    return slimHubStats(full, 4);
  },
  social: async (supabase, tenantId) => {
    const full = await dashboardStatsService.getSocialStats(supabase, tenantId);
    return slimHubStats(full, 4);
  },
};

export async function getHubKpiStats(
  supabase: SupabaseClient,
  tenantId: string,
  hub: HubKpiId,
  period: string = 'last_30_days',
): Promise<SlimHubStats> {
  const cacheKey = `hub-kpi:${hub}:${tenantId}:${period}`;
  const cached = getStatsCache<SlimHubStats>(cacheKey);
  if (cached) return cached;

  const loader = HUB_SERVICE[hub];
  const stats = await loader(supabase, tenantId);
  setStatsCache(cacheKey, stats);
  return stats;
}
