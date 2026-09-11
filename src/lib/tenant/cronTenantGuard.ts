import {
  assertCronRowTenantContext,
  quarantineTenantIsolationRow,
} from '@/lib/tenant/platformTenant';

export type CronTenantGuardResult =
  | { ok: true; tenantId: string }
  | { ok: false; quarantined: true; error: string };

/**
 * Validate tenant_id on a cron/worker row before side effects.
 * Missing tenant rows are quarantined and must not be processed.
 */
export async function guardCronTenantRow(
  row: { id?: string; tenant_id?: string | null },
  tableName: string,
  payload?: Record<string, unknown>
): Promise<CronTenantGuardResult> {
  try {
    const tenantId = assertCronRowTenantContext(row);
    return { ok: true, tenantId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'missing_tenant_id';
    console.error(`[cron/${tableName}] quarantined row ${row.id || '?'}:`, message);
    await quarantineTenantIsolationRow({
      tableName,
      recordId: row.id,
      reason: 'missing_tenant_id',
      payload: payload || undefined,
    }).catch(() => undefined);
    return { ok: false, quarantined: true, error: 'missing_tenant_id' };
  }
}

/** Filter rows, quarantining any without valid tenant_id. */
export async function partitionCronRowsByTenant<T extends { id?: string; tenant_id?: string | null }>(
  rows: T[],
  tableName: string
): Promise<{ valid: Array<T & { tenantId: string }>; quarantined: string[] }> {
  const valid: Array<T & { tenantId: string }> = [];
  const quarantined: string[] = [];

  for (const row of rows) {
    const guard = await guardCronTenantRow(row, tableName);
    if (guard.ok) {
      valid.push({ ...row, tenantId: guard.tenantId });
    } else if (row.id) {
      quarantined.push(row.id);
    }
  }

  return { valid, quarantined };
}
