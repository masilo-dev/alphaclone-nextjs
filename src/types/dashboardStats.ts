export type DeltaColor = 'green' | 'amber' | 'red' | 'blue' | 'teal';
export type DeltaDir = 'up' | 'down';

export interface DashboardMetric {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: DeltaDir;
  deltaColor?: DeltaColor;
  /** Period comparison label, e.g. "vs last 30 days" */
  comparisonText?: string;
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
  green: '#4ade80',
  greenBg: '#EAF3DE',
  amber: '#fbbf24',
  amberBg: '#FAEEDA',
  red: '#fb7185',
  redBg: '#FCEBEB',
  blue: '#38bdf8',
  blueBg: '#E6F1FB',
  teal: '#2dd4bf',
  indigo: '#818cf8',
  violet: '#c084fc',
  slate: '#94a3b8',
} as const;

export const MODULE_COLORS: Record<string, string> = {
  crm: DASHBOARD_COLORS.blue,
  outreach: DASHBOARD_COLORS.amber,
  invoicing: DASHBOARD_COLORS.green,
  contracts: DASHBOARD_COLORS.blue,
  projects: DASHBOARD_COLORS.amber,
  social: DASHBOARD_COLORS.red,
};
