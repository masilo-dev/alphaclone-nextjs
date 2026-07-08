import type { DashboardStatsResponse } from '@/types/dashboardStats';

export type HubKpiId =
  | 'overview'
  | 'crm'
  | 'outreach'
  | 'invoicing'
  | 'contracts'
  | 'projects'
  | 'social';

export interface SlimHubStats {
  metrics: DashboardStatsResponse['metrics'];
  mainChart: DashboardStatsResponse['mainChart'];
}

export const ENDPOINT_TO_HUB: Record<string, HubKpiId> = {
  '/api/dashboard/overview': 'overview',
  '/api/crm/stats': 'crm',
  '/api/outreach/stats': 'outreach',
  '/api/invoices/stats': 'invoicing',
  '/api/contracts/stats': 'contracts',
  '/api/projects/stats': 'projects',
  '/api/social/stats': 'social',
};

export function resolveHubFromEndpoint(endpoint: string): HubKpiId | null {
  return ENDPOINT_TO_HUB[endpoint] ?? null;
}

export function slimHubStats(full: DashboardStatsResponse, maxMetrics = 4): SlimHubStats {
  return {
    metrics: full.metrics.slice(0, maxMetrics),
    mainChart: full.mainChart ?? [],
  };
}

export function formatRpcMetricValue(value: unknown): string | number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return 0;
}

export function normalizeRpcHubStats(raw: unknown): SlimHubStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { metrics?: unknown; mainChart?: unknown };
  if (!Array.isArray(obj.metrics) || !Array.isArray(obj.mainChart)) return null;

  return {
    metrics: obj.metrics.map((m: Record<string, unknown>) => ({
      label: String(m.label ?? ''),
      value: formatRpcMetricValue(m.value),
      delta: m.delta ? String(m.delta) : undefined,
      deltaDir: m.deltaDir as 'up' | 'down' | undefined,
      deltaColor: m.deltaColor as 'green' | 'amber' | 'red' | 'blue' | undefined,
      comparisonText: m.comparisonText ? String(m.comparisonText) : undefined,
    })),
    mainChart: obj.mainChart.map((p: Record<string, unknown>) => ({
      label: String(p.label ?? ''),
      value: Number(p.value ?? 0),
      value2: p.value2 != null ? Number(p.value2) : undefined,
    })),
  };
}
