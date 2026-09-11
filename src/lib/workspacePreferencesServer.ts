import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_DASHBOARD_HOME_LAYOUT,
  DEFAULT_EXECUTIVE_KPI_GOALS,
  type DashboardHomeLayout,
  type ExecutiveKpiGoals,
  type PeriodClosePreferences,
  type WorkspacePreferencesResponse,
} from '@/types/workspacePreferences';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseExecutiveKpiGoals(raw: unknown): ExecutiveKpiGoals {
  if (!isRecord(raw)) return { ...DEFAULT_EXECUTIVE_KPI_GOALS };

  const legacyDeals = typeof raw.deals === 'number' ? raw.deals : undefined;

  return {
    revenue: typeof raw.revenue === 'number' ? raw.revenue : DEFAULT_EXECUTIVE_KPI_GOALS.revenue,
    clients: typeof raw.clients === 'number' ? raw.clients : DEFAULT_EXECUTIVE_KPI_GOALS.clients,
    projects:
      typeof raw.projects === 'number'
        ? raw.projects
        : legacyDeals ?? DEFAULT_EXECUTIVE_KPI_GOALS.projects,
  };
}

export function parsePeriodClosePreferences(raw: unknown): PeriodClosePreferences {
  if (!isRecord(raw)) return {};

  const result: PeriodClosePreferences = {};
  for (const [periodId, entry] of Object.entries(raw)) {
    if (!isRecord(entry) || !isRecord(entry.checked)) continue;
    const checked: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(entry.checked)) {
      if (typeof value === 'boolean') checked[key] = value;
    }
    result[periodId] = {
      checked,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined,
      updatedBy: typeof entry.updatedBy === 'string' ? entry.updatedBy : undefined,
    };
  }
  return result;
}

export function parseDashboardHomeLayout(raw: unknown): DashboardHomeLayout {
  return raw === 'attention_first' ? 'attention_first' : DEFAULT_DASHBOARD_HOME_LAYOUT;
}

export async function loadWorkspacePreferences(
  admin: SupabaseClient,
  tenantId: string,
): Promise<WorkspacePreferencesResponse> {
  const { data, error } = await admin
    .from('business_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;

  const settings = isRecord(data?.settings) ? data.settings : {};

  return {
    periodClose: parsePeriodClosePreferences(settings.period_close),
    executiveKpiGoals: parseExecutiveKpiGoals(settings.executive_kpi_goals),
    dashboardHomeLayout: parseDashboardHomeLayout(settings.dashboard_home_layout),
  };
}

export async function patchWorkspacePreferences(
  admin: SupabaseClient,
  tenantId: string,
  actorUserId: string,
  patch: {
    periodClose?: { periodId: string; checked: Record<string, boolean> };
    executiveKpiGoals?: ExecutiveKpiGoals;
    dashboardHomeLayout?: DashboardHomeLayout;
  },
): Promise<WorkspacePreferencesResponse> {
  const { data: existing, error: loadError } = await admin
    .from('business_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (loadError) throw loadError;

  const currentSettings = isRecord(existing?.settings) ? { ...existing.settings } : {};
  const now = new Date().toISOString();

  if (patch.periodClose) {
    const periodClose = parsePeriodClosePreferences(currentSettings.period_close);
    periodClose[patch.periodClose.periodId] = {
      checked: patch.periodClose.checked,
      updatedAt: now,
      updatedBy: actorUserId,
    };
    currentSettings.period_close = periodClose;
  }

  if (patch.executiveKpiGoals) {
    currentSettings.executive_kpi_goals = patch.executiveKpiGoals;
  }

  if (patch.dashboardHomeLayout) {
    currentSettings.dashboard_home_layout = patch.dashboardHomeLayout;
  }

  const { error: upsertError } = await admin.from('business_settings').upsert(
    {
      tenant_id: tenantId,
      settings: currentSettings,
      updated_at: now,
    },
    { onConflict: 'tenant_id' },
  );

  if (upsertError) throw upsertError;

  return {
    periodClose: parsePeriodClosePreferences(currentSettings.period_close),
    executiveKpiGoals: parseExecutiveKpiGoals(currentSettings.executive_kpi_goals),
    dashboardHomeLayout: parseDashboardHomeLayout(currentSettings.dashboard_home_layout),
  };
}
