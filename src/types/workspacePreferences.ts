export const PERIOD_CLOSE_CHECKLIST_IDS = [
  'review',
  'reconcile',
  'ap',
  'ar',
  'lock',
] as const;

export type PeriodCloseChecklistId = (typeof PERIOD_CLOSE_CHECKLIST_IDS)[number];

export interface PeriodCloseChecklistEntry {
  checked: Record<string, boolean>;
  updatedAt?: string;
  updatedBy?: string;
}

/** Map of accounting period id → checklist progress */
export type PeriodClosePreferences = Record<string, PeriodCloseChecklistEntry>;

export interface ExecutiveKpiGoals {
  revenue: number;
  clients: number;
  projects: number;
}

export const DEFAULT_EXECUTIVE_KPI_GOALS: ExecutiveKpiGoals = {
  revenue: 50000,
  clients: 100,
  projects: 25,
};

/** Tenant-scoped dashboard home layout preference (stored in business_settings.settings). */
export type DashboardHomeLayout = 'operating_system' | 'attention_first';

export const DEFAULT_DASHBOARD_HOME_LAYOUT: DashboardHomeLayout = 'operating_system';

export interface WorkspacePreferencesResponse {
  periodClose: PeriodClosePreferences;
  executiveKpiGoals: ExecutiveKpiGoals;
  dashboardHomeLayout: DashboardHomeLayout;
}
