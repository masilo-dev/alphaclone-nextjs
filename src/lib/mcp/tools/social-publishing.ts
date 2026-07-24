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
  const tenantId = args.tenant_id || ctx.tenantId;
  if (!tenantId) throw new Error('tenant_id is required');
  return tenantId;
}

// ─── Identity tools ─────────────────────────────────────────────────────────

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
    const tenantId = requireTenantId(args, ctx);
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
    const tenantId = requireTenantId(args, ctx);
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
    const tenantId = requireTenantId(args, ctx);
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
    const tenantId = requireTenantId(args, ctx);
    return listSocialAccounts(tenantId);
  },
});

// ─── Media ──────────────────────────────────────────────────────────────────

registerTool('social-publishing', {
  name: 'upload_media',
  description:
    'Upload base64 media to tenant-scoped storage. Returns media_asset_id and a public provider-fetchable URL. Never stores data URIs in posts.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    filename: z.string().min(1),
    mime_type: z.string().min(1),
    content_base64: z.string().min(1),
    alt_text: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      filename: { type: 'string' },
      mime_type: { type: 'string' },
      content_base64: { type: 'string' },
      alt_text: { type: 'string' },
    },
    required: ['filename', 'mime_type', 'content_base64'],
  },
  handler: async (args, ctx) => {
    if (!ctx.userId) throw new Error('user_id is required');
    const tenantId = requireTenantId(args, ctx);
    return uploadSocialMedia({
      tenantId,
      userId: ctx.userId,
      filename: args.filename,
      mimeType: args.mime_type,
      contentBase64: args.content_base64,
      altText: args.alt_text,
    });
  },
});

// ─── Publish ────────────────────────────────────────────────────────────────

registerTool('social-publishing', {
  name: 'publish_social_post',
  description:
    'Publish (or schedule) a social post to Facebook Page or LinkedIn person/organization. Immediate publish returns provider post ID, live URL, and verification receipt — never ok on DB insert alone.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    platform: z.enum(['facebook', 'linkedin']),
    identity_type: z.enum(['facebook_page', 'linkedin_person', 'linkedin_organization']),
    identity_id: z.string().min(1),
    caption: z.string().min(1),
    media_asset_ids: z.array(z.string().uuid()).optional(),
    media_urls: z.array(z.string()).optional(),
    link_url: z.string().url().optional(),
    publish_now: z.boolean().optional().default(false),
    scheduled_at: z.string().datetime().optional(),
    idempotency_key: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['facebook', 'linkedin'] },
      identity_type: {
        type: 'string',
        enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
      },
      identity_id: { type: 'string', description: 'Page ID, member ID, or organization ID' },
      caption: { type: 'string' },
      media_asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
      media_urls: { type: 'array', items: { type: 'string' } },
      link_url: { type: 'string' },
      publish_now: { type: 'boolean' },
      scheduled_at: { type: 'string', format: 'date-time' },
      idempotency_key: { type: 'string' },
    },
    required: ['platform', 'identity_type', 'identity_id', 'caption'],
  },
  handler: async (args, ctx) => {
    if (!ctx.userId) throw new Error('user_id is required');
    const tenantId = requireTenantId(args, ctx);
    const service = getSocialPublishingService();
    const result = await service.publish({
      tenantId,
      userId: ctx.userId,
      platform: args.platform,
      identityType: args.identity_type,
      identityId: args.identity_id,
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
          'publish_social_post',
          result.error?.code || 'PUBLISH_FAILED',
          result.error?.message || 'Publish failed',
          result.data,
          { retryable: result.error?.retryable }
        )
      );
    }

    return toMcpContent(
      okResult('publish_social_post', result.data, {
        receipt: result.receipt
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
          : null,
        meta: { tool_catalog_version: SOCIAL_PUBLISH_TOOL_CATALOG_VERSION },
      })
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
    if (!ctx.userId) throw new Error('user_id is required');
    const tenantId = requireTenantId(args, ctx);
    const platform = (args.platform ||
      (Array.isArray(args.platforms) ? args.platforms[0] : 'facebook')) as
      | 'facebook'
      | 'linkedin';

    let identityType = args.identity_type;
    let identityId = args.identity_id || args.page_id || args.linkedin_organization_id;

    if (!identityType) {
      if (platform === 'facebook') {
        identityType = 'facebook_page';
        if (!identityId) {
          const { pages } = await listFacebookIdentities(tenantId);
          const page = pages.find((p) => p.can_publish) || pages[0];
          if (!page) throw new Error('No Facebook Page connected');
          identityId = page.page_id;
        }
      } else if (args.post_as === 'company' || args.post_as === 'organization' || args.linkedin_organization_id) {
        identityType = 'linkedin_organization';
        if (!identityId) {
          throw new Error(
            'linkedin_organization_id is required for company posts — call get_linkedin_identities'
          );
        }
      } else {
        identityType = 'linkedin_person';
        if (!identityId) {
          const { personal } = await listLinkedInIdentities(tenantId);
          if (!personal?.member_id && !personal?.person_urn) {
            throw new Error('LinkedIn personal identity not connected');
          }
          identityId = personal.member_id || personal.person_urn || 'me';
        }
      }
    }

    if (!identityId) throw new Error('identity_id is required');

    const service = getSocialPublishingService();
    const result = await service.publish({
      tenantId,
      userId: ctx.userId,
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
    if (!ctx.userId) throw new Error('user_id is required');
    const tenantId = requireTenantId(args, ctx);
    const filename = args.filename || args.file_name || 'upload.bin';
    const contentBase64 = args.content_base64 || args.file_base64;
    if (!contentBase64) throw new Error('content_base64 (or file_base64) is required');

    const asset = await uploadSocialMedia({
      tenantId,
      userId: ctx.userId,
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
    return executeTool(tenantId, ctx.userId, 'create_social_post', {
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
    const tenantId = requireTenantId(args, ctx);
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
    const tenantId = requireTenantId(args, ctx);
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
    const tenantId = requireTenantId(args, ctx);
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
    if (!ctx.userId) throw new Error('user_id is required');
    const tenantId = requireTenantId(args, ctx);
    const service = getSocialPublishingService();
    const result = await service.retryFailedPost({
      tenantId,
      postId: args.social_post_id,
      userId: ctx.userId,
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
    const tenantId = requireTenantId(args, ctx);
    const supabase = createSupabaseAdminClient();
    const { data: post, error } = await supabase
      .from('social_posts')
      .select('id, status, facebook_post_id, facebook_page_id, linkedin_post_urn')
      .eq('tenant_id', tenantId)
      .eq('id', args.social_post_id)
      .maybeSingle();
    if (error) throw error;
    if (!post) throw new Error('Social post not found');

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
    const tenantId = requireTenantId(args, ctx);
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
    let pageId = args.page_id;
    if (!pageId) {
      const { pages } = await listFacebookIdentities(args.tenant_id);
      pageId = (pages.find((p) => p.can_publish) || pages[0])?.page_id;
    }
    if (!pageId) throwConnectorError('MISSING_IDENTITY', 'No Facebook Page connected');
    const service = getSocialPublishingService();
    const result = await service.publish({
      tenantId: args.tenant_id,
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
