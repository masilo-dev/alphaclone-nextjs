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
      | 'PERMISSION_DENIED'
      | 'MISSING_IDENTITY'
      | 'TARGET_AMBIGUOUS'
      | 'IDENTITY_NOT_FOUND'
      | 'IDENTITY_NOT_PUBLISHABLE'
      | 'SOCIAL_DESTINATION_MISMATCH'
      | 'LINKEDIN_DESTINATION_MISMATCH'
      | 'INSTAGRAM_IDENTITY_REQUIRED'
      | 'INSTAGRAM_IDENTITY_NOT_FOUND'
      | 'OAUTH_EXPIRED'
      | 'PERMISSION_MISSING'
      | 'PROVIDER_REJECTED'
      | 'PROVIDER_TIMEOUT' = 'CROSS_TENANT',
    public readonly details?: unknown
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

export function assertSameTenant(
  resourceTenantId: string | null | undefined,
  tenantId: string,
  resourceName = 'resource'
): void {
  if (!resourceTenantId || resourceTenantId !== tenantId) {
    throw new TenantIsolationError(
      `${resourceName} does not belong to this tenant`,
      'CROSS_TENANT'
    );
  }
}
