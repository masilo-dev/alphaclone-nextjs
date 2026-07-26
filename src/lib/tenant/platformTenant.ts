/**
 * Platform-wide multi-tenant helpers.
 * Alphaclone Systems is one ordinary tenant — never a global default.
 *
 * Every module (CRM, finance, documents, email, social, Bonnie, workflows…)
 * must resolve tenant from authenticated session + membership, never from
 * AI / browser / webhook payloads without revalidation.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export class PlatformTenantError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'TENANT_REQUIRED'
      | 'NOT_A_MEMBER'
      | 'SUSPENDED'
      | 'CROSS_TENANT'
      | 'NOT_FOUND'
      | 'FORBIDDEN' = 'FORBIDDEN'
  ) {
    super(message);
    this.name = 'PlatformTenantError';
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Session tenant always wins. Client-supplied tenant_id is never authoritative
 * when a session exists.
 */
export function bindSessionTenant(params: {
  sessionTenantId?: string | null;
  clientTenantId?: string | null;
  allowClientFallback?: boolean;
}): string {
  const session = String(params.sessionTenantId || '').trim();
  if (session) {
    if (!isUuid(session)) {
      throw new PlatformTenantError('Invalid session tenant', 'TENANT_REQUIRED');
    }
    return session;
  }
  if (!params.allowClientFallback) {
    throw new PlatformTenantError(
      'Active workspace required — tenant cannot be supplied by the client alone',
      'TENANT_REQUIRED'
    );
  }
  const client = String(params.clientTenantId || '').trim();
  if (!isUuid(client)) {
    throw new PlatformTenantError('tenant_id is required', 'TENANT_REQUIRED');
  }
  return client;
}

export type TenantMembershipRow = {
  tenant_id: string;
  user_id: string;
  role: string;
  status?: string | null;
};

/** Verify user is an active member of tenant. Fail closed. */
export async function assertTenantMembership(
  tenantId: string,
  userId: string
): Promise<TenantMembershipRow> {
  if (!isUuid(tenantId) || !isUuid(userId)) {
    throw new PlatformTenantError('Invalid tenant or user', 'TENANT_REQUIRED');
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('tenant_users')
    .select('tenant_id, user_id, role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new PlatformTenantError('Not a member of this workspace', 'NOT_A_MEMBER');
  }

  if (!data) {
    // Some deployments use tenant_members instead of / in addition to tenant_users
    const members = await admin
      .from('tenant_members')
      .select('tenant_id, user_id, role, status')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!members.error && members.data) {
      const status = String((members.data as any).status || 'active').toLowerCase();
      if (status === 'suspended' || status === 'removed' || status === 'invited') {
        throw new PlatformTenantError('Workspace membership is not active', 'SUSPENDED');
      }
      return members.data as TenantMembershipRow;
    }
    throw new PlatformTenantError('Not a member of this workspace', 'NOT_A_MEMBER');
  }

  return { ...data, status: 'active' } as TenantMembershipRow;
}

/**
 * Resolve active tenant for an authenticated user.
 * Hint (header/query) is ONLY accepted after membership verification.
 * Never pick "first membership" silently when a hint is wrong.
 */
export async function resolveActiveTenantForUser(params: {
  userId: string;
  hintedTenantId?: string | null;
}): Promise<{ tenantId: string; membership: TenantMembershipRow }> {
  const hint = String(params.hintedTenantId || '').trim();
  if (hint) {
    if (!isUuid(hint)) {
      throw new PlatformTenantError('Invalid workspace id', 'TENANT_REQUIRED');
    }
    const membership = await assertTenantMembership(hint, params.userId);
    return { tenantId: hint, membership };
  }

  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from('tenant_users')
    .select('tenant_id, user_id, role')
    .eq('user_id', params.userId)
    .limit(25);

  if (error) throw new PlatformTenantError('Unable to resolve workspace membership', 'NOT_A_MEMBER');
  const active = (rows || []).map((row) => ({ ...row, status: 'active' }));

  if (active.length === 0) {
    throw new PlatformTenantError('No active workspace membership', 'NOT_A_MEMBER');
  }
  if (active.length > 1) {
    throw new PlatformTenantError(
      'Multiple workspaces — set x-tenant-id / active workspace explicitly',
      'TENANT_REQUIRED'
    );
  }

  return {
    tenantId: active[0].tenant_id,
    membership: active[0] as TenantMembershipRow,
  };
}

/** Assert a loaded row belongs to the active tenant (no existence leak). */
export function assertRowTenant(
  rowTenantId: string | null | undefined,
  activeTenantId: string,
  resource = 'resource'
): void {
  if (!rowTenantId || rowTenantId !== activeTenantId) {
    throw new PlatformTenantError(`${resource} not found`, 'NOT_FOUND');
  }
}

/** Tenant-prefixed cache key — never omit tenant for business data. */
export function tenantCacheKey(tenantId: string, ...parts: string[]): string {
  if (!isUuid(tenantId)) {
    throw new PlatformTenantError('tenant_id required for cache key', 'TENANT_REQUIRED');
  }
  const safe = parts.map((p) => String(p).replace(/:/g, '_'));
  return `tenant:${tenantId}:${safe.join(':')}`;
}

/** Tenant-prefixed storage path. */
export function tenantStoragePath(
  tenantId: string,
  module: string,
  resourceId: string,
  filename: string
): string {
  if (!isUuid(tenantId)) {
    throw new PlatformTenantError('tenant_id required for storage path', 'TENANT_REQUIRED');
  }
  const safeName = String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `tenant/${tenantId}/${module}/${resourceId}/${safeName}`;
}

/**
 * Cron/worker: validate a due row before external side effects.
 * Quarantine (do not process) if tenant_id missing.
 */
export function assertCronRowTenantContext(row: {
  id?: string;
  tenant_id?: string | null;
}): string {
  const tid = String(row.tenant_id || '').trim();
  if (!isUuid(tid)) {
    throw new PlatformTenantError(
      `Record ${row.id || '?'} missing tenant_id — quarantined`,
      'TENANT_REQUIRED'
    );
  }
  return tid;
}

/** Persist a quarantine row for cron/workers (idempotent-ish). */
export async function quarantineTenantIsolationRow(params: {
  tableName: string;
  recordId?: string | null;
  reason: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const recordId = params.recordId || null;
  if (recordId) {
    const { data: existing } = await admin
      .from('tenant_isolation_quarantine')
      .select('id')
      .eq('table_name', params.tableName)
      .eq('record_id', recordId)
      .is('reviewed_at', null)
      .maybeSingle();
    if (existing?.id) return;
  }
  await admin.from('tenant_isolation_quarantine').insert({
    table_name: params.tableName,
    record_id: recordId,
    reason: params.reason,
    payload: params.payload || null,
  });
}

/**
 * Private storage paths must be tenant-prefixed:
 *   tenant/{tenantId}/...
 * Reject cross-tenant path probes.
 */
export function assertTenantStoragePath(params: {
  filePath: string;
  tenantId: string;
  allowLegacyUserPaths?: boolean;
  userId?: string | null;
}): void {
  const path = String(params.filePath || '').replace(/^\/+/, '');
  const expectedPrefix = `tenant/${params.tenantId}/`;
  if (path.startsWith(expectedPrefix)) return;

  if (
    params.allowLegacyUserPaths &&
    params.userId &&
    (path.startsWith(`${params.userId}/`) || path.includes(`/${params.userId}/`))
  ) {
    return;
  }

  throw new PlatformTenantError('Storage path not found for this workspace', 'NOT_FOUND');
}

/** Strip secrets / cross-tenant fields from error messages returned to clients. */
export function sanitizeTenantErrorMessage(err: unknown): string {
  if (err instanceof PlatformTenantError) {
    if (err.code === 'NOT_FOUND' || err.code === 'NOT_A_MEMBER' || err.code === 'CROSS_TENANT') {
      return 'Resource not found';
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      '[id]'
    );
  }
  return 'Request failed';
}
