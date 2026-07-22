import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';

defineConnectorTool({
  module: 'social-ops',
  name: 'connected_accounts',
  description: 'List connected social media accounts for the tenant.',
  permission: 'social:read',
  inputSchema: z.object({ tenant_id: tenantIdField }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('integrations')
      .select('id, type, enabled, config, updated_at')
      .eq('tenant_id', args.tenant_id)
      .in('type', ['linkedin', 'twitter', 'x', 'facebook', 'instagram', 'youtube', 'tiktok']);
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const { data: linkedin } = await supabase
      .from('linkedin_integrations')
      .select('linkedin_member_id, linkedin_person_urn, is_active, updated_at, scopes')
      .eq('tenant_id', args.tenant_id)
      .eq('is_active', true)
      .limit(5);

    return { accounts: data || [], linkedin: linkedin || [] };
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
    const { data, error } = await supabase
      .from('social_posts')
      .select('id, platform, status, published_at, analytics, engagement, likes, comments, shares, impressions')
      .eq('tenant_id', args.tenant_id)
      .gte('published_at', since)
      .limit(500);
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const posts = data || [];
    const totals = posts.reduce(
      (acc: any, p: any) => {
        acc.posts += 1;
        acc.likes += Number(p.likes || p.analytics?.likes || 0);
        acc.comments += Number(p.comments || p.analytics?.comments || 0);
        acc.shares += Number(p.shares || p.analytics?.shares || 0);
        acc.impressions += Number(p.impressions || p.analytics?.impressions || 0);
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
  description: 'Create and optionally schedule/publish a social post.',
  permission: 'social:publish',
  rateLimitClass: 'publish',
  auditAction: 'mcp_publish_post',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    platform: z.string().min(1),
    content: z.string().min(1),
    scheduled_at: z.string().datetime().optional(),
    media_urls: z.array(z.string()).optional(),
    status: z.enum(['draft', 'scheduled', 'queued']).optional().default('scheduled'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      platform: { type: 'string' },
      content: { type: 'string' },
      scheduled_at: { type: 'string', format: 'date-time' },
      media_urls: { type: 'array', items: { type: 'string' } },
      status: { type: 'string', enum: ['draft', 'scheduled', 'queued'] },
    },
    required: ['tenant_id', 'platform', 'content'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const status = args.status || (args.scheduled_at ? 'scheduled' : 'queued');
    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        tenant_id: args.tenant_id,
        created_by: ctx.userId,
        platform: args.platform,
        content: args.content,
        status,
        scheduled_at: args.scheduled_at || new Date().toISOString(),
        media_urls: args.media_urls || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throwConnectorError('CREATE_FAILED', error.message);
    return data;
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
      .select('id, status, platform')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.post_id)
      .maybeSingle();
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
    const { data, error } = await supabase
      .from('social_posts')
      .select('platform, status, likes, comments, shares, impressions, published_at, analytics')
      .eq('tenant_id', args.tenant_id)
      .gte('created_at', since)
      .limit(1000);
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const byPlatform: Record<string, any> = {};
    for (const post of data || []) {
      const platform = String((post as any).platform || 'unknown');
      if (!byPlatform[platform]) {
        byPlatform[platform] = { posts: 0, likes: 0, comments: 0, shares: 0, impressions: 0 };
      }
      byPlatform[platform].posts += 1;
      byPlatform[platform].likes += Number((post as any).likes || (post as any).analytics?.likes || 0);
      byPlatform[platform].comments += Number((post as any).comments || (post as any).analytics?.comments || 0);
      byPlatform[platform].shares += Number((post as any).shares || (post as any).analytics?.shares || 0);
      byPlatform[platform].impressions += Number(
        (post as any).impressions || (post as any).analytics?.impressions || 0
      );
    }

    return { window_days: args.days, by_platform: byPlatform, generated_at: new Date().toISOString() };
  },
});
