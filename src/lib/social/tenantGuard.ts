/**
 * Multi-tenant guards for social (and reusable across modules).
 * Never trust client-supplied tenant_id / ownership claims without revalidation.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export class TenantIsolationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'TENANT_REQUIRED'
      | 'NOT_A_MEMBER'
      | 'CROSS_TENANT'
      | 'NOT_FOUND'
      | 'PERMISSION_DENIED' = 'CROSS_TENANT'
  ) {
    super(message);
    this.name = 'TenantIsolationError';
  }
}

/** Prefer session tenant; never let a client override an authenticated session. */
export function resolveTrustedTenantId(params: {
  sessionTenantId?: string | null;
  clientTenantId?: string | null;
}): string {
  const session = String(params.sessionTenantId || '').trim();
  if (session) return session;
  const client = String(params.clientTenantId || '').trim();
  if (!client) {
    throw new TenantIsolationError('tenant_id is required', 'TENANT_REQUIRED');
  }
  // Unscoped / legacy callers only — still require a real UUID shape
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(client)) {
    throw new TenantIsolationError('tenant_id must be a valid UUID', 'TENANT_REQUIRED');
  }
  return client;
}

export async function assertUserBelongsToTenant(
  tenantId: string,
  userId: string
): Promise<void> {
  if (!tenantId || !userId) {
    throw new TenantIsolationError('tenant_id and user_id are required', 'TENANT_REQUIRED');
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    // Some deployments use tenant_members — try once
    const retry = await admin
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle();
    if (retry.error || !retry.data) {
      throw new TenantIsolationError(
        'User is not a member of this tenant',
        'NOT_A_MEMBER'
      );
    }
    return;
  }
  if (!data) {
    throw new TenantIsolationError(
      'User is not a member of this tenant',
      'NOT_A_MEMBER'
    );
  }
}

/** Throw if a row's tenant_id does not match the active tenant. */
export function assertSameTenant(
  rowTenantId: string | null | undefined,
  activeTenantId: string,
  resource = 'resource'
): void {
  if (!rowTenantId || rowTenantId !== activeTenantId) {
    throw new TenantIsolationError(
      `${resource} not found for this tenant`,
      'NOT_FOUND'
    );
  }
}

/**
 * Load a row by id with mandatory tenant filter.
 * Returns null (or throws) instead of leaking cross-tenant existence.
 */
export async function loadTenantScopedRow<T extends Record<string, unknown>>(params: {
  table: string;
  id: string;
  tenantId: string;
  columns?: string;
  throwIfMissing?: boolean;
}): Promise<T | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from(params.table)
    .select(params.columns || '*')
    .eq('id', params.id)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data && params.throwIfMissing !== false) {
    throw new TenantIsolationError(
      `${params.table} not found for this tenant`,
      'NOT_FOUND'
    );
  }
  return (data as T) || null;
}

/** Strip secrets from objects before MCP / logs. */
export function stripSecretsForTenantBoundary<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripSecretsForTenantBoundary(v)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/token|secret|password|authorization|refresh/i.test(k)) {
      continue; // omit entirely from MCP responses
    }
    out[k] = stripSecretsForTenantBoundary(v);
  }
  return out as T;
}
