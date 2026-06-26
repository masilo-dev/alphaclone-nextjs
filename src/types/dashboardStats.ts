export type DeltaColor = 'green' | 'amber' | 'red' | 'blue';
export type DeltaDir = 'up' | 'down';

export interface DashboardMetric {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: DeltaDir;
  deltaColor?: DeltaColor;
}

export interface DashboardChartPoint {
  label: string;
  value: number;
  value2?: number;
}

export interface DashboardBreakdownItem {
  label: string;
  value: number;
  color: string;
}

export interface DashboardDonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DashboardPill {
  label: string;
  value: number;
  color: string;
}

export interface DashboardFeedItem {
  dot: string;
  text: string;
  time: string;
}

export interface DashboardStatsResponse {
  metrics: DashboardMetric[];
  mainChart: DashboardChartPoint[];
  breakdown: DashboardBreakdownItem[];
  donut: DashboardDonutSegment[];
  pills: DashboardPill[];
  feed: DashboardFeedItem[];
}

export interface OverviewStatsResponse extends DashboardStatsResponse {
  metricsRowB?: DashboardMetric[];
  platformHealth?: DashboardPill[];
}

export const DASHBOARD_COLORS = {
  green: '#639922',
  greenBg: '#EAF3DE',
  amber: '#EF9F27',
  amberBg: '#FAEEDA',
  red: '#E24B4A',
  redBg: '#FCEBEB',
  blue: '#378ADD',
  blueBg: '#E6F1FB',
} as const;

export const MODULE_COLORS: Record<string, string> = {
  crm: DASHBOARD_COLORS.blue,
  outreach: DASHBOARD_COLORS.amber,
  invoicing: DASHBOARD_COLORS.green,
  contracts: DASHBOARD_COLORS.blue,
  projects: DASHBOARD_COLORS.amber,
  social: DASHBOARD_COLORS.red,
};
