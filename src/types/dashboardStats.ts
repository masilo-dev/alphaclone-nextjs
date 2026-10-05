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
  amber: 'var(--warning-500)',
  amberBg: '#FAEEDA',
  red: 'var(--error-500)',
  redBg: '#FCEBEB',
  blue: 'var(--info-500)',
  blueBg: '#E6F1FB',
  teal: 'var(--brand-blue-400)',
  indigo: 'var(--brand-violet-300)',
  violet: 'var(--brand-violet-400)',
  slate: 'var(--ws-text-secondary)',
} as const;

export const MODULE_COLORS: Record<string, string> = {
  crm: DASHBOARD_COLORS.blue,
  outreach: DASHBOARD_COLORS.amber,
  invoicing: DASHBOARD_COLORS.green,
  contracts: DASHBOARD_COLORS.blue,
  projects: DASHBOARD_COLORS.amber,
  social: DASHBOARD_COLORS.red,
};
