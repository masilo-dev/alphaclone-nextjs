/**
 * Canonical social publishing MCP tools.
 * Registered in the tool registry so tools/list and inspect_tools stay aligned.
 */

import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult, errorResult, toMcpContent, throwConnectorError } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getSocialPublishingService } from '@/lib/social/SocialPublishingService';
import {
  listFacebookIdentities,
  getFacebookPageCapabilities,
  listLinkedInIdentities,
  listSocialAccounts,
} from '@/lib/social/identityResolution';
import { uploadSocialMedia } from '@/lib/social/mediaUpload';
import { CANONICAL_SOCIAL_MCP_TOOLS, SOCIAL_PUBLISH_TOOL_CATALOG_VERSION } from '@/lib/social/types';

function requireTenantId(args: { tenant_id?: string }, ctx: { tenantId?: string }) {
  // Session tenant is authoritative — never prefer model-supplied tenant_id.
  const tenantId = ctx.tenantId || args.tenant_id;
  if (!tenantId) throw new Error('tenant_id is required');
  if (ctx.tenantId && args.tenant_id && ctx.tenantId !== args.tenant_id) {
    throw new Error('tenant_id does not match active workspace');
  }
  return ctx.tenantId || tenantId;
}

async function requireSocialAuth(
  args: { tenant_id?: string },
  ctx: { tenantId?: string; userId?: string },
  permission: 'social:read' | 'social:write' | 'social:publish'
): Promise<{ tenantId: string; userId: string }> {
  const tenantId = requireTenantId(args, ctx);
  const userId = ctx.userId;
  if (!userId) throw new Error('Authenticated user required');
  const { assertTenantMembership } = await import('@/lib/tenant/platformTenant');
  const { assertPermission } = await import('@/lib/mcp/connector/permissions');
  await assertTenantMembership(tenantId, userId);
  await assertPermission(tenantId, userId, permission);
  return { tenantId, userId };
}

// ─── Identity tools ─────────────────────────────────────────────────────────

registerTool('social-publishing', {
  name: 'get_social_identities',
  description:
    'List tenant-scoped social identities available for publishing. Never returns tokens. Use identity_id from this list with publish_social_post. Alphaclone never injects a global default page/org.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    provider: z.enum(['facebook', 'linkedin', 'instagram', 'x', 'tiktok']).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['facebook', 'linkedin', 'instagram', 'x', 'tiktok'],
      },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    const { listTenantSocialIdentities, syncTenantSocialIdentitiesFromLegacy } = await import(
      '@/lib/social/socialIdentityStore'
    );
    // Best-effort sync so newly connected accounts appear
    await syncTenantSocialIdentitiesFromLegacy(tenantId).catch(() => undefined);
    const identities = await listTenantSocialIdentities({
      tenantId,
      provider: args.provider,
      activeOnly: true,
    });
    return {
      identities: identities.map((i) => ({
        identity_id: i.identity_id,
        identity_type: i.identity_type,
        provider: i.provider,
        display_name: i.display_name,
        provider_identity_id: i.provider_identity_id,
        can_publish: i.can_publish,
        can_upload_media: i.can_upload_media,
        is_default: i.is_default,
      })),
    };
  },
});

registerTool('social-publishing', {
  name: 'get_facebook_identities',
  description:
    'List connected Facebook Pages with publish/media/insights capabilities for the tenant.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    return listFacebookIdentities(tenantId);
  },
});

registerTool('social-publishing', {
  name: 'get_facebook_page_capabilities',
  description: 'Return publish capabilities for a specific Facebook Page (or the preferred page).',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    page_id: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      page_id: { type: 'string', description: 'Facebook Page ID' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    return getFacebookPageCapabilities(tenantId, args.page_id);
  },
});

// Override get_linkedin_identities shape via re-registration after social.ts loads.
// tool-registry Map overwrites by name — load this module AFTER social.ts.
registerTool('social-publishing', {
  name: 'get_linkedin_identities',
  description:
    'List LinkedIn personal profile and organization identities. Organization scopes alone are not returned as identities.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    return listLinkedInIdentities(tenantId);
  },
});

registerTool('social-publishing', {
  name: 'get_social_accounts',
  description:
    'List all connected social publishing destinations (Facebook Pages + LinkedIn person/org).',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    return listSocialAccounts(tenantId);
  },
});

// ─── Media ──────────────────────────────────────────────────────────────────

registerTool('social-publishing', {
  name: 'upload_media',
  description:
    'Upload media into the tenant media library. Accepts content_base64 (+filename/mime_type), or url, or data_url. Returns asset id and a public https URL. Never returns storage credentials.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    filename: z.string().optional(),
    mime_type: z.string().optional(),
    content_base64: z.string().optional(),
    url: z.string().optional(),
    data_url: z.string().optional(),
    purpose: z.string().optional(),
    alt_text: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      filename: { type: 'string' },
      mime_type: { type: 'string' },
      content_base64: { type: 'string', description: 'Raw base64 or data URL' },
      url: { type: 'string', description: 'Public HTTPS URL to ingest' },
      data_url: { type: 'string', description: 'data:image/...;base64,...' },
      purpose: { type: 'string' },
      alt_text: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:write');
    const { ingestMediaInput } = await import('@/lib/media/ingestMedia');

    if (args.data_url || (args.content_base64 && String(args.content_base64).startsWith('data:'))) {
      const asset = await ingestMediaInput({
        tenantId,
        userId,
        purpose: args.purpose || 'social_post',
        media: {
          type: 'data_url',
          dataUrl: args.data_url || String(args.content_base64),
          filename: args.filename,
        },
      });
      return {
        ok: true,
        asset: {
          id: asset.id,
          filename: asset.filename,
          mime_type: asset.mime_type,
          size_bytes: asset.size_bytes,
          url: asset.url,
          status: asset.status,
        },
        media_asset_id: asset.id,
        public_url: asset.url,
      };
    }

    if (args.url) {
      const asset = await ingestMediaInput({
        tenantId,
        userId,
        purpose: args.purpose || 'social_post',
        media: { type: 'url', url: args.url, filename: args.filename },
      });
      return {
        ok: true,
        asset: {
          id: asset.id,
          filename: asset.filename,
          mime_type: asset.mime_type,
          size_bytes: asset.size_bytes,
          url: asset.url,
          status: asset.status,
        },
        media_asset_id: asset.id,
        public_url: asset.url,
      };
    }

    if (!args.content_base64 || !args.filename || !args.mime_type) {
      throw new Error('Provide content_base64+filename+mime_type, or url, or data_url');
    }

    const uploaded = await uploadSocialMedia({
      tenantId,
      userId,
      filename: args.filename,
      mimeType: args.mime_type,
      contentBase64: args.content_base64,
      altText: args.alt_text,
    });
    return {
      ok: true,
      asset: {
        id: uploaded.media_asset_id,
        filename: uploaded.filename,
        mime_type: uploaded.mime_type,
        size_bytes: uploaded.size_bytes,
        url: uploaded.public_url,
        status: 'ready',
      },
      media_asset_id: uploaded.media_asset_id,
      public_url: uploaded.public_url,
    };
  },
});

// ─── Publish ────────────────────────────────────────────────────────────────

registerTool('social-publishing', {
  name: 'publish_social_post',
  description:
    'Publish (or schedule) a social post to a tenant-scoped identity. Prefer identity_id from get_social_identities. Immediate publish returns provider post ID, live URL, and verification receipt — never ok on DB insert alone. Never accepts access tokens.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    identity_id: z.string().min(1).optional(),
    platform: z.enum(['facebook', 'linkedin']).optional(),
    identity_type: z.enum(['facebook_page', 'linkedin_person', 'linkedin_organization']).optional(),
    caption: z.string().optional(),
    content: z.string().optional(),
    media: z.array(z.record(z.unknown())).optional(),
    media_asset_ids: z.array(z.string().uuid()).optional(),
    media_urls: z.array(z.string()).optional(),
    link_url: z.string().url().optional(),
    publish_now: z.boolean().optional().default(false),
    status: z.enum(['publish_now', 'draft', 'scheduled']).optional(),
    scheduled_at: z.string().datetime().optional(),
    idempotency_key: z.string().optional(),
  }).refine((v) => Boolean(String(v.caption || v.content || '').trim()), {
    message: 'caption or content is required',
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      identity_id: {
        type: 'string',
        description: 'Internal identity UUID from get_social_identities (preferred)',
      },
      platform: { type: 'string', enum: ['facebook', 'linkedin'] },
      identity_type: {
        type: 'string',
        enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
      },
      caption: { type: 'string' },
      content: { type: 'string', description: 'Alias for caption' },
      media: {
        type: 'array',
        description:
          'Unified media inputs: {type:asset_id|base64|data_url|url, ...}. Prefer upload_media then asset_id.',
        items: { type: 'object' },
      },
      media_asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
      media_urls: { type: 'array', items: { type: 'string' } },
      link_url: { type: 'string' },
      publish_now: { type: 'boolean' },
      status: { type: 'string', enum: ['publish_now', 'draft', 'scheduled'] },
      scheduled_at: { type: 'string', format: 'date-time' },
      idempotency_key: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:publish');

    const { resolveTenantIdentityForPublish } = await import('@/lib/social/socialIdentityStore');
    const { TenantIsolationError } = await import('@/lib/social/tenantGuard');
    const { ingestPublishMedia } = await import('@/lib/media/ingestMedia');
    const { persistActionReceipt } = await import('@/lib/mcp/actionReceipts');

    let stored;
    try {
      stored = await resolveTenantIdentityForPublish({
        tenantId,
        identityId: args.identity_id,
        identityType: args.identity_type,
        provider: args.platform,
        allowDefault: !args.identity_id && !args.identity_type,
      });
    } catch (err) {
      if (err instanceof TenantIsolationError) {
        return toMcpContent(
          errorResult('publish_social_post', err.code, err.message)
        );
      }
      throw err;
    }

    const platform = (stored.provider === 'linkedin' ? 'linkedin' : 'facebook') as
      | 'facebook'
      | 'linkedin';
    const identityType = stored.identity_type as
      | 'facebook_page'
      | 'linkedin_person'
      | 'linkedin_organization';

    const ingested = await ingestPublishMedia({
      tenantId,
      userId,
      media: args.media as any,
      mediaUrls: args.media_urls,
      mediaAssetIds: args.media_asset_ids,
    });

    const publishNow =
      args.publish_now === true || args.status === 'publish_now' || (!args.scheduled_at && args.status !== 'draft');

    const service = getSocialPublishingService();
    const result = await service.publish({
      tenantId,
      userId,
      platform,
      identityType,
      identityId: stored.provider_identity_id,
      caption: args.caption || args.content || '',
      mediaAssetIds: ingested.assetIds,
      mediaUrls: ingested.urls,
      linkUrl: args.link_url,
      publishNow,
      scheduledAt: args.scheduled_at,
      idempotencyKey: args.idempotency_key,
      aiClient: 'mcp',
    });

    if (!result.ok) {
      return toMcpContent(
        errorResult(
          'publish_social_post',
          result.error?.code || 'PUBLISH_FAILED',
          result.error?.message || 'Publish failed',
          result.data,
          { retryable: result.error?.retryable }
        )
      );
    }

    const receiptPayload = result.receipt
      ? {
          action_id: result.receipt.action_id,
          status: result.data?.status || 'published',
          provider: result.receipt.provider,
          provider_reference: result.receipt.provider_reference,
          live_url: result.receipt.live_url,
          timestamp: result.receipt.verified_at || new Date().toISOString(),
          entity_id: result.data?.social_post_id,
          entity_type: 'social_post',
          verification: {
            verified: result.receipt.verified,
            verified_at: result.receipt.verified_at,
            correlation_id: result.receipt.correlation_id,
          },
        }
      : null;

    if (receiptPayload && args.idempotency_key) {
      await persistActionReceipt({
        tenantId,
        userId,
        tool: 'publish_social_post',
        idempotencyKey: args.idempotency_key,
        receipt: receiptPayload,
        success: true,
        sanitizedInput: {
          platform,
          identity_id: stored.identity_id,
          media_asset_ids: ingested.assetIds,
        },
        sanitizedOutput: result.data,
      }).catch(() => undefined);
    }

    return toMcpContent(
      okResult(
        'publish_social_post',
        {
          ...result.data,
          media_asset_ids: ingested.assetIds,
          identity_id: stored.identity_id,
          identity_display_name: stored.display_name,
        },
        {
          receipt: receiptPayload,
          meta: { tool_catalog_version: SOCIAL_PUBLISH_TOOL_CATALOG_VERSION },
        }
      )
    );
  },
});

registerTool('social-publishing', {
  name: 'create_social_post',
  description:
    'Create a social post (draft/scheduled) or publish immediately via publish_now. Prefer publish_social_post for explicit identity selection.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    platform: z.enum(['facebook', 'linkedin']).optional(),
    platforms: z.array(z.string()).optional(),
    identity_type: z
      .enum(['facebook_page', 'linkedin_person', 'linkedin_organization'])
      .optional(),
    identity_id: z.string().optional(),
    page_id: z.string().optional(),
    linkedin_organization_id: z.string().optional(),
    post_as: z.enum(['personal', 'company', 'organization']).optional(),
    caption: z.string().min(1),
    media_asset_ids: z.array(z.string()).optional(),
    media_urls: z.array(z.string()).optional(),
    link_url: z.string().optional(),
    publish_now: z.boolean().optional(),
    scheduled_at: z.string().optional(),
    idempotency_key: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['facebook', 'linkedin'] },
      platforms: { type: 'array', items: { type: 'string' } },
      identity_type: {
        type: 'string',
        enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
      },
      identity_id: { type: 'string' },
      page_id: { type: 'string' },
      linkedin_organization_id: { type: 'string' },
      post_as: { type: 'string', enum: ['personal', 'company', 'organization'] },
      caption: { type: 'string' },
      media_asset_ids: { type: 'array', items: { type: 'string' } },
      media_urls: { type: 'array', items: { type: 'string' } },
      link_url: { type: 'string' },
      publish_now: { type: 'boolean' },
      scheduled_at: { type: 'string', format: 'date-time' },
      idempotency_key: { type: 'string' },
    },
    required: ['caption'],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:publish');
    const platform = (args.platform ||
      (Array.isArray(args.platforms) ? args.platforms[0] : 'facebook')) as
      | 'facebook'
      | 'linkedin';

    let identityType = args.identity_type;
    let identityId = args.identity_id || args.page_id || args.linkedin_organization_id;

    const { resolveTenantIdentityForPublish } = await import('@/lib/social/socialIdentityStore');
    const { TenantIsolationError } = await import('@/lib/social/tenantGuard');
    try {
      const stored = await resolveTenantIdentityForPublish({
        tenantId,
        identityId,
        identityType:
          identityType ||
          (platform === 'facebook'
            ? 'facebook_page'
            : args.post_as === 'company' ||
                args.post_as === 'organization' ||
                args.linkedin_organization_id
              ? 'linkedin_organization'
              : undefined),
        provider: platform,
        allowDefault: !identityId,
      });
      identityType = stored.identity_type as typeof identityType;
      identityId = stored.provider_identity_id;
    } catch (err) {
      if (err instanceof TenantIsolationError) throw new Error(`${err.code}: ${err.message}`);
      throw err;
    }

    if (!identityId || !identityType) {
      throw new Error(
        'identity_id is required — call get_social_identities and select a destination'
      );
    }

    const service = getSocialPublishingService();
    const result = await service.publish({
      tenantId,
      userId,
      platform,
      identityType,
      identityId,
      caption: args.caption,
      mediaAssetIds: args.media_asset_ids,
      mediaUrls: args.media_urls,
      linkUrl: args.link_url,
      publishNow: args.publish_now,
      scheduledAt: args.scheduled_at,
      idempotencyKey: args.idempotency_key,
      aiClient: 'mcp',
    });

    if (!result.ok) {
      return toMcpContent(
        errorResult(
          'create_social_post',
          result.error?.code || 'PUBLISH_FAILED',
          result.error?.message || 'Publish failed',
          result.data
        )
      );
    }
    return toMcpContent(
      okResult('create_social_post', result.data, {
        receipt: result.receipt
          ? {
              action_id: result.receipt.action_id,
              status: result.data?.status || 'completed',
              provider: result.receipt.provider,
              provider_reference: result.receipt.provider_reference,
              live_url: result.receipt.live_url,
              timestamp: new Date().toISOString(),
              entity_id: result.data?.social_post_id,
              entity_type: 'social_post',
              verification: {
                verified: result.receipt.verified,
                correlation_id: result.receipt.correlation_id,
              },
            }
          : null,
      })
    );
  },
});

registerTool('social-publishing', {
  name: 'create_social_post_with_media',
  description: 'Upload base64 media then create/publish a social post in one call.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    caption: z.string().min(1),
    filename: z.string().optional(),
    file_name: z.string().optional(),
    mime_type: z.string(),
    content_base64: z.string().optional(),
    file_base64: z.string().optional(),
    platform: z.enum(['facebook', 'linkedin']).optional(),
    platforms: z.array(z.string()).optional(),
    identity_type: z
      .enum(['facebook_page', 'linkedin_person', 'linkedin_organization'])
      .optional(),
    identity_id: z.string().optional(),
    page_id: z.string().optional(),
    linkedin_organization_id: z.string().optional(),
    publish_now: z.boolean().optional(),
    scheduled_at: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      caption: { type: 'string' },
      filename: { type: 'string' },
      file_name: { type: 'string' },
      mime_type: { type: 'string' },
      content_base64: { type: 'string' },
      file_base64: { type: 'string' },
      platform: { type: 'string', enum: ['facebook', 'linkedin'] },
      platforms: { type: 'array', items: { type: 'string' } },
      identity_type: {
        type: 'string',
        enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
      },
      identity_id: { type: 'string' },
      page_id: { type: 'string' },
      linkedin_organization_id: { type: 'string' },
      publish_now: { type: 'boolean' },
      scheduled_at: { type: 'string', format: 'date-time' },
    },
    required: ['caption', 'mime_type'],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:publish');
    const filename = args.filename || args.file_name || 'upload.bin';
    const contentBase64 = args.content_base64 || args.file_base64;
    if (!contentBase64) throw new Error('content_base64 (or file_base64) is required');

    const asset = await uploadSocialMedia({
      tenantId,
      userId,
      filename,
      mimeType: args.mime_type,
      contentBase64,
    });

    const platform = (args.platform ||
      (Array.isArray(args.platforms) ? args.platforms[0] : 'facebook')) as
      | 'facebook'
      | 'linkedin';

    // Delegate to create_social_post handler logic via service
    const { executeTool } = await import('../tool-registry');
    return executeTool(tenantId, userId, 'create_social_post', {
      tenant_id: tenantId,
      platform,
      platforms: args.platforms || [platform],
      identity_type: args.identity_type,
      identity_id: args.identity_id,
      page_id: args.page_id,
      linkedin_organization_id: args.linkedin_organization_id,
      caption: args.caption,
      media_asset_ids: [asset.media_asset_id],
      publish_now: args.publish_now,
      scheduled_at: args.scheduled_at,
    });
  },
});

registerTool('social-publishing', {
  name: 'verify_social_post_published',
  description:
    'Verify a social post exists on Facebook or LinkedIn using the stored provider ID. Returns verified=true only with provider evidence.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    social_post_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      social_post_id: { type: 'string', format: 'uuid' },
    },
    required: ['social_post_id'],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    const service = getSocialPublishingService();
    const result = await service.verifyProviderPost({
      tenantId,
      postId: args.social_post_id,
    });
    if (!result.ok || !result.verified) {
      return toMcpContent(
        errorResult(
          'verify_social_post_published',
          result.error_code || 'VERIFICATION_FAILED',
          result.error || 'Verification failed',
          result
        )
      );
    }
    return result;
  },
});

registerTool('social-publishing', {
  name: 'get_social_post',
  description: 'Fetch a single social post by id for the tenant.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    social_post_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      social_post_id: { type: 'string', format: 'uuid' },
    },
    required: ['social_post_id'],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', args.social_post_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Social post not found');
    return data;
  },
});

registerTool('social-publishing', {
  name: 'get_social_posts',
  description: 'List social posts for the tenant with optional status filter.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().default(25),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      limit: { type: 'number' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('social_posts')
      .select(
        'id, platforms, platform, caption, status, scheduled_at, published_at, facebook_page_id, facebook_post_id, linkedin_organization_id, linkedin_post_urn, linkedin_author_urn, live_url, error_message, created_at'
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(args.limit || 25);
    if (args.status) query = query.eq('status', args.status);
    const { data, error } = await query;
    if (error) throw error;
    return { posts: data || [] };
  },
});

registerTool('social-publishing', {
  name: 'retry_social_post',
  description:
    'Retry a failed social post without duplicating an already-published provider post.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    social_post_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      social_post_id: { type: 'string', format: 'uuid' },
    },
    required: ['social_post_id'],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:publish');
    const service = getSocialPublishingService();
    const result = await service.retryFailedPost({
      tenantId,
      postId: args.social_post_id,
      userId,
    });
    if (!result.ok) {
      return toMcpContent(
        errorResult(
          'retry_social_post',
          result.error?.code || 'RETRY_FAILED',
          result.error?.message || 'Retry failed',
          result.data
        )
      );
    }
    return toMcpContent(okResult('retry_social_post', result.data, { receipt: result.receipt as any }));
  },
});

registerTool('social-publishing', {
  name: 'delete_social_post',
  description:
    'Delete a social post. For published Facebook posts, attempts provider deletion and records evidence.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    social_post_id: z.string().uuid(),
    delete_from_provider: z.boolean().optional().default(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      social_post_id: { type: 'string', format: 'uuid' },
      delete_from_provider: { type: 'boolean' },
    },
    required: ['social_post_id'],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:write');
    const supabase = createSupabaseAdminClient();
    const { data: post, error } = await supabase
      .from('social_posts')
      .select('id, status, facebook_post_id, facebook_page_id, linkedin_post_urn')
      .eq('tenant_id', tenantId)
      .eq('id', args.social_post_id)
      .maybeSingle();
    if (error) throw error;
    if (!post) throw new Error('Social post not found');

    void userId;
    const evidence: Record<string, unknown> = {};
    if (args.delete_from_provider !== false && post.facebook_post_id) {
      const { getFacebookIntegrationWithToken } = await import(
        '@/services/facebook/facebookIntegrationService'
      );
      const integration = await getFacebookIntegrationWithToken(supabase, {
        tenantId,
        pageId: post.facebook_page_id || undefined,
      });
      if (integration?.pageAccessToken) {
        const resp = await fetch(
          `https://graph.facebook.com/v19.0/${encodeURIComponent(post.facebook_post_id)}?access_token=${encodeURIComponent(integration.pageAccessToken)}`,
          { method: 'DELETE' }
        );
        const body = await resp.json().catch(() => ({}));
        evidence.facebook_delete = {
          http_status: resp.status,
          ok: resp.ok && !body?.error,
          // Never log tokens
          provider_body: body?.error ? { error: body.error } : { success: true },
        };
      }
    }

    await supabase
      .from('social_posts')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        metadata: { delete_evidence: evidence },
      })
      .eq('id', post.id)
      .eq('tenant_id', tenantId);

    return {
      deleted: true,
      social_post_id: post.id,
      provider_evidence: evidence,
    };
  },
});

registerTool('social-publishing', {
  name: 'get_social_post_insights',
  description: 'Fetch engagement insights for a published social post when the provider supports it.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    social_post_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      social_post_id: { type: 'string', format: 'uuid' },
    },
    required: ['social_post_id'],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    const supabase = createSupabaseAdminClient();
    const { data: post, error } = await supabase
      .from('social_posts')
      .select('id, facebook_post_id, facebook_page_id, linkedin_stats, analytics')
      .eq('tenant_id', tenantId)
      .eq('id', args.social_post_id)
      .maybeSingle();
    if (error) throw error;
    if (!post) throw new Error('Social post not found');

    if (post.facebook_post_id) {
      const { getFacebookIntegrationWithToken } = await import(
        '@/services/facebook/facebookIntegrationService'
      );
      const integration = await getFacebookIntegrationWithToken(supabase, {
        tenantId,
        pageId: post.facebook_page_id || undefined,
      });
      if (!integration?.pageAccessToken) {
        return { social_post_id: post.id, insights: [], note: 'Facebook token unavailable' };
      }
      const metrics = [
        'post_impressions',
        'post_impressions_unique',
        'post_engaged_users',
        'post_clicks',
      ].join(',');
      const resp = await fetch(
        `https://graph.facebook.com/v19.0/${encodeURIComponent(post.facebook_post_id)}/insights?metric=${metrics}&access_token=${encodeURIComponent(integration.pageAccessToken)}`
      );
      const body = await resp.json();
      if (!resp.ok || body?.error) {
        throw new Error(body?.error?.message || 'Facebook insights unavailable');
      }
      return { social_post_id: post.id, platform: 'facebook', insights: body.data || [] };
    }

    return {
      social_post_id: post.id,
      platform: 'linkedin',
      insights: post.linkedin_stats || post.analytics || {},
    };
  },
});

// Connector wrapper for ChatGPT curated surface — publish_post compatibility
defineConnectorTool({
  module: 'social-publishing',
  name: 'publish_facebook_multi_photo',
  description: 'Publish multiple photos to a Facebook Page in one post.',
  permission: 'social:publish',
  rateLimitClass: 'publish',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    page_id: z.string().optional(),
    caption: z.string().min(1),
    media_asset_ids: z.array(z.string().uuid()).min(2),
    publish_now: z.boolean().optional().default(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      page_id: { type: 'string' },
      caption: { type: 'string' },
      media_asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
      publish_now: { type: 'boolean' },
    },
    required: ['tenant_id', 'caption', 'media_asset_ids'],
  },
  handler: async (args, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId || !ctx.userId) {
      throwConnectorError('AUTH_REQUIRED', 'Active workspace and user required');
    }
    let pageId = args.page_id;
    if (!pageId) {
      const { pages } = await listFacebookIdentities(tenantId!);
      pageId = (pages.find((p) => p.can_publish) || pages[0])?.page_id;
    }
    if (!pageId) throwConnectorError('MISSING_IDENTITY', 'No Facebook Page connected');
    const service = getSocialPublishingService();
    const result = await service.publish({
      tenantId: tenantId!,
      userId: ctx.userId!,
      platform: 'facebook',
      identityType: 'facebook_page',
      identityId: pageId!,
      caption: args.caption,
      mediaAssetIds: args.media_asset_ids,
      publishNow: args.publish_now !== false,
      aiClient: 'mcp',
    });
    if (!result.ok) {
      throwConnectorError(result.error?.code || 'PUBLISH_FAILED', result.error?.message || 'Failed');
    }
    return result.data;
  },
});

export { CANONICAL_SOCIAL_MCP_TOOLS, SOCIAL_PUBLISH_TOOL_CATALOG_VERSION };

// Bust discovery cache after this module registers canonical tools
try {
  const { invalidateUnifiedMcpToolCache } = require('../listAllTools');
  invalidateUnifiedMcpToolCache();
} catch {
  // ignore during early bootstrap
}
