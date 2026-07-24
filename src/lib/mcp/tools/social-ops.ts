import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';

defineConnectorTool({
  module: 'social-ops',
  name: 'connected_accounts',
  description:
    'List connected social media accounts for the tenant (Facebook Pages + LinkedIn person/org from dedicated integration tables).',
  permission: 'social:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const { listSocialAccounts } = await import('@/lib/social/identityResolution');
    const resolved = await listSocialAccounts(args.tenant_id);
    return {
      accounts: resolved.accounts,
      facebook: resolved.facebook,
      linkedin: resolved.linkedin,
    };
  },
});

defineConnectorTool({
  module: 'social-ops',
  name: 'scheduled_posts',
  description: 'List scheduled social posts with pagination.',
  permission: 'social:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    const { data, error, count } = await supabase
      .from('social_posts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('scheduled_posts', { posts: data || [] }, {
      pagination: buildPaginationMeta({
        limit,
        offset,
        returned: (data || []).length,
        total: count ?? null,
      }),
    });
  },
});

defineConnectorTool({
  module: 'social-ops',
  name: 'drafts',
  description: 'List draft social posts awaiting review or scheduling.',
  permission: 'social:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    const { data, error, count } = await supabase
      .from('social_posts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .in('status', ['draft', 'pending_review'])
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('drafts', { drafts: data || [] }, {
      pagination: buildPaginationMeta({
        limit,
        offset,
        returned: (data || []).length,
        total: count ?? null,
      }),
    });
  },
});

defineConnectorTool({
  module: 'social-ops',
  name: 'analytics',
  description: 'Social media analytics summary for published posts.',
  permission: 'social:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    days: z.number().int().min(1).max(90).optional().default(30),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      days: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - args.days * 86400000).toISOString();
    let { data, error } = await supabase
      .from('social_posts')
      .select('id, platforms, platform, status, published_at, analytics, caption, likes, comments, shares, impressions, engagement')
      .eq('tenant_id', args.tenant_id)
      .gte('published_at', since)
      .limit(500);

    if (error && (error.code === '42703' || /column|does not exist/i.test(error.message || ''))) {
      const fallback = await supabase
        .from('social_posts')
        .select('id, platforms, status, published_at, analytics, caption')
        .eq('tenant_id', args.tenant_id)
        .gte('published_at', since)
        .limit(500);
      data = fallback.data as typeof data;
      error = fallback.error;
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const posts = (data || []).map((p: any) => {
      const platforms: string[] = Array.isArray(p.platforms)
        ? p.platforms
        : p.platform
          ? [p.platform]
          : ['unknown'];
      const analytics = p.analytics || {};
      return {
        ...p,
        platform: p.platform || platforms[0] || 'unknown',
        likes: Number(p.likes ?? analytics.likes ?? 0),
        comments: Number(p.comments ?? analytics.comments ?? 0),
        shares: Number(p.shares ?? analytics.shares ?? 0),
        impressions: Number(p.impressions ?? analytics.impressions ?? 0),
      };
    });

    const totals = posts.reduce(
      (acc: any, p: any) => {
        acc.posts += 1;
        acc.likes += p.likes;
        acc.comments += p.comments;
        acc.shares += p.shares;
        acc.impressions += p.impressions;
        return acc;
      },
      { posts: 0, likes: 0, comments: 0, shares: 0, impressions: 0 }
    );

    return { window_days: args.days, totals, posts: posts.slice(0, 50) };
  },
});

defineConnectorTool({
  module: 'social-ops',
  name: 'publish_post',
  description:
    'Publish or schedule a social post via SocialPublishingService. For LinkedIn company pages pass identity_type=linkedin_organization and identity_id. Immediate publish returns provider post ID + live URL or ok=false.',
  permission: 'social:publish',
  rateLimitClass: 'publish',
  auditAction: 'mcp_publish_post',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    platform: z.string().min(1),
    content: z.string().min(1),
    scheduled_at: z.string().datetime().optional(),
    media_urls: z.array(z.string()).optional(),
    media_asset_ids: z.array(z.string().uuid()).optional(),
    identity_type: z
      .enum(['facebook_page', 'linkedin_person', 'linkedin_organization'])
      .optional(),
    identity_id: z.string().optional(),
    page_id: z.string().optional(),
    linkedin_organization_id: z.string().optional(),
    publish_now: z.boolean().optional(),
    idempotency_key: z.string().optional(),
    status: z.enum(['draft', 'scheduled', 'queued']).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      platform: { type: 'string' },
      content: { type: 'string' },
      scheduled_at: { type: 'string', format: 'date-time' },
      media_urls: { type: 'array', items: { type: 'string' } },
      media_asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
      identity_type: {
        type: 'string',
        enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
      },
      identity_id: { type: 'string' },
      page_id: { type: 'string' },
      linkedin_organization_id: { type: 'string' },
      publish_now: { type: 'boolean' },
      idempotency_key: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'scheduled', 'queued'] },
    },
    required: ['tenant_id', 'platform', 'content'],
  },
  handler: async (args, ctx) => {
    const platform = String(args.platform).toLowerCase();
    if (platform !== 'facebook' && platform !== 'linkedin') {
      throwConnectorError(
        'UNSUPPORTED_PLATFORM',
        `publish_post supports facebook|linkedin (got ${args.platform})`
      );
    }

    let identityType = args.identity_type;
    let identityId =
      args.identity_id || args.page_id || args.linkedin_organization_id || undefined;

    if (!identityType) {
      if (platform === 'facebook') {
        identityType = 'facebook_page';
        if (!identityId) {
          const { listFacebookIdentities } = await import('@/lib/social/identityResolution');
          const { pages } = await listFacebookIdentities(args.tenant_id);
          const page = pages.find((p) => p.can_publish) || pages[0];
          if (!page) throwConnectorError('MISSING_IDENTITY', 'No Facebook Page connected');
          identityId = page.page_id;
        }
      } else if (args.linkedin_organization_id) {
        identityType = 'linkedin_organization';
        identityId = args.linkedin_organization_id;
      } else {
        identityType = 'linkedin_person';
        if (!identityId) {
          const { listLinkedInIdentities } = await import('@/lib/social/identityResolution');
          const { personal } = await listLinkedInIdentities(args.tenant_id);
          if (!personal?.member_id && !personal?.person_urn) {
            throwConnectorError('MISSING_IDENTITY', 'LinkedIn personal identity not connected');
          }
          identityId = personal.member_id || personal.person_urn || 'me';
        }
      }
    }

    if (!identityId) {
      throwConnectorError('MISSING_IDENTITY', 'identity_id is required');
    }

    const publishNow =
      args.publish_now === true ||
      (!args.scheduled_at && args.status !== 'draft' && args.status !== 'scheduled');

    const { getSocialPublishingService } = await import('@/lib/social/SocialPublishingService');
    const service = getSocialPublishingService();
    const result = await service.publish({
      tenantId: args.tenant_id,
      userId: ctx.userId!,
      platform: platform as 'facebook' | 'linkedin',
      identityType: identityType!,
      identityId: identityId!,
      caption: args.content,
      mediaUrls: args.media_urls,
      mediaAssetIds: args.media_asset_ids,
      publishNow: publishNow && !args.scheduled_at,
      scheduledAt: args.scheduled_at || (args.status === 'scheduled' ? new Date().toISOString() : null),
      idempotencyKey: args.idempotency_key,
      aiClient: 'chatgpt-connector',
    });

    if (!result.ok) {
      throwConnectorError(
        result.error?.code || 'PUBLISH_FAILED',
        result.error?.message || 'Publish failed',
        result.data
      );
    }

    return okResult('publish_post', result.data, {
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
    });
  },
});

defineConnectorTool({
  module: 'social-ops',
  name: 'delete_post',
  description: 'Delete a social post by id (draft/scheduled preferred; published may require platform revoke).',
  permission: 'social:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_delete_post',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    post_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      post_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'post_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data: existing, error: findErr } = await supabase
      .from('social_posts')
      .select('id, status, platforms, platform')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.post_id)
      .maybeSingle();
    if (findErr && (findErr.code === '42703' || /column|does not exist/i.test(findErr.message || ''))) {
      const retry = await supabase
        .from('social_posts')
        .select('id, status, platforms')
        .eq('tenant_id', args.tenant_id)
        .eq('id', args.post_id)
        .maybeSingle();
      if (retry.error) throwConnectorError('QUERY_FAILED', retry.error.message);
      if (!retry.data) throwConnectorError('NOT_FOUND', 'Post not found');
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('tenant_id', args.tenant_id)
        .eq('id', args.post_id);
      if (error) throwConnectorError('DELETE_FAILED', error.message);
      return { deleted: true, post: retry.data };
    }
    if (findErr) throwConnectorError('QUERY_FAILED', findErr.message);
    if (!existing) throwConnectorError('NOT_FOUND', 'Post not found');

    const { error } = await supabase
      .from('social_posts')
      .delete()
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.post_id);
    if (error) throwConnectorError('DELETE_FAILED', error.message);
    return { deleted: true, post: existing };
  },
});

defineConnectorTool({
  module: 'social-ops',
  name: 'engagement_report',
  description: 'Generate an engagement report across social platforms for a date window.',
  permission: 'social:read',
  rateLimitClass: 'heavy',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    days: z.number().int().min(1).max(90).optional().default(30),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      days: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - args.days * 86400000).toISOString();
    let { data, error } = await supabase
      .from('social_posts')
      .select('platforms, platform, status, likes, comments, shares, impressions, published_at, analytics')
      .eq('tenant_id', args.tenant_id)
      .gte('created_at', since)
      .limit(1000);

    if (error && (error.code === '42703' || /column|does not exist/i.test(error.message || ''))) {
      const fallback = await supabase
        .from('social_posts')
        .select('platforms, status, published_at, analytics')
        .eq('tenant_id', args.tenant_id)
        .gte('created_at', since)
        .limit(1000);
      data = fallback.data as typeof data;
      error = fallback.error;
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const byPlatform: Record<string, any> = {};
    for (const post of data || []) {
      const platforms: string[] = Array.isArray((post as any).platforms) && (post as any).platforms.length
        ? (post as any).platforms
        : [(post as any).platform || 'unknown'];
      for (const platform of platforms) {
        if (!byPlatform[platform]) {
          byPlatform[platform] = { posts: 0, likes: 0, comments: 0, shares: 0, impressions: 0 };
        }
        const analytics = (post as any).analytics || {};
        byPlatform[platform].posts += 1;
        byPlatform[platform].likes += Number((post as any).likes ?? analytics.likes ?? 0);
        byPlatform[platform].comments += Number((post as any).comments ?? analytics.comments ?? 0);
        byPlatform[platform].shares += Number((post as any).shares ?? analytics.shares ?? 0);
        byPlatform[platform].impressions += Number((post as any).impressions ?? analytics.impressions ?? 0);
      }
    }

    return { window_days: args.days, by_platform: byPlatform, generated_at: new Date().toISOString() };
  },
});
