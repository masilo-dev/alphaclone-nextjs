import type { SupabaseClient } from '@supabase/supabase-js';

export const EXECUTION_FEATURE_FLAGS = [
  'PROJECTS_V2',
  'LISTMONK_ENABLED',
  'PENPOT_ENABLED',
  'CLIENT_APPROVALS_ENABLED',
  'PROJECT_AUTOMATION_ENABLED',
] as const;

export type ExecutionFeatureFlag = (typeof EXECUTION_FEATURE_FLAGS)[number];

const SAFE_DEFAULTS: Record<ExecutionFeatureFlag, boolean> = {
  PROJECTS_V2: false,
  LISTMONK_ENABLED: false,
  PENPOT_ENABLED: false,
  CLIENT_APPROVALS_ENABLED: false,
  PROJECT_AUTOMATION_ENABLED: false,
};

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return null;
}

export function getEnvironmentFeatureFlag(flag: ExecutionFeatureFlag): boolean {
  return parseBoolean(process.env[flag]) ?? SAFE_DEFAULTS[flag];
}

/**
 * Resolve a rollout flag with fail-closed semantics.
 * Precedence: tenant DB override -> global DB override -> tenant metadata -> environment -> safe default.
 * A DB/read failure never enables a feature.
 */
export async function isExecutionFeatureEnabled(
  supabase: SupabaseClient,
  flag: ExecutionFeatureFlag,
  tenantId?: string | null,
): Promise<boolean> {
  try {
    if (tenantId) {
      const { data: rows } = await supabase
        .from('feature_flags')
        .select('key, enabled, value, tenant_id')
        .eq('key', flag)
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .limit(10);

      const tenantRow = rows?.find((row: any) => row.tenant_id === tenantId);
      const globalRow = rows?.find((row: any) => row.tenant_id == null);
      const selected = tenantRow ?? globalRow;
      if (selected) {
        const fromEnabled = parseBoolean((selected as any).enabled);
        if (fromEnabled !== null) return fromEnabled;
        const fromValue = parseBoolean((selected as any).value);
        if (fromValue !== null) return fromValue;
      }

      const { data: tenant } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenantId)
        .maybeSingle();
      const metadataFlags = (tenant as any)?.metadata?.feature_flags;
      const metadataValue = parseBoolean(metadataFlags?.[flag]);
      if (metadataValue !== null) return metadataValue;
    }
  } catch {
    // Fail closed. External/experimental features must never become enabled because flag lookup failed.
  }

  return getEnvironmentFeatureFlag(flag);
}

export function getExecutionFeatureDefaults(): Record<ExecutionFeatureFlag, boolean> {
  return { ...SAFE_DEFAULTS };
}
