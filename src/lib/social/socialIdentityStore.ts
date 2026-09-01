/**
 * Tenant-scoped social identity store.
 * Prefers social_identities / social_connections; falls back to legacy
 * facebook_integrations / linkedin_* with strict tenant filters.
 *
 * Alphaclone Systems is never a global default — every identity belongs to a tenant.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { TenantIsolationError, assertSameTenant } from './tenantGuard';
import type { SocialIdentityType, SocialPlatform } from './types';

export type StoredSocialIdentity = {
  identity_id: string;
  connection_id: string | null;
  tenant_id: string;
  provider: SocialPlatform | string;
  identity_type: SocialIdentityType | string;
  provider_identity_id: string;
  provider_identity_urn: string | null;
  display_name: string;
  can_publish: boolean;
  can_upload_media: boolean;
  can_read_insights: boolean;
  is_default: boolean;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
};

let identitiesTableAvailable: boolean | null = null;

async function hasSocialIdentitiesTable(): Promise<boolean> {
  if (identitiesTableAvailable !== null) return identitiesTableAvailable;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('social_identities').select('id').limit(1);
  identitiesTableAvailable = !(
    error &&
    (error.code === '42P01' || /does not exist|relation/i.test(error.message || ''))
  );
  return identitiesTableAvailable;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function looksLikeRawProviderIdentityId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || isUuid(trimmed)) return false;
  return /^\d{4,}$/.test(trimmed) || /^[A-Za-z0-9_.:-]{4,64}$/.test(trimmed);
}

/** List identities for the active tenant only. */
export async function listTenantSocialIdentities(params: {
  tenantId: string;
  provider?: string | null;
  activeOnly?: boolean;
}): Promise<StoredSocialIdentity[]> {
  const { tenantId, provider, activeOnly = true } = params;
  if (!tenantId) throw new TenantIsolationError('tenant_id required', 'TENANT_REQUIRED');

  if (await hasSocialIdentitiesTable()) {
    const admin = createSupabaseAdminClient();
    let q = admin
      .from('social_identities')
      .select(
        'id, connection_id, tenant_id, provider, identity_type, provider_identity_id, provider_identity_urn, display_name, can_publish, can_upload_media, can_read_insights, is_default, is_active, metadata'
      )
      .eq('tenant_id', tenantId);
    if (activeOnly) q = q.eq('is_active', true);
    if (provider) q = q.eq('provider', provider);
    const { data, error } = await q.order('display_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({
      identity_id: row.id,
      connection_id: row.connection_id,
      tenant_id: row.tenant_id,
      provider: row.provider,
      identity_type: row.identity_type,
      provider_identity_id: row.provider_identity_id,
      provider_identity_urn: row.provider_identity_urn,
      display_name: row.display_name || row.provider_identity_id,
      can_publish: row.can_publish === true,
      can_upload_media: row.can_upload_media === true,
      can_read_insights: row.can_read_insights === true,
      is_default: row.is_default === true,
      is_active: row.is_active !== false,
      metadata: row.metadata,
    }));
  }

  // Legacy fallback — still tenant-scoped
  return listLegacyIdentities(tenantId, provider, activeOnly);
}

async function listLegacyIdentities(
  tenantId: string,
  provider?: string | null,
  activeOnly = true
): Promise<StoredSocialIdentity[]> {
  const admin = createSupabaseAdminClient();
  const out: StoredSocialIdentity[] = [];

  if (!provider || provider === 'facebook') {
    let q = admin
      .from('facebook_integrations')
      .select('id, tenant_id, page_id, page_name, is_active, metadata, expires_at')
      .eq('tenant_id', tenantId);
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    for (const row of data || []) {
      if (!row.page_id) continue;
      const meta = (row.metadata || {}) as Record<string, unknown>;
      const tasks = Array.isArray(meta.page_tasks) ? meta.page_tasks.map(String) : [];
      const canPublish =
        row.is_active &&
        (tasks.includes('MANAGE') ||
          tasks.includes('CREATE_CONTENT') ||
          tasks.includes('ADVERTISE') ||
          tasks.length === 0);
      out.push({
        identity_id: row.id, // integration row UUID as internal id
        connection_id: row.id,
        tenant_id: tenantId,
        provider: 'facebook',
        identity_type: 'facebook_page',
        provider_identity_id: String(row.page_id),
        provider_identity_urn: null,
        display_name: String(row.page_name || row.page_id),
        can_publish: Boolean(canPublish),
        can_upload_media: Boolean(canPublish),
        can_read_insights: true,
        is_default: Boolean(meta.is_primary || meta.is_default),
        is_active: row.is_active !== false,
        metadata: meta,
      });
    }
  }

  if (!provider || provider === 'linkedin') {
    const { data: li } = await admin
      .from('linkedin_integrations')
      .select(
        'id, tenant_id, linkedin_member_id, linkedin_person_urn, scopes, metadata, is_active'
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (li) {
      const scopes = Array.isArray(li.scopes)
        ? li.scopes.map((s: unknown) => String(s).toLowerCase())
        : [];
      if (li.linkedin_person_urn || li.linkedin_member_id) {
        out.push({
          identity_id: `${li.id}:person`,
          connection_id: li.id,
          tenant_id: tenantId,
          provider: 'linkedin',
          identity_type: 'linkedin_person',
          provider_identity_id: String(li.linkedin_member_id || li.linkedin_person_urn),
          provider_identity_urn: li.linkedin_person_urn,
          display_name: 'LinkedIn Personal',
          can_publish: scopes.includes('w_member_social'),
          can_upload_media: scopes.includes('w_member_social'),
          can_read_insights: false,
          is_default: false,
          is_active: true,
          metadata: li.metadata as Record<string, unknown>,
        });
      }

      const { data: orgs } = await admin
        .from('linkedin_identities')
        .select(
          'id, tenant_id, linkedin_organization_id, author_urn, name, can_post, role, metadata'
        )
        .eq('tenant_id', tenantId)
        .eq('type', 'organization');

      const canOrg = scopes.includes('w_organization_social');
      for (const org of orgs || []) {
        const orgId = String(org.linkedin_organization_id || '').trim();
        if (!orgId) continue;
        out.push({
          identity_id: org.id || `${li.id}:org:${orgId}`,
          connection_id: li.id,
          tenant_id: tenantId,
          provider: 'linkedin',
          identity_type: 'linkedin_organization',
          provider_identity_id: orgId,
          provider_identity_urn: org.author_urn || `urn:li:organization:${orgId}`,
          display_name: String(org.name || `Organization ${orgId}`),
          can_publish: org.can_post === true || canOrg,
          can_upload_media: org.can_post === true || canOrg,
          can_read_insights: false,
          is_default: Boolean((org.metadata as any)?.is_default),
          is_active: true,
          metadata: { role: org.role, ...(org.metadata as object) },
        });
      }

      // Metadata company pages when linkedin_identities empty — still tenant-scoped
      if ((!orgs || orgs.length === 0) && li.metadata && typeof li.metadata === 'object') {
        const pages = Array.isArray((li.metadata as any).company_pages)
          ? (li.metadata as any).company_pages
          : [];
        for (const page of pages) {
          const orgId = String(page?.id || '').trim();
          if (!orgId) continue;
          out.push({
            identity_id: `${li.id}:org:${orgId}`,
            connection_id: li.id,
            tenant_id: tenantId,
            provider: 'linkedin',
            identity_type: 'linkedin_organization',
            provider_identity_id: orgId,
            provider_identity_urn: `urn:li:organization:${orgId}`,
            display_name: String(page?.name || `Organization ${orgId}`),
            can_publish: canOrg,
            can_upload_media: canOrg,
            can_read_insights: false,
            is_default: false,
            is_active: true,
            metadata: { source: 'metadata.company_pages' },
          });
        }
      }
    }
  }

  return out;
}

/**
 * Resolve an identity for publishing.
 * Accepts:
 * - internal identity UUID (preferred)
 * - legacy composite ids
 * - raw provider page/org id ONLY when it uniquely matches a tenant identity
 *
 * Never returns another tenant's identity. Never silently switches destinations.
 */
/** Shape identity candidates for MCP error responses. */
export function formatIdentityCandidates(identities: StoredSocialIdentity[]) {
  return identities.map((i) => ({
    identity_id: i.identity_id,
    display_name: i.display_name,
    provider: i.provider,
    identity_type: i.identity_type,
    can_publish: i.can_publish,
    is_default: i.is_default,
  }));
}

export async function resolveTenantIdentityForPublish(params: {
  tenantId: string;
  identityId?: string | null;
  identityType?: string | null;
  provider?: string | null;
  allowDefault?: boolean;
}): Promise<StoredSocialIdentity> {
  const { tenantId, allowDefault = false } = params;
  const identities = await listTenantSocialIdentities({
    tenantId,
    provider: params.provider || undefined,
    activeOnly: true,
  });

  const requested = String(params.identityId || '').trim();

  if (requested) {
    // 1) Exact internal identity_id match
    let match = identities.find((i) => i.identity_id === requested);

    // 2) Provider identity id match (page id / org id / member id)
    if (!match) {
      const byProvider = identities.filter(
        (i) =>
          i.provider_identity_id === requested ||
          i.provider_identity_urn === requested ||
          (params.identityType ? i.identity_type === params.identityType && i.provider_identity_id === requested : false)
      );
      if (byProvider.length === 1) {
        match = byProvider[0];
      } else if (byProvider.length > 1) {
        throw new TenantIsolationError(
          'Ambiguous identity_id — multiple identities match. Use get_social_identities and pass the internal identity_id.',
          'TARGET_AMBIGUOUS',
          { available_identities: formatIdentityCandidates(byProvider) }
        );
      }
    }

    if (!match) {
      // Do not leak whether it exists in another tenant
      if (looksLikeRawProviderIdentityId(requested)) {
        throw new TenantIsolationError(
          "identity_id must be the Alphaclone identity UUID from get_social_identities, not the provider's raw ID.",
          'PERMISSION_DENIED'
        );
      }
      throw new TenantIsolationError(
        'Identity not found for this tenant',
        'NOT_FOUND'
      );
    }

    assertSameTenant(match.tenant_id, tenantId, 'identity');
    if (params.identityType && match.identity_type !== params.identityType) {
      throw new TenantIsolationError(
        `Identity type mismatch: expected ${params.identityType}, got ${match.identity_type}`,
        'PERMISSION_DENIED'
      );
    }
    if (!match.can_publish) {
      throw new TenantIsolationError(
        `Identity ${match.display_name} cannot publish`,
        'PERMISSION_DENIED'
      );
    }
    return match;
  }

  // No identity provided — only auto-select when exactly one publishable, or a tenant default
  const publishable = identities.filter((i) => i.can_publish);
  const availableIdentities = formatIdentityCandidates(publishable);

  if (params.identityType) {
    const typed = publishable.filter((i) => i.identity_type === params.identityType);
    if (typed.length === 1) return typed[0];
    if (allowDefault) {
      const def = typed.find((i) => i.is_default);
      if (def) return def;
    }
    throw new TenantIsolationError(
      `Multiple or zero ${params.identityType} identities — pass identity_id from get_social_identities`,
      typed.length > 1 ? 'TARGET_AMBIGUOUS' : 'MISSING_IDENTITY',
      { available_identities: availableIdentities }
    );
  }

  if (publishable.length === 1) return publishable[0];
  if (allowDefault) {
    const def = publishable.find((i) => i.is_default);
    if (def) return def;
  }
  throw new TenantIsolationError(
    'identity_id is required when the tenant has multiple social identities. Call get_social_identities.',
    publishable.length > 1 ? 'TARGET_AMBIGUOUS' : 'MISSING_IDENTITY',
    { available_identities: availableIdentities }
  );
}

/** Load tenant default identity for a provider (if configured). */
export async function getTenantDefaultIdentity(
  tenantId: string,
  provider: string
): Promise<StoredSocialIdentity | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('tenant_social_defaults')
    .select('identity_id')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .maybeSingle();
  if (error || !data?.identity_id) {
    const list = await listTenantSocialIdentities({ tenantId, provider, activeOnly: true });
    return list.find((i) => i.is_default && i.can_publish) || null;
  }
  try {
    return await resolveTenantIdentityForPublish({
      tenantId,
      identityId: data.identity_id,
      provider,
    });
  } catch {
    return null;
  }
}

/**
 * Sync legacy facebook/linkedin rows into social_connections + social_identities
 * for one tenant. Idempotent.
 */
export async function syncTenantSocialIdentitiesFromLegacy(
  tenantId: string
): Promise<{ connections: number; identities: number }> {
  if (!(await hasSocialIdentitiesTable())) {
    return { connections: 0, identities: 0 };
  }
  const admin = createSupabaseAdminClient();
  let connections = 0;
  let identities = 0;

  const { data: fbRows } = await admin
    .from('facebook_integrations')
    .select('id, tenant_id, user_id, page_id, page_name, is_active, expires_at, metadata')
    .eq('tenant_id', tenantId);

  for (const row of fbRows || []) {
    if (!row.page_id) continue;
    const connPayload = {
      tenant_id: tenantId,
      connected_by_user_id: row.user_id,
      provider: 'facebook',
      provider_account_id: String(row.page_id),
      provider_account_name: row.page_name,
      connection_status: row.is_active ? 'active' : 'inactive',
      token_expires_at: row.expires_at,
      metadata: { legacy_integration_id: row.id, ...(row.metadata || {}) },
      updated_at: new Date().toISOString(),
    };
    const { data: conn } = await admin
      .from('social_connections')
      .upsert(connPayload, { onConflict: 'tenant_id,provider,provider_account_id' })
      .select('id')
      .maybeSingle();
    if (conn?.id) connections += 1;

    const meta = (row.metadata || {}) as Record<string, unknown>;
    const tasks = Array.isArray(meta.page_tasks) ? meta.page_tasks.map(String) : [];
    // If page_tasks are known, require a content-capable task. Otherwise allow
    // active integrations (Graph often omits tasks on older rows).
    const hasTaskSignal = tasks.length > 0;
    const canPublish =
      row.is_active === true &&
      (!hasTaskSignal ||
        tasks.includes('MANAGE') ||
        tasks.includes('CREATE_CONTENT') ||
        tasks.includes('ADVERTISE'));

    await admin.from('social_identities').upsert(
      {
        tenant_id: tenantId,
        connection_id: conn?.id || null,
        provider: 'facebook',
        identity_type: 'facebook_page',
        provider_identity_id: String(row.page_id),
        display_name: row.page_name || row.page_id,
        can_publish: canPublish,
        can_upload_media: canPublish,
        can_read_insights: true,
        is_default: Boolean(meta.is_primary || meta.is_default),
        is_active: row.is_active !== false,
        metadata: { legacy_integration_id: row.id },
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,provider,identity_type,provider_identity_id' }
    );
    identities += 1;
  }

  const { data: liRows } = await admin
    .from('linkedin_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  for (const li of liRows || []) {
    const connPayload = {
      tenant_id: tenantId,
      connected_by_user_id: li.user_id,
      provider: 'linkedin',
      provider_account_id: String(li.linkedin_member_id || li.linkedin_person_urn || li.id),
      provider_account_name: 'LinkedIn',
      connection_status: 'active',
      scopes: li.scopes,
      metadata: { legacy_integration_id: li.id, ...(li.metadata || {}) },
      updated_at: new Date().toISOString(),
    };
    const { data: conn } = await admin
      .from('social_connections')
      .upsert(connPayload, { onConflict: 'tenant_id,provider,provider_account_id' })
      .select('id')
      .maybeSingle();
    if (conn?.id) connections += 1;

    if (li.linkedin_person_urn || li.linkedin_member_id) {
      await admin.from('social_identities').upsert(
        {
          tenant_id: tenantId,
          connection_id: conn?.id || null,
          provider: 'linkedin',
          identity_type: 'linkedin_person',
          provider_identity_id: String(li.linkedin_member_id || li.linkedin_person_urn),
          provider_identity_urn: li.linkedin_person_urn,
          display_name: 'LinkedIn Personal',
          can_publish: Array.isArray(li.scopes) && li.scopes.includes('w_member_social'),
          can_upload_media: Array.isArray(li.scopes) && li.scopes.includes('w_member_social'),
          is_active: true,
          metadata: { legacy_integration_id: li.id },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,provider,identity_type,provider_identity_id' }
      );
      identities += 1;
    }

    const { data: orgs } = await admin
      .from('linkedin_identities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('type', 'organization');

    for (const org of orgs || []) {
      const orgId = String(org.linkedin_organization_id || '').trim();
      if (!orgId) continue;
      await admin.from('social_identities').upsert(
        {
          tenant_id: tenantId,
          connection_id: conn?.id || null,
          provider: 'linkedin',
          identity_type: 'linkedin_organization',
          provider_identity_id: orgId,
          provider_identity_urn: org.author_urn || `urn:li:organization:${orgId}`,
          display_name: org.name || `Organization ${orgId}`,
          can_publish: org.can_post === true,
          can_upload_media: org.can_post === true,
          is_active: true,
          metadata: { role: org.role, legacy_identity_id: org.id },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,provider,identity_type,provider_identity_id' }
      );
      identities += 1;
    }
  }

  return { connections, identities };
}
