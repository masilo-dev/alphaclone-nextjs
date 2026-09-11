import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { decrypt, encrypt } from '@/lib/encryption';
import { linkedInFetch, LinkedInApiError } from '@/lib/linkedin/linkedinClient';

export type LinkedInCompanyPage = {
  id: string;
  name: string | null;
  vanityName: string | null;
  logoUrl: string | null;
  roles?: string[];
  primaryRole?: string | null;
};

/** LinkedIn REST version for Community Management organizationAcls. */
const LINKEDIN_REST_VERSION = '202505';

export type LinkedInCompanyPageFetchDiagnostics = {
  pagesFound: number;
  attempts: Array<{ source: string; role: string | null; status: 'ok' | 'error'; detail?: string }>;
  apiForbidden: boolean;
  missingOrgScopes: boolean;
  grantedScopes: string[];
  hint: string | null;
};

/** Roles that can post to or administer a LinkedIn company page (queried separately — API filters one role per call). */
const LINKEDIN_COMPANY_PAGE_ROLES = [
  'ADMINISTRATOR',
  'CONTENT_ADMINISTRATOR',
  'DIRECT_SPONSORED_CONTENT_POSTER',
  'CURATOR',
  'RECRUITING_POSTER',
  'LEAD_CAPTURE_ADMINISTRATOR',
  'LEAD_GEN_FORMS_MANAGER',
  'ANALYST',
] as const;

const ORG_READ_SCOPES = ['r_organization_admin', 'r_organization_social', 'rw_organization_admin'] as const;

export function linkedInHasOrganizationReadScope(scopes: string[]): boolean {
  const normalized = normalizeLinkedInScopes(scopes);
  return ORG_READ_SCOPES.some((scope) => normalized.includes(scope));
}

function extractOrganizationIdFromUrn(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const match = value.match(/urn:li:organization:(\d+)/i);
  if (match?.[1]) return match[1];
  return /^\d+$/.test(value.trim()) ? value.trim() : '';
}

/** Parse LinkedIn localized name fields (string or nested localized map). */
export function parseLinkedInLocalizedName(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.localizedName === 'string' && obj.localizedName.trim()) {
    return obj.localizedName.trim();
  }
  const localized = obj.localized;
  if (localized && typeof localized === 'object') {
    const values = Object.values(localized as Record<string, unknown>);
    const first = values.find((entry) => typeof entry === 'string' && entry.trim());
    if (typeof first === 'string') return first.trim();
  }
  if (obj.name) {
    const nested = parseLinkedInLocalizedName(obj.name);
    if (nested) return nested;
  }
  return null;
}

export function formatLinkedInCompanyPageLabel(
  page: Pick<LinkedInCompanyPage, 'name' | 'vanityName' | 'id'>
): string {
  if (page.name?.trim()) return page.name.trim();
  if (page.vanityName?.trim()) {
    return page.vanityName
      .trim()
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return `Organization ${page.id}`;
}

async function enrichLinkedInCompanyPages(
  accessToken: string,
  pages: LinkedInCompanyPage[]
): Promise<LinkedInCompanyPage[]> {
  const enriched: LinkedInCompanyPage[] = [];
  for (const page of pages) {
    if (page.name?.trim()) {
      enriched.push(page);
      continue;
    }
    try {
      const lookedUp = await lookupLinkedInOrganizationById(accessToken, page.id);
      enriched.push(
        lookedUp
          ? {
              ...page,
              name: page.name || lookedUp.name,
              vanityName: page.vanityName || lookedUp.vanityName,
              logoUrl: page.logoUrl || lookedUp.logoUrl,
            }
          : page
      );
    } catch {
      enriched.push(page);
    }
  }
  return enriched;
}

function parseOrganizationTarget(row: Record<string, unknown>): Record<string, unknown> | null {
  const expanded = row['organizationalTarget~'];
  if (expanded && typeof expanded === 'object') return expanded as Record<string, unknown>;
  const urn = row.organization ?? row.organizationalTarget;
  const id = extractOrganizationIdFromUrn(urn);
  if (!id) return null;
  return { id };
}

function mergeCompanyPageRole(existing: LinkedInCompanyPage | undefined, next: LinkedInCompanyPage): LinkedInCompanyPage {
  const mergedRoles = Array.from(new Set([...(existing?.roles || []), ...(next.roles || [])]));
  return {
    ...next,
    roles: mergedRoles,
    primaryRole: existing?.primaryRole || next.primaryRole || mergedRoles[0] || null,
  };
}

function parseOrganizationAclElements(elements: unknown[]): LinkedInCompanyPage[] {
  return elements
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      const target = parseOrganizationTarget(row);
      if (!target) return null;
      const logoV2 = target.logoV2 as Record<string, unknown> | undefined;
      const original = logoV2?.['original~'] as Record<string, unknown> | undefined;
      const streams = original?.elements;
      const firstStream = Array.isArray(streams) ? streams[0] : null;
      const identifiers = (firstStream as Record<string, unknown> | null)?.identifiers;
      const firstIdentifier = Array.isArray(identifiers) ? identifiers[0] : null;
      const role = typeof row.role === 'string' ? row.role : null;
      const id = target.id ? String(target.id) : extractOrganizationIdFromUrn(row.organization);
      if (!id) return null;
      return {
        id,
        name: parseLinkedInLocalizedName(target.localizedName) || parseLinkedInLocalizedName(target.name),
        vanityName: target.vanityName ? String(target.vanityName) : null,
        logoUrl:
          firstIdentifier && typeof (firstIdentifier as Record<string, unknown>).identifier === 'string'
            ? String((firstIdentifier as Record<string, unknown>).identifier)
            : null,
        roles: role ? [role] : [],
        primaryRole: role,
      } as LinkedInCompanyPage;
    })
    .filter((page): page is LinkedInCompanyPage => Boolean(page?.id));
}

async function fetchLinkedInCompanyPagesForRole(
  accessToken: string,
  options: { role?: string; api: 'v2' | 'rest' }
): Promise<LinkedInCompanyPage[]> {
  const byId = new Map<string, LinkedInCompanyPage>();
  let start = 0;
  const count = 100;
  const role = options.role;

  while (true) {
    const roleParam = role ? `&role=${encodeURIComponent(role)}` : '';
    const projection =
      '&projection=(elements*(role,organization,organizationalTarget~(id,localizedName,vanityName,logoV2(original~:playableStreams))),paging)';
    const prefix =
      options.api === 'rest'
        ? 'https://api.linkedin.com/rest/organizationAcls'
        : 'https://api.linkedin.com/v2/organizationAcls';
    const url =
      `${prefix}?q=roleAssignee&state=APPROVED${roleParam}` +
      `&start=${start}&count=${count}${projection}`;
    const res = await linkedInFetch(url, accessToken, { method: 'GET' }, {
      linkedInVersion: options.api === 'rest' ? LINKEDIN_REST_VERSION : undefined,
    });
    const payload = await res.json().catch(() => ({}));
    const elements = Array.isArray(payload?.elements) ? payload.elements : [];
    const pages = parseOrganizationAclElements(elements);
    for (const page of pages) {
      byId.set(page.id, mergeCompanyPageRole(byId.get(page.id), page));
    }

    const paging = payload?.paging as { start?: unknown; count?: unknown } | undefined;
    const returnedCount = elements.length;
    const nextStart = start + returnedCount;
    const pageCount = typeof paging?.count === 'number' ? paging.count : count;
    if (returnedCount === 0 || returnedCount < pageCount) {
      break;
    }
    start = nextStart;
  }

  return Array.from(byId.values());
}

function buildCompanyPageFetchHint(params: {
  pagesFound: number;
  apiForbidden: boolean;
  missingOrgScopes: boolean;
  grantedScopes: string[];
}): string | null {
  if (params.pagesFound > 0) return null;
  if (params.missingOrgScopes) {
    return 'Reconnect LinkedIn and approve organization permissions (r_organization_admin / rw_organization_admin).';
  }
  if (params.apiForbidden) {
    return 'LinkedIn blocked organization page lookup. Your LinkedIn Developer app likely needs the Community Management API product approved, and the Page super admin must verify the app.';
  }
  if (!linkedInHasOrganizationReadScope(params.grantedScopes)) {
    return 'Organization read scopes were not granted on this token. Reconnect and approve all organization permissions.';
  }
  return 'LinkedIn returned zero pages for this account. If you manage a Page, use “Link page manually” below or reconnect with force login.';
}

export async function fetchLinkedInCompanyPages(
  accessToken: string,
  grantedScopes: string[] = []
): Promise<{ companyPages: LinkedInCompanyPage[]; diagnostics: LinkedInCompanyPageFetchDiagnostics }> {
  const byId = new Map<string, LinkedInCompanyPage>();
  const attempts: LinkedInCompanyPageFetchDiagnostics['attempts'] = [];
  let authLikeError: LinkedInApiError | null = null;
  let apiForbidden = false;
  const normalizedScopes = normalizeLinkedInScopes(grantedScopes);
  const missingOrgScopes = !linkedInHasOrganizationReadScope(normalizedScopes);

  const runAttempt = async (source: string, api: 'v2' | 'rest', role?: string) => {
    try {
      const pages = await fetchLinkedInCompanyPagesForRole(accessToken, { api, role });
      attempts.push({ source, role: role || null, status: 'ok' });
      for (const page of pages) byId.set(page.id, page);
    } catch (err) {
      const detail = err instanceof Error ? err.message.slice(0, 240) : 'unknown error';
      attempts.push({ source, role: role || null, status: 'error', detail });
      if (err instanceof LinkedInApiError && err.code === 'FORBIDDEN') apiForbidden = true;
      if (err instanceof LinkedInApiError && (err.code === 'TOKEN_EXPIRED' || err.code === 'FORBIDDEN')) {
        authLikeError = err;
      }
      console.warn('[linkedin] organizationAcls fetch failed:', source, role || 'all', err);
    }
  };

  for (const api of ['rest', 'v2'] as const) {
    await runAttempt(`${api}:all`, api);
    if (byId.size > 0) break;
  }

  if (byId.size === 0) {
    for (const api of ['rest', 'v2'] as const) {
      for (const role of LINKEDIN_COMPANY_PAGE_ROLES) {
        await runAttempt(`${api}:${role}`, api, role);
      }
      if (byId.size > 0) break;
    }
  }

  if (byId.size === 0 && authLikeError) {
    throw authLikeError;
  }

  const companyPages = await enrichLinkedInCompanyPages(accessToken, Array.from(byId.values()));
  return {
    companyPages,
    diagnostics: {
      pagesFound: companyPages.length,
      attempts,
      apiForbidden,
      missingOrgScopes,
      grantedScopes: normalizedScopes,
      hint: buildCompanyPageFetchHint({
        pagesFound: companyPages.length,
        apiForbidden,
        missingOrgScopes,
        grantedScopes: normalizedScopes,
      }),
    },
  };
}

export function parseLinkedInCompanyVanityInput(raw: string): { vanityName: string | null; organizationId: string | null } {
  const value = raw.trim();
  if (!value) return { vanityName: null, organizationId: null };
  if (/^\d+$/.test(value)) return { vanityName: null, organizationId: value };
  try {
    if (value.includes('linkedin.com/company/')) {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('company');
      const slug = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1];
      return { vanityName: slug ? decodeURIComponent(slug) : null, organizationId: null };
    }
  } catch {
    // fall through
  }
  return { vanityName: value.replace(/^@/, ''), organizationId: null };
}

async function lookupLinkedInOrganizationByVanity(
  accessToken: string,
  vanityName: string
): Promise<LinkedInCompanyPage | null> {
  const url = `https://api.linkedin.com/v2/organizations?q=vanityName&vanityName=${encodeURIComponent(vanityName)}`;
  const res = await linkedInFetch(url, accessToken, { method: 'GET' });
  const payload = await res.json().catch(() => ({}));
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  const first = elements[0] as Record<string, unknown> | undefined;
  const id = first?.id ? String(first.id) : '';
  if (!id) return null;
  return {
    id,
    name: parseLinkedInLocalizedName(first?.localizedName) || parseLinkedInLocalizedName(first?.name),
    vanityName: first?.vanityName ? String(first.vanityName) : vanityName,
    logoUrl: null,
    roles: [],
    primaryRole: null,
  };
}

async function lookupLinkedInOrganizationById(
  accessToken: string,
  organizationId: string
): Promise<LinkedInCompanyPage | null> {
  const restUrl = `https://api.linkedin.com/rest/organizations/${encodeURIComponent(organizationId)}`;
  try {
    const restRes = await linkedInFetch(restUrl, accessToken, { method: 'GET' }, {
      linkedInVersion: LINKEDIN_REST_VERSION,
    });
    const restPayload = await restRes.json().catch(() => ({}));
    const restId = restPayload?.id ? String(restPayload.id) : organizationId;
    const restName =
      parseLinkedInLocalizedName(restPayload?.localizedName) ||
      parseLinkedInLocalizedName(restPayload?.name);
    if (restName) {
      return {
        id: restId,
        name: restName,
        vanityName: restPayload?.vanityName ? String(restPayload.vanityName) : null,
        logoUrl: null,
        roles: [],
        primaryRole: null,
      };
    }
  } catch {
    // fall through to v2 lookup
  }

  const url = `https://api.linkedin.com/v2/organizations/${encodeURIComponent(organizationId)}`;
  const res = await linkedInFetch(url, accessToken, { method: 'GET' });
  const payload = await res.json().catch(() => ({}));
  const id = payload?.id ? String(payload.id) : organizationId;
  if (!id) return null;
  return {
    id,
    name: parseLinkedInLocalizedName(payload?.localizedName) || parseLinkedInLocalizedName(payload?.name),
    vanityName: payload?.vanityName ? String(payload.vanityName) : null,
    logoUrl: null,
    roles: [],
    primaryRole: null,
  };
}

async function verifyLinkedInOrganizationAccess(
  accessToken: string,
  organizationId: string
): Promise<{ allowed: boolean; roles: string[] }> {
  const orgUrn = encodeURIComponent(`urn:li:organization:${organizationId}`);
  const urls = [
    `https://api.linkedin.com/rest/organizationAcls?q=organization&organization=${orgUrn}&state=APPROVED`,
    `https://api.linkedin.com/v2/organizationAcls?q=organization&organization=${orgUrn}&state=APPROVED&projection=(elements*(role))`,
  ];
  const roles = new Set<string>();
  for (const url of urls) {
    try {
      const res = await linkedInFetch(url, accessToken, { method: 'GET' }, {
        linkedInVersion: url.includes('/rest/') ? LINKEDIN_REST_VERSION : undefined,
      });
      const payload = await res.json().catch(() => ({}));
      const elements = Array.isArray(payload?.elements) ? payload.elements : [];
      for (const entry of elements) {
        const role = typeof (entry as Record<string, unknown>).role === 'string'
          ? String((entry as Record<string, unknown>).role)
          : '';
        if (role) roles.add(role);
      }
      if (roles.size > 0) return { allowed: true, roles: Array.from(roles) };
    } catch (err) {
      console.warn('[linkedin] organization ACL verify failed:', url, err);
    }
  }
  return { allowed: false, roles: [] };
}

export async function linkLinkedInCompanyPageManually(params: {
  tenantId: string;
  userId: string;
  linkedinMemberId?: string | null;
  companyInput: string;
}): Promise<{ companyPage: LinkedInCompanyPage | null; error?: string }> {
  const admin = createSupabaseAdminClient();
  const integration = await getLinkedInIntegrationWithToken(admin, {
    tenantId: params.tenantId,
    userId: params.userId,
    linkedinMemberId: params.linkedinMemberId,
  });
  if (!integration?.accessToken) {
    return { companyPage: null, error: 'LinkedIn is not connected for this workspace.' };
  }

  const parsed = parseLinkedInCompanyVanityInput(params.companyInput);
  let page: LinkedInCompanyPage | null = null;
  try {
    if (parsed.organizationId) {
      page = await lookupLinkedInOrganizationById(integration.accessToken, parsed.organizationId);
    } else if (parsed.vanityName) {
      page = await lookupLinkedInOrganizationByVanity(integration.accessToken, parsed.vanityName);
    }
  } catch (err) {
    return {
      companyPage: null,
      error: err instanceof Error ? err.message.slice(0, 240) : 'Could not look up that LinkedIn company page.',
    };
  }

  if (!page?.id) {
    return { companyPage: null, error: 'LinkedIn company page not found for that URL or vanity name.' };
  }

  const scopes = normalizeLinkedInScopes(integration.scopes);
  const access = await verifyLinkedInOrganizationAccess(integration.accessToken, page.id);
  const hasOrgWriteScope =
    scopes.includes('w_organization_social') || scopes.includes('rw_organization_admin');
  if (!access.allowed && !hasOrgWriteScope) {
    return {
      companyPage: null,
      error:
        'LinkedIn did not confirm your admin access to that page. Reconnect with organization permissions (w_organization_social / rw_organization_admin) approved.',
    };
  }

  page = {
    ...page,
    roles: access.allowed ? access.roles : ['MANUAL_LINK'],
    primaryRole: access.roles[0] || page.primaryRole || (access.allowed ? null : 'MANUAL_LINK'),
  };

  const metadata =
    integration.metadata && typeof integration.metadata === 'object'
      ? { ...(integration.metadata as Record<string, unknown>) }
      : {};
  const existingPages = extractCompanyPagesFromMetadata(metadata);
  const merged = new Map(existingPages.map((entry) => [entry.id, entry]));
  merged.set(page.id, page);

  await admin
    .from('linkedin_integrations')
    .update({
      metadata: {
        ...metadata,
        company_pages: Array.from(merged.values()),
        company_pages_count: merged.size,
        company_pages_refreshed_at: new Date().toISOString(),
        company_page_manual_link: page.vanityName || page.id,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  await syncLinkedInIdentities(admin, {
    tenantId: params.tenantId,
    integrationId: integration.id,
    personUrn: integration.linkedin_person_urn,
    linkedinMemberId: integration.linkedin_member_id,
    scopes,
    companyPages: Array.from(merged.values()),
    profile: {
      name: typeof metadata.name === 'string' ? metadata.name : null,
      picture: typeof metadata.picture === 'string' ? metadata.picture : null,
      email: typeof metadata.email === 'string' ? metadata.email : null,
    },
  }).catch(() => undefined);

  return { companyPage: page };
}

export async function refreshLinkedInCompanyPages(params: {
  tenantId: string;
  userId: string;
  linkedinMemberId?: string | null;
}): Promise<{
  companyPages: LinkedInCompanyPage[];
  scopes: string[];
  error?: string;
  diagnostics?: LinkedInCompanyPageFetchDiagnostics;
}> {
  const admin = createSupabaseAdminClient();
  const integration = await getLinkedInIntegrationWithToken(admin, {
    tenantId: params.tenantId,
    userId: params.userId,
    linkedinMemberId: params.linkedinMemberId,
  });
  if (!integration?.accessToken) {
    if (integration?.id) {
      await markLinkedInIntegrationInactive(admin, integration.id, 'token_expired').catch(() => undefined);
    }
    return { companyPages: [], scopes: [], error: 'LinkedIn is not connected or token expired' };
  }

  const scopes = normalizeLinkedInScopes(integration.scopes);
  if (!linkedInHasOrganizationReadScope(scopes)) {
    return {
      companyPages: [],
      scopes,
      error: 'Reconnect LinkedIn and approve company page permissions (r_organization_admin / rw_organization_admin).',
      diagnostics: {
        pagesFound: 0,
        attempts: [],
        apiForbidden: false,
        missingOrgScopes: true,
        grantedScopes: scopes,
        hint: 'Organization read scopes were not granted on this token.',
      },
    };
  }

  let companyPages: LinkedInCompanyPage[] = [];
  let diagnostics: LinkedInCompanyPageFetchDiagnostics | null = null;
  try {
    const fetched = await fetchLinkedInCompanyPages(integration.accessToken, scopes);
    companyPages = fetched.companyPages;
    diagnostics = fetched.diagnostics;
  } catch (err) {
    if (err instanceof LinkedInApiError && err.code === 'TOKEN_EXPIRED') {
      await markLinkedInIntegrationInactive(admin, integration.id, 'token_expired').catch(() => undefined);
      return {
        companyPages: [],
        scopes,
        error: 'LinkedIn token expired. Reconnect LinkedIn and approve company page access again.',
      };
    }
    if (err instanceof LinkedInApiError && err.code === 'FORBIDDEN') {
      return {
        companyPages: [],
        scopes,
        error: 'LinkedIn denied organization access for this token. Reconnect and approve company page permissions again.',
      };
    }
    throw err;
  }
  const metadata =
    integration.metadata && typeof integration.metadata === 'object'
      ? { ...(integration.metadata as Record<string, unknown>) }
      : {};

  await admin
    .from('linkedin_integrations')
    .update({
      metadata: {
        ...metadata,
        company_pages: companyPages,
        company_pages_count: companyPages.length,
        company_pages_refreshed_at: new Date().toISOString(),
        company_pages_diagnostics: diagnostics,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  await syncLinkedInIdentities(admin, {
    tenantId: params.tenantId,
    integrationId: integration.id,
    personUrn: integration.linkedin_person_urn,
    linkedinMemberId: integration.linkedin_member_id,
    scopes,
    companyPages,
    profile: {
      name: typeof metadata.name === 'string' ? metadata.name : null,
      picture: typeof metadata.picture === 'string' ? metadata.picture : null,
      email: typeof metadata.email === 'string' ? metadata.email : null,
    },
  }).catch((err) => {
    console.error('[linkedin] refresh identities failed:', err);
  });

  return { companyPages, scopes, diagnostics: diagnostics || undefined, error: diagnostics?.hint || undefined };
}

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
    .map<LinkedInCompanyPage | null>((page) => {
      if (!page || typeof page !== 'object') return null;
      const obj = page as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id : '';
      if (!id) return null;
      return {
        id,
        name: typeof obj.name === 'string' ? obj.name : null,
        vanityName: typeof obj.vanityName === 'string' ? obj.vanityName : null,
        logoUrl: typeof obj.logoUrl === 'string' ? obj.logoUrl : null,
        roles: Array.isArray(obj.roles) ? obj.roles.map((role) => String(role)) : [],
        primaryRole: typeof obj.primaryRole === 'string' ? obj.primaryRole : null,
      } satisfies LinkedInCompanyPage;
    })
    .filter((page): page is LinkedInCompanyPage => !!page);
}

/** Merge company pages from integration metadata and linkedin_identities rows. */
export async function resolveLinkedInCompanyPagesForTenant(
  admin: SupabaseClient,
  tenantId: string,
  metadata?: unknown
): Promise<LinkedInCompanyPage[]> {
  const merged = new Map<string, LinkedInCompanyPage>();

  for (const page of extractCompanyPagesFromMetadata(metadata)) {
    merged.set(page.id, page);
  }

  const { data: orgIdentities, error } = await admin
    .from('linkedin_identities')
    .select('linkedin_organization_id, name, vanity_name, logo_url')
    .eq('tenant_id', tenantId)
    .eq('type', 'organization');

  if (!error || error.code === '42P01') {
    for (const org of orgIdentities || []) {
      const row = org as {
        linkedin_organization_id?: unknown;
        name?: unknown;
        vanity_name?: unknown;
        logo_url?: unknown;
      };
      const id = String(row.linkedin_organization_id || '').trim();
      if (!id) continue;
      const existing = merged.get(id);
      merged.set(id, {
        id,
        name: typeof row.name === 'string' ? row.name : existing?.name ?? null,
        vanityName: typeof row.vanity_name === 'string' ? row.vanity_name : existing?.vanityName ?? null,
        logoUrl: typeof row.logo_url === 'string' ? row.logo_url : existing?.logoUrl ?? null,
        roles: existing?.roles ?? [],
        primaryRole: existing?.primaryRole ?? null,
      });
    }
  }

  return Array.from(merged.values());
}

export function extractLinkedInOrganizationIdFromAuthorUrn(authorUrn: string): string | null {
  const prefix = 'urn:li:organization:';
  if (!authorUrn.startsWith(prefix)) return null;
  const id = authorUrn.slice(prefix.length).trim();
  return id || null;
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
  const currentOrgIds = new Set(params.companyPages.map((page) => page.id));

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

  await admin
    .from('linkedin_identities')
    .delete()
    .eq('tenant_id', params.tenantId)
    .eq('integration_id', params.integrationId)
    .eq('type', 'organization')
    .not(
      'linkedin_organization_id',
      'in',
      `(${Array.from(currentOrgIds)
        .map((id) => JSON.stringify(id))
        .join(',') || '""'})`
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
        metadata: {
          roles: page.roles || [],
          primary_role: page.primaryRole || null,
        },
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

  await admin
    .from('linkedin_identities')
    .delete()
    .eq('tenant_id', params.tenantId)
    .eq('integration_id', integration?.id || '');

  await admin
    .from('linkedin_integration_secrets')
    .delete()
    .eq('integration_id', integration?.id || '');

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
