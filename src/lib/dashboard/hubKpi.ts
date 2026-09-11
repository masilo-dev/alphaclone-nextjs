import type { DashboardStatsResponse, OverviewStatsResponse } from '@/types/dashboardStats';

export type HubKpiId =
  | 'overview'
  | 'crm'
  | 'outreach'
  | 'invoicing'
  | 'contracts'
  | 'projects'
  | 'social'
  | 'deals'
  | 'tasks'
  | 'quotes'
  | 'leads'
  | 'calendar'
  | 'accounting'
  | 'campaigns';

/** Full hub payload — nothing trimmed for module overview screens. */
export type SlimHubStats = OverviewStatsResponse;

export const ENDPOINT_TO_HUB: Record<string, HubKpiId> = {
  '/api/dashboard/overview': 'overview',
  '/api/crm/stats': 'crm',
  '/api/outreach/stats': 'outreach',
  '/api/invoices/stats': 'invoicing',
  '/api/contracts/stats': 'contracts',
  '/api/projects/stats': 'projects',
  '/api/social/stats': 'social',
  '/api/deals/stats': 'deals',
  '/api/tasks/stats': 'tasks',
  '/api/quotes/stats': 'quotes',
  '/api/leads/stats': 'leads',
  '/api/calendar/stats': 'calendar',
  '/api/accounting/stats': 'accounting',
  '/api/campaigns/stats': 'campaigns',
};

export const HUB_TO_ENDPOINT: Record<HubKpiId, string> = {
  overview: '/api/dashboard/overview',
  crm: '/api/crm/stats',
  outreach: '/api/outreach/stats',
  invoicing: '/api/invoices/stats',
  contracts: '/api/contracts/stats',
  projects: '/api/projects/stats',
  social: '/api/social/stats',
  deals: '/api/deals/stats',
  tasks: '/api/tasks/stats',
  quotes: '/api/quotes/stats',
  leads: '/api/leads/stats',
  calendar: '/api/calendar/stats',
  accounting: '/api/accounting/stats',
  campaigns: '/api/campaigns/stats',
};

export function resolveHubFromEndpoint(endpoint: string): HubKpiId | null {
  return ENDPOINT_TO_HUB[endpoint] ?? null;
}

export function fullHubStats(full: DashboardStatsResponse): OverviewStatsResponse {
  const overview = full as OverviewStatsResponse;
  return {
    ...full,
    metricsRowB: overview.metricsRowB,
    platformHealth: overview.platformHealth ?? overview.pills,
  };
}

/** @deprecated Use fullHubStats — module overviews now show the complete payload. */
export function slimHubStats(full: DashboardStatsResponse, _maxMetrics?: number): OverviewStatsResponse {
  return fullHubStats(full);
}

export function formatRpcMetricValue(value: unknown): string | number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return 0;
}

export function normalizeRpcHubStats(raw: unknown): SlimHubStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as {
    metrics?: unknown;
    mainChart?: unknown;
    breakdown?: unknown;
    donut?: unknown;
    pills?: unknown;
    feed?: unknown;
    metricsRowB?: unknown;
    platformHealth?: unknown;
  };
  if (!Array.isArray(obj.metrics) || !Array.isArray(obj.mainChart)) return null;

  const mapMetric = (m: Record<string, unknown>) => ({
    label: String(m.label ?? ''),
    value: formatRpcMetricValue(m.value),
    delta: m.delta ? String(m.delta) : undefined,
    deltaDir: m.deltaDir as 'up' | 'down' | undefined,
    deltaColor: m.deltaColor as 'green' | 'amber' | 'red' | 'blue' | undefined,
    comparisonText: m.comparisonText ? String(m.comparisonText) : undefined,
  });

  const mapBreakdown = (items: unknown) =>
    Array.isArray(items)
      ? items.map((item: Record<string, unknown>) => ({
          label: String(item.label ?? ''),
          value: Number(item.value ?? 0),
          color: String(item.color ?? '#94a3b8'),
        }))
      : [];

  const mapFeed = (items: unknown) =>
    Array.isArray(items)
      ? items.map((item: Record<string, unknown>) => ({
          dot: String(item.dot ?? '#94a3b8'),
          text: String(item.text ?? ''),
          time: String(item.time ?? ''),
        }))
      : [];

  return {
    metrics: obj.metrics.map(mapMetric),
    mainChart: obj.mainChart.map((p: Record<string, unknown>) => ({
      label: String(p.label ?? ''),
      value: Number(p.value ?? 0),
      value2: p.value2 != null ? Number(p.value2) : undefined,
    })),
    breakdown: mapBreakdown(obj.breakdown),
    donut: mapBreakdown(obj.donut),
    pills: mapBreakdown(obj.pills),
    feed: mapFeed(obj.feed),
    metricsRowB: Array.isArray(obj.metricsRowB) ? obj.metricsRowB.map(mapMetric) : undefined,
    platformHealth: Array.isArray(obj.platformHealth) ? mapBreakdown(obj.platformHealth) : undefined,
  };
}
