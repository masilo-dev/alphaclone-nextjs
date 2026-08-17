/**
 * Identity resolution for Facebook Pages and LinkedIn person/org destinations.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';
import {
  extractCompanyPagesFromMetadata,
  getLinkedInIntegrationWithToken,
  normalizeLinkedInScopes,
  resolveLinkedInCompanyPagesForTenant,
} from '@/services/linkedin/linkedinIntegrationService';
import {
  extractGrantedScopes,
  extractPageTasks,
  inspectFacebookPublishToken,
} from '@/lib/facebook/verifyFacebookPost';
import type {
  FacebookPageIdentity,
  LinkedInOrganizationIdentity,
  LinkedInPersonalIdentity,
  ResolvedIdentity,
  SocialIdentityType,
  SocialPlatform,
} from './types';

const FB_REQUIRED = ['pages_manage_posts'] as const;

export async function listFacebookIdentities(tenantId: string): Promise<{
  pages: FacebookPageIdentity[];
}> {
  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase
    .from('facebook_integrations')
    .select('id, page_id, page_name, is_active, expires_at, metadata')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);

  const pages: FacebookPageIdentity[] = [];
  for (const row of rows || []) {
    if (!row?.page_id) continue;
    const withToken = await getFacebookIntegrationWithToken(supabase, {
      tenantId,
      pageId: row.page_id,
    }).catch(() => null);

    const health = inspectFacebookPublishToken({
      pageId: row.page_id,
      pageAccessToken: withToken?.pageAccessToken,
      expiresAt: row.expires_at,
      metadata: (row.metadata || {}) as Record<string, unknown>,
    });
    const scopes = health.grantedScopes.map((s) => s.toLowerCase());
    const tasks = health.pageTasks;
    const hasTask =
      tasks.includes('MANAGE') || tasks.includes('CREATE_CONTENT') || tasks.includes('ADVERTISE');
    const missing: string[] = [];
    for (const req of FB_REQUIRED) {
      if (!scopes.includes(req) && !hasTask) missing.push(req);
    }
    const canPublish =
      Boolean(withToken?.pageAccessToken) &&
      !health.isExpired &&
      (health.hasPagesManagePosts || hasTask);
    const canInsights =
      scopes.includes('pages_read_engagement') || Boolean(withToken?.pageAccessToken);
    const canMedia = canPublish;

    pages.push({
      page_id: String(row.page_id),
      page_name: String(row.page_name || row.page_id),
      connected: true,
      can_publish: canPublish,
      can_upload_media: canMedia,
      can_read_insights: canInsights,
      missing_permissions: missing,
      token_expires_at: row.expires_at || null,
    });
  }

  return { pages };
}

export async function getFacebookPageCapabilities(
  tenantId: string,
  pageId?: string
): Promise<FacebookPageIdentity & { page_tasks: string[]; scopes: string[] }> {
  const { pages } = await listFacebookIdentities(tenantId);
  const page = pageId
    ? pages.find((p) => p.page_id === pageId)
    : pages.find((p) => p.can_publish) || pages[0];
  if (!page) {
    throw new Error('No connected Facebook Page found for this tenant');
  }
  const supabase = createSupabaseAdminClient();
  const integration = await getFacebookIntegrationWithToken(supabase, {
    tenantId,
    pageId: page.page_id,
  });
  const metadata = (integration?.metadata || {}) as Record<string, unknown>;
  return {
    ...page,
    page_tasks: extractPageTasks(metadata),
    scopes: extractGrantedScopes(metadata),
  };
}

export async function listLinkedInIdentities(tenantId: string): Promise<{
  personal: LinkedInPersonalIdentity | null;
  organizations: LinkedInOrganizationIdentity[];
}> {
  const supabase = createSupabaseAdminClient();

  // Tenant-scoped lookup (do not require a specific user_id for identity listing)
  const { data: integrationRow, error: liErr } = await supabase
    .from('linkedin_integrations')
    .select(
      'id, linkedin_member_id, linkedin_person_urn, scopes, metadata, is_active, user_id, updated_at'
    )
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (liErr) throw new Error(liErr.message);
  if (!integrationRow) {
    return { personal: null, organizations: [] };
  }

  const integration = await getLinkedInIntegrationWithToken(supabase, {
    tenantId,
    userId: integrationRow.user_id,
  }).catch(() => null);

  const scopes = normalizeLinkedInScopes(
    integration?.scopes ?? integrationRow.scopes
  );
  const canPostMember = scopes.includes('w_member_social');
  const canPostOrg = scopes.includes('w_organization_social');

  const personal: LinkedInPersonalIdentity = {
    member_id: integrationRow.linkedin_member_id || null,
    person_urn: integrationRow.linkedin_person_urn || null,
    can_publish: canPostMember && Boolean(integrationRow.linkedin_person_urn),
  };

  // Prefer linkedin_identities table; fall back to metadata company pages.
  // NEVER treat organization *scopes* alone as proof of an organization identity.
  const organizations: LinkedInOrganizationIdentity[] = [];
  const { data: orgRows, error: orgErr } = await supabase
    .from('linkedin_identities')
    .select('linkedin_organization_id, author_urn, name, can_post, role, metadata')
    .eq('tenant_id', tenantId)
    .eq('type', 'organization');

  if (!orgErr && orgRows && orgRows.length > 0) {
    for (const org of orgRows) {
      const orgId = String(org.linkedin_organization_id || '').trim();
      if (!orgId) continue;
      organizations.push({
        organization_id: orgId,
        organization_urn: org.author_urn || `urn:li:organization:${orgId}`,
        name: String(org.name || `Organization ${orgId}`),
        can_publish: org.can_post === true || canPostOrg,
        role: String(org.role || 'ADMINISTRATOR'),
      });
    }
  } else {
    const metadata = integration?.metadata ?? integrationRow.metadata;
    const pages = await resolveLinkedInCompanyPagesForTenant(
      supabase,
      tenantId,
      metadata
    ).catch(() => extractCompanyPagesFromMetadata(metadata));

    for (const page of pages || []) {
      const orgId = String(page.id || '').trim();
      if (!orgId) continue;
      organizations.push({
        organization_id: orgId,
        organization_urn: `urn:li:organization:${orgId}`,
        name: String(page.name || `Organization ${orgId}`),
        can_publish: canPostOrg,
        role: String(page.primaryRole || page.roles?.[0] || 'ADMINISTRATOR'),
      });
    }
  }

  return { personal, organizations };
}

export async function listSocialAccounts(tenantId: string) {
  const [facebook, linkedin] = await Promise.all([
    listFacebookIdentities(tenantId),
    listLinkedInIdentities(tenantId),
  ]);

  const accounts: Array<Record<string, unknown>> = [];
  for (const page of facebook.pages) {
    accounts.push({
      platform: 'facebook',
      identity_type: 'facebook_page',
      identity_id: page.page_id,
      name: page.page_name,
      connected: page.connected,
      can_publish: page.can_publish,
    });
  }
  if (linkedin.personal?.person_urn) {
    accounts.push({
      platform: 'linkedin',
      identity_type: 'linkedin_person',
      identity_id: linkedin.personal.member_id || linkedin.personal.person_urn,
      name: 'LinkedIn Personal',
      connected: true,
      can_publish: linkedin.personal.can_publish,
    });
  }
  for (const org of linkedin.organizations) {
    accounts.push({
      platform: 'linkedin',
      identity_type: 'linkedin_organization',
      identity_id: org.organization_id,
      name: org.name,
      connected: true,
      can_publish: org.can_publish,
      role: org.role,
    });
  }

  return {
    accounts,
    facebook,
    linkedin,
  };
}

export function normalizeIdentityType(type: string): SocialIdentityType {
  const norm = String(type || '').trim().toLowerCase();
  if (['linkedin_personal', 'personal', 'member', 'person', 'linkedin_person'].includes(norm)) {
    return 'linkedin_person';
  }
  if (['linkedin_org', 'linkedin_organization', 'organization', 'company', 'org'].includes(norm)) {
    return 'linkedin_organization';
  }
  if (['page', 'facebook_page', 'fb_page', 'facebook_page_identity'].includes(norm)) {
    return 'facebook_page';
  }
  return type as SocialIdentityType;
}

export async function resolveIdentity(params: {
  tenantId: string;
  platform: SocialPlatform;
  identityType: SocialIdentityType;
  identityId: string;
}): Promise<ResolvedIdentity> {
  const { tenantId, platform, identityId } = params;
  const identityType = normalizeIdentityType(params.identityType);
  const id = String(identityId || '').trim();
  if (!id) throw new Error('identity_id is required');

  if (platform === 'facebook') {
    if (identityType !== 'facebook_page') {
      throw new Error('Facebook publishing requires identity_type=facebook_page');
    }
    const caps = await getFacebookPageCapabilities(tenantId, id);
    if (caps.page_id !== id) {
      throw new Error(`Facebook page ${id} is not connected for this tenant`);
    }
    if (!caps.can_publish) {
      throw new Error(
        `Facebook page ${caps.page_name} cannot publish. Missing: ${
          caps.missing_permissions.join(', ') || 'page token or permissions'
        }`
      );
    }
    return {
      platform: 'facebook',
      identity_type: 'facebook_page',
      identity_id: caps.page_id,
      identity_name: caps.page_name,
      page_id: caps.page_id,
      can_publish: true,
      missing_permissions: caps.missing_permissions,
      token_expires_at: caps.token_expires_at,
    };
  }

  if (platform === 'linkedin') {
    const { personal, organizations } = await listLinkedInIdentities(tenantId);

    if (identityType === 'linkedin_organization') {
      const org = organizations.find((o) => o.organization_id === id);
      if (!org) {
        throw new Error(
          `LinkedIn organization ${id} was not resolved. Call get_linkedin_identities and pass a real organization_id — organization OAuth scopes alone are not an identity.`
        );
      }
      if (!org.can_publish) {
        throw new Error(
          `LinkedIn organization ${org.name} cannot publish (missing w_organization_social or admin role)`
        );
      }
      return {
        platform: 'linkedin',
        identity_type: 'linkedin_organization',
        identity_id: org.organization_id,
        identity_name: org.name,
        author_urn: org.organization_urn,
        organization_id: org.organization_id,
        can_publish: true,
        missing_permissions: [],
        role: org.role,
      };
    }

    if (identityType === 'linkedin_person') {
      if (isSocialPublishTestMode()) {
        throw new Error('SOCIAL_PUBLISH_TEST_MODE forbids publishing to personal LinkedIn profiles');
      }
      if (!personal?.person_urn) {
        throw new Error('LinkedIn personal identity is not connected');
      }
      const memberMatch =
        !id ||
        id === personal.member_id ||
        id === personal.person_urn ||
        id === 'me' ||
        id === 'personal';
      if (!memberMatch) {
        throw new Error(`LinkedIn personal identity ${id} does not match the connected member`);
      }
      if (!personal.can_publish) {
        throw new Error('LinkedIn personal profile cannot publish (missing w_member_social)');
      }
      return {
        platform: 'linkedin',
        identity_type: 'linkedin_person',
        identity_id: personal.member_id || personal.person_urn,
        identity_name: 'LinkedIn Personal',
        author_urn: personal.person_urn,
        can_publish: true,
        missing_permissions: [],
      };
    }

    throw new Error(`Unsupported LinkedIn identity_type: ${identityType}`);
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

export function isSocialPublishTestMode(): boolean {
  return String(process.env.SOCIAL_PUBLISH_TEST_MODE || '').toLowerCase() === 'true';
}

export function applyTestCaptionPrefix(caption: string): string {
  if (!isSocialPublishTestMode()) return caption;
  if (caption.trim().startsWith('[TEST]')) return caption;
  return `[TEST] ${caption}`;
}

export function getTestModeDestinations(): {
  facebookPageId: string | null;
  linkedinOrganizationId: string | null;
} {
  return {
    facebookPageId: process.env.SOCIAL_PUBLISH_TEST_FACEBOOK_PAGE_ID || null,
    linkedinOrganizationId: process.env.SOCIAL_PUBLISH_TEST_LINKEDIN_ORG_ID || null,
  };
}
