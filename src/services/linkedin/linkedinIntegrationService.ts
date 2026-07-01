import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { decrypt, encrypt } from '@/lib/encryption';
import { linkedInFetch } from '@/lib/linkedin/linkedinClient';

export type LinkedInCompanyPage = {
  id: string;
  name: string | null;
  vanityName: string | null;
  logoUrl: string | null;
};

export type LinkedInIntegrationRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  linkedin_member_id: string;
  linkedin_person_urn: string;
  token_expires_at: string | null;
  scopes: string[] | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
};

const SAFE_INTEGRATION_COLUMNS =
  'id, tenant_id, user_id, linkedin_member_id, linkedin_person_urn, token_expires_at, scopes, metadata, is_active, created_at, updated_at';

function getEncryptionSecret(): string | null {
  const secret = ENV.ENCRYPTION_SECRET || ENV.ZOHO_ENCRYPTION_SECRET || null;
  return secret && secret.length === 32 ? secret : null;
}

export function normalizeLinkedInScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => String(value).split(/[,\s]+/))
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export function extractCompanyPagesFromMetadata(raw: unknown): LinkedInCompanyPage[] {
  if (!raw || typeof raw !== 'object') return [];
  const maybePages = (raw as { company_pages?: unknown }).company_pages;
  if (!Array.isArray(maybePages)) return [];
  return maybePages
    .map((page) => {
      if (!page || typeof page !== 'object') return null;
      const obj = page as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id : '';
      if (!id) return null;
      return {
        id,
        name: typeof obj.name === 'string' ? obj.name : null,
        vanityName: typeof obj.vanityName === 'string' ? obj.vanityName : null,
        logoUrl: typeof obj.logoUrl === 'string' ? obj.logoUrl : null,
      };
    })
    .filter((page): page is LinkedInCompanyPage => !!page);
}

export async function encryptLinkedInAccessToken(token: string): Promise<string> {
  const secret = getEncryptionSecret();
  if (!secret) return token;
  if (token.includes(':') && token.split(':').length === 3) return token;
  return encrypt(token, secret);
}

export async function decryptLinkedInAccessToken(stored: string): Promise<string> {
  if (!stored) return '';
  if (!stored.includes(':') || stored.split(':').length !== 3) return stored;
  const secret = getEncryptionSecret();
  if (!secret) return stored;
  try {
    return await decrypt(stored, secret);
  } catch {
    return stored;
  }
}

async function readTokenFromSecretsTable(
  admin: SupabaseClient,
  integrationId: string
): Promise<string | null> {
  const { data } = await admin
    .from('linkedin_integration_secrets')
    .select('access_token_encrypted')
    .eq('integration_id', integrationId)
    .maybeSingle();
  if (!data?.access_token_encrypted) return null;
  const plain = await decryptLinkedInAccessToken(String(data.access_token_encrypted));
  return plain || null;
}

async function writeTokenToSecretsTable(
  admin: SupabaseClient,
  integrationId: string,
  accessToken: string
): Promise<void> {
  const encrypted = await encryptLinkedInAccessToken(accessToken);
  const { error } = await admin.from('linkedin_integration_secrets').upsert(
    {
      integration_id: integrationId,
      access_token_encrypted: encrypted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'integration_id' }
  );
  if (error) throw new Error(error.message);
}

export async function getLinkedInAccessToken(
  admin: SupabaseClient,
  integration: Pick<LinkedInIntegrationRow, 'id' | 'token_expires_at'> & { access_token?: string | null }
): Promise<string | null> {
  const fromSecrets = await readTokenFromSecretsTable(admin, integration.id);
  if (fromSecrets) {
    if (isTokenExpired(integration.token_expires_at)) return null;
    return fromSecrets;
  }
  const legacy = integration.access_token;
  if (!legacy) return null;
  if (isTokenExpired(integration.token_expires_at)) return null;
  const plain = await decryptLinkedInAccessToken(legacy);
  if (plain && integration.id) {
    await writeTokenToSecretsTable(admin, integration.id, plain).catch(() => undefined);
    await admin.from('linkedin_integrations').update({ access_token: null }).eq('id', integration.id);
  }
  return plain || null;
}

export function isTokenExpired(tokenExpiresAt: string | null | undefined): boolean {
  if (!tokenExpiresAt) return false;
  const exp = new Date(tokenExpiresAt).getTime();
  if (!Number.isFinite(exp)) return false;
  return Date.now() >= exp - 60_000;
}

export async function markLinkedInIntegrationInactive(
  admin: SupabaseClient,
  integrationId: string,
  reason: string
): Promise<void> {
  const { data: row } = await admin
    .from('linkedin_integrations')
    .select('metadata')
    .eq('id', integrationId)
    .maybeSingle();
  const metadata =
    row?.metadata && typeof row.metadata === 'object'
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  await admin
    .from('linkedin_integrations')
    .update({
      is_active: false,
      metadata: { ...metadata, inactive_reason: reason, inactive_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);
}

export async function revokeLinkedInToken(accessToken: string): Promise<void> {
  const clientId = ENV.LINKEDIN_CLIENT_ID;
  const clientSecret = ENV.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret || !accessToken) return;

  const body = new URLSearchParams({
    token: accessToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  await fetch('https://www.linkedin.com/oauth/v2/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch(() => undefined);
}

type IntegrationQuery = {
  tenantId: string;
  userId: string;
  linkedinMemberId?: string | null;
  requireActive?: boolean;
};

export async function getLinkedInIntegration(
  admin: SupabaseClient,
  query: IntegrationQuery
): Promise<(LinkedInIntegrationRow & { access_token?: string | null }) | null> {
  let q = admin
    .from('linkedin_integrations')
    .select(`${SAFE_INTEGRATION_COLUMNS}, access_token`)
    .eq('tenant_id', query.tenantId)
    .eq('user_id', query.userId);
  if (query.requireActive !== false) q = q.eq('is_active', true);
  if (query.linkedinMemberId) q = q.eq('linkedin_member_id', query.linkedinMemberId);
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return data as LinkedInIntegrationRow & { access_token?: string | null };
}

export async function getLinkedInIntegrationWithToken(
  admin: SupabaseClient,
  query: IntegrationQuery
): Promise<(LinkedInIntegrationRow & { accessToken: string }) | null> {
  const row = await getLinkedInIntegration(admin, query);
  if (!row) return null;
  const accessToken = await getLinkedInAccessToken(admin, row);
  if (!accessToken) return null;
  return { ...row, accessToken };
}

export async function fetchLinkedInCompanyPages(accessToken: string): Promise<LinkedInCompanyPage[]> {
  const url =
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName,vanityName,logoV2(original~:playableStreams))))';
  const res = await linkedInFetch(url, accessToken, { method: 'GET' });
  if (!res.ok) return [];
  const payload = await res.json().catch(() => ({}));
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  return elements
    .map((entry: Record<string, unknown>) => {
      const target = entry?.['organizationalTarget~'] as Record<string, unknown> | undefined;
      const logoV2 = target?.logoV2 as Record<string, unknown> | undefined;
      const original = logoV2?.['original~'] as Record<string, unknown> | undefined;
      const streams = original?.elements;
      const firstStream = Array.isArray(streams) ? streams[0] : null;
      const identifiers = (firstStream as Record<string, unknown> | null)?.identifiers;
      const firstIdentifier = Array.isArray(identifiers) ? identifiers[0] : null;
      return {
        id: target?.id ? String(target.id) : '',
        name: target?.localizedName ? String(target.localizedName) : null,
        vanityName: target?.vanityName ? String(target.vanityName) : null,
        logoUrl:
          firstIdentifier && typeof (firstIdentifier as Record<string, unknown>).identifier === 'string'
            ? String((firstIdentifier as Record<string, unknown>).identifier)
            : null,
      } as LinkedInCompanyPage;
    })
    .filter((page: LinkedInCompanyPage) => Boolean(page.id));
}

export async function syncLinkedInIdentities(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    integrationId: string;
    personUrn: string;
    linkedinMemberId: string;
    scopes: string[];
    companyPages: LinkedInCompanyPage[];
    profile?: { name?: string | null; picture?: string | null; email?: string | null };
  }
): Promise<void> {
  const canPostMember = params.scopes.includes('w_member_social');
  const canPostOrg = params.scopes.includes('w_organization_social');

  await admin.from('linkedin_identities').upsert(
    {
      tenant_id: params.tenantId,
      integration_id: params.integrationId,
      type: 'person',
      linkedin_organization_id: null,
      author_urn: params.personUrn,
      name: params.profile?.name || null,
      vanity_name: null,
      logo_url: params.profile?.picture || null,
      can_post: canPostMember,
      is_admin: false,
      metadata: { linkedin_member_id: params.linkedinMemberId, email: params.profile?.email || null },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,author_urn' }
  );

  for (const page of params.companyPages) {
    const authorUrn = `urn:li:organization:${page.id}`;
    await admin.from('linkedin_identities').upsert(
      {
        tenant_id: params.tenantId,
        integration_id: params.integrationId,
        type: 'organization',
        linkedin_organization_id: page.id,
        author_urn: authorUrn,
        name: page.name,
        vanity_name: page.vanityName,
        logo_url: page.logoUrl,
        can_post: canPostOrg,
        is_admin: true,
        metadata: {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,author_urn' }
    );
  }
}

export type UpsertLinkedInIntegrationInput = {
  tenantId: string;
  userId: string;
  linkedinMemberId: string;
  linkedinPersonUrn: string;
  accessToken: string;
  tokenExpiresAt: string | null;
  scopes: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
};

export async function upsertLinkedInIntegration(
  input: UpsertLinkedInIntegrationInput
): Promise<{ integrationId: string | null; error?: string }> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from('linkedin_integrations')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .eq('linkedin_member_id', input.linkedinMemberId)
    .maybeSingle();

  const row = {
    tenant_id: input.tenantId,
    user_id: input.userId,
    linkedin_member_id: input.linkedinMemberId,
    linkedin_person_urn: input.linkedinPersonUrn,
    access_token: null,
    token_expires_at: input.tokenExpiresAt,
    scopes: input.scopes,
    is_active: input.isActive,
    metadata: input.metadata,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('linkedin_integrations')
    .upsert(row, { onConflict: 'tenant_id,user_id,linkedin_member_id' })
    .select('id')
    .single();

  if (error || !data?.id) {
    return { integrationId: null, error: error?.message || 'upsert failed' };
  }

  const integrationId = String(data.id);
  await writeTokenToSecretsTable(admin, integrationId, input.accessToken);

  if (existing?.id && existing.id !== integrationId) {
    await admin.from('linkedin_integration_secrets').delete().eq('integration_id', existing.id);
  }

  const companyPages = extractCompanyPagesFromMetadata(input.metadata);
  await syncLinkedInIdentities(admin, {
    tenantId: input.tenantId,
    integrationId,
    personUrn: input.linkedinPersonUrn,
    linkedinMemberId: input.linkedinMemberId,
    scopes: input.scopes,
    companyPages,
    profile: {
      name: typeof input.metadata.name === 'string' ? input.metadata.name : null,
      picture: typeof input.metadata.picture === 'string' ? input.metadata.picture : null,
      email: typeof input.metadata.email === 'string' ? input.metadata.email : null,
    },
  }).catch((err) => {
    console.error('[linkedinIntegrationService] sync identities failed:', err);
  });

  return { integrationId };
}

export async function deleteLinkedInIntegration(params: {
  tenantId: string;
  userId: string;
  linkedinMemberId: string;
}): Promise<{ success: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const integration = await getLinkedInIntegration(admin, {
    tenantId: params.tenantId,
    userId: params.userId,
    linkedinMemberId: params.linkedinMemberId,
    requireActive: false,
  });
  if (integration) {
    const token = await getLinkedInAccessToken(admin, integration);
    if (token) await revokeLinkedInToken(token);
  }

  const { error } = await admin
    .from('linkedin_integrations')
    .delete()
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId)
    .eq('linkedin_member_id', params.linkedinMemberId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function runLinkedInTokenHealthCheck(limit = 50): Promise<{
  checked: number;
  deactivated: number;
  expiringSoon: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: rows } = await admin
    .from('linkedin_integrations')
    .select(`${SAFE_INTEGRATION_COLUMNS}, access_token`)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  let deactivated = 0;
  let expiringSoon = 0;

  for (const row of rows || []) {
    const integration = row as LinkedInIntegrationRow & { access_token?: string | null };
    if (integration.token_expires_at) {
      const exp = new Date(integration.token_expires_at);
      if (exp.getTime() <= now.getTime()) {
        await markLinkedInIntegrationInactive(admin, integration.id, 'token_expired');
        deactivated++;
        continue;
      }
      if (exp.getTime() <= soon.getTime()) expiringSoon++;
    }

    const token = await getLinkedInAccessToken(admin, integration);
    if (!token) continue;

    try {
      const res = await linkedInFetch('https://api.linkedin.com/v2/userinfo', token, { method: 'GET' }, {
        restli: false,
        retries: 1,
        timeoutMs: 15000,
      });
      if (res.status === 401) {
        await markLinkedInIntegrationInactive(admin, integration.id, 'token_revoked_or_invalid');
        deactivated++;
      }
    } catch {
      // Transient network errors — skip deactivation
    }
  }

  return { checked: rows?.length || 0, deactivated, expiringSoon };
}
