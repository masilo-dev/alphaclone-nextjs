/**
 * Canonical social publishing types — used by SocialPublishingService,
 * MCP tools, cron workers, and dashboard routes.
 */

export const SOCIAL_POST_STATUSES = [
  'draft',
  'validating',
  'awaiting_approval',
  'approved',
  'uploading_media',
  'queued',
  'scheduled',
  'publishing',
  'published',
  'verification_failed',
  'retrying',
  'failed',
  'cancelled',
  'deleted',
  'orphaned',
] as const;

export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export type SocialPlatform = 'facebook' | 'linkedin';

export type SocialIdentityType =
  | 'facebook_page'
  | 'linkedin_person'
  | 'linkedin_organization';

export type ResolvedIdentity = {
  platform: SocialPlatform;
  identity_type: SocialIdentityType;
  identity_id: string;
  identity_name: string;
  author_urn?: string | null;
  organization_id?: string | null;
  page_id?: string | null;
  can_publish: boolean;
  missing_permissions: string[];
  token_expires_at?: string | null;
  role?: string | null;
};

export type FacebookPageIdentity = {
  page_id: string;
  page_name: string;
  connected: boolean;
  can_publish: boolean;
  can_upload_media: boolean;
  can_read_insights: boolean;
  missing_permissions: string[];
  token_expires_at: string | null;
};

export type LinkedInPersonalIdentity = {
  member_id: string | null;
  person_urn: string | null;
  can_publish: boolean;
};

export type LinkedInOrganizationIdentity = {
  organization_id: string;
  organization_urn: string;
  name: string;
  can_publish: boolean;
  role: string;
};

export type MediaAssetResult = {
  media_asset_id: string;
  public_url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  checksum: string;
  alt_text: string | null;
};

export type ProviderPublishResult = {
  ok: boolean;
  provider: SocialPlatform;
  provider_post_id: string | null;
  live_url: string | null;
  published_at: string | null;
  verified: boolean;
  verified_at: string | null;
  author_urn?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  provider_response?: Record<string, unknown> | null;
  error?: string | null;
  error_code?: string | null;
};

export type SocialActionReceipt = {
  action_id: string;
  provider: SocialPlatform;
  provider_reference: string | null;
  verified: boolean;
  verified_at: string | null;
  correlation_id: string;
  live_url?: string | null;
};

export type PublishSocialPostInput = {
  tenantId: string;
  userId: string;
  platform: SocialPlatform;
  identityType: SocialIdentityType;
  identityId: string;
  caption: string;
  mediaAssetIds?: string[];
  mediaUrls?: string[];
  linkUrl?: string | null;
  publishNow?: boolean;
  scheduledAt?: string | null;
  idempotencyKey?: string | null;
  correlationId?: string | null;
  aiClient?: string | null;
  confirmed?: boolean;
  skipApproval?: boolean;
};

export type PublishSocialPostResult = {
  ok: boolean;
  data: {
    social_post_id: string;
    platform: SocialPlatform;
    identity_type: SocialIdentityType;
    identity_id: string;
    identity_name: string;
    status: SocialPostStatus;
    provider_post_id: string | null;
    live_url: string | null;
    published_at: string | null;
    media_asset_ids: string[];
    linkedin_post_urn?: string | null;
    linkedin_author_urn?: string | null;
    linkedin_organization_id?: string | null;
    organization_name?: string | null;
  } | null;
  receipt: SocialActionReceipt | null;
  error: { code: string; message: string; retryable?: boolean } | null;
};

/** Canonical MCP tool names that must appear in tools/list. */
export const CANONICAL_SOCIAL_MCP_TOOLS = [
  'get_social_accounts',
  'get_social_identities',
  'get_facebook_identities',
  'get_facebook_page_capabilities',
  'get_linkedin_identities',
  'upload_media',
  'create_social_post',
  'create_social_post_with_media',
  'publish_social_post',
  'verify_social_post_published',
  'get_social_post',
  'get_social_posts',
  'retry_social_post',
  'delete_social_post',
  'get_social_post_insights',
] as const;

export type CanonicalSocialMcpTool = (typeof CANONICAL_SOCIAL_MCP_TOOLS)[number];

export const SOCIAL_PUBLISH_TOOL_CATALOG_VERSION = 'social-publishing-2.0';
