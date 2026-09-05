import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';

defineConnectorTool({
  module: 'social-ops',
  name: 'connected_accounts',
  description:
    'List connected social media accounts for the tenant (Facebook Pages + LinkedIn personal/org). Each account includes identity_id (internal UUID for publish_post), identity_type, identity_name, and provider_identity_id. When multiple identities exist on a platform, pass identity_id to publish_post.',
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

async function listScheduledSocialPosts(args: {
  tenant_id: string;
  limit?: number;
  offset?: number;
}) {
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
  return okResult('list_scheduled_social_posts', { posts: data || [], source_table: 'social_posts' }, {
    pagination: buildPaginationMeta({
      limit,
      offset,
      returned: (data || []).length,
      total: count ?? null,
    }),
  });
}

defineConnectorTool({
  module: 'social-ops',
  name: 'list_scheduled_social_posts',
  description: 'List scheduled social posts from the canonical social_posts table.',
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
  handler: async (args) => listScheduledSocialPosts(args),
});

defineConnectorTool({
  module: 'social-ops',
  name: 'scheduled_posts',
  description:
    'DEPRECATED — use list_scheduled_social_posts. Reads social_posts (legacy scheduled_posts table is retired).',
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
    const result = await listScheduledSocialPosts(args);
    return {
      ...result,
      deprecated: true,
      use_instead: 'list_scheduled_social_posts',
      legacy_table: 'scheduled_posts_retired',
    };
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
