import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { extractCompanyPagesFromMetadata } from '@/services/linkedin/linkedinIntegrationService';

function requireTenantId(args: { tenant_id?: string }, ctx: { tenantId?: string }) {
  const tenantId = args.tenant_id || ctx.tenantId;
  if (!tenantId) throw new Error('tenant_id is required');
  return tenantId;
}

// 1. get_social_accounts
registerTool('social', {
  name: 'get_social_accounts',
  description: 'Retrieve configured social media integration accounts for the tenant. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = requireTenantId(args, ctx);
    const { data, error } = await supabase
      .from('integrations')
      .select('id, type, enabled, config, updated_at')
      .eq('tenant_id', tenantId)
      .in('type', ['linkedin', 'twitter', 'facebook', 'instagram', 'youtube']);

    if (error) throw error;
    return data;
  },
});

// 1b. get_linkedin_identities (updated to return both person and org identities)
registerTool('social', {
  name: 'get_linkedin_identities',
  description: 'List posting identities for LinkedIn: personal profile and any connected company pages. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
  }),
  jsonSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = requireTenantId(args, ctx);
    
    // Get person identity from linkedin_integrations
    const { data: personIdentity, error: personError } = await supabase
      .from('linkedin_integrations')
      .select('linkedin_member_id, linkedin_person_urn, scopes, metadata, is_active, updated_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (personError) throw personError;

    // Get organization identities from linkedin_identities table
    const { data: orgIdentities, error: orgError } = await supabase
      .from('linkedin_identities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('type', 'organization');

    if (orgError && orgError.code !== '42P01') throw orgError;

    const identities: any[] = [];
    let canPostOrg = false;

    if (personIdentity) {
      const scopes = Array.isArray(personIdentity.scopes)
        ? personIdentity.scopes.map((s: any) => String(s).toLowerCase())
        : [];
      canPostOrg = scopes.includes('w_organization_social');
      identities.push({
        type: 'person',
        linkedin_member_id: personIdentity.linkedin_member_id || null,
        author_urn: personIdentity.linkedin_person_urn,
        can_post: scopes.includes('w_member_social'),
      });
    }

    const orgRows =
      orgIdentities && orgIdentities.length > 0
        ? orgIdentities
        : extractCompanyPagesFromMetadata(personIdentity?.metadata).map((page) => ({
            linkedin_organization_id: page.id,
            author_urn: `urn:li:organization:${page.id}`,
            can_post: canPostOrg,
            name: page.name,
          }));

    if (orgRows.length > 0) {
      for (const org of orgRows) {
        identities.push({
          type: 'organization',
          linkedin_organization_id: org.linkedin_organization_id,
          author_urn: org.author_urn,
          can_post: org.can_post === true,
          name: org.name || null,
        });
      }
    }

    return {
      connected: identities.length > 0,
      identities,
    };
  },
});

// 2. schedule_social_post
registerTool('social', {
  name: 'schedule_social_post',
  description:
    'Schedule a social media post for future publication. Pass identity_id from get_social_identities when the workspace has multiple accounts; otherwise the single publishable identity for the platform is selected. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
    platform: z.enum(['linkedin', 'x', 'facebook']),
    content: z.string(),
    scheduled_at: z.string(),
    asset_id: z.string().optional(),
    identity_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['linkedin', 'x', 'facebook'] },
      content: { type: 'string', description: 'Post content' },
      scheduled_at: { type: 'string', format: 'date-time' },
      asset_id: { type: 'string', description: 'Optional media asset ID' },
      identity_id: {
        type: 'string',
        format: 'uuid',
        description: 'Optional identity from get_social_identities (required when multiple accounts exist for the platform)',
      },
    },
    required: ['platform', 'content', 'scheduled_at'],
  },
  handler: async (args, ctx) => {
    const tenantId = requireTenantId(args, ctx);
    if (!ctx.userId) throw new Error('user_id is required');

    const provider = args.platform === 'x' ? 'x' : args.platform;
    let identityId = args.identity_id ? String(args.identity_id) : '';

    if (!identityId) {
      const {
        listTenantSocialIdentities,
        syncTenantSocialIdentitiesFromLegacy,
        getTenantDefaultIdentity,
      } = await import('@/lib/social/socialIdentityStore');
      await syncTenantSocialIdentitiesFromLegacy(tenantId).catch(() => undefined);
      const identities = await listTenantSocialIdentities({
        tenantId,
        provider,
        activeOnly: true,
      });
      const publishable = identities.filter((i) => i.can_publish);
      if (publishable.length === 1) {
        identityId = publishable[0].identity_id;
      } else if (publishable.length > 1) {
        const def =
          publishable.find((i) => i.is_default) ||
          (await getTenantDefaultIdentity(tenantId, provider));
        if (def?.identity_id) {
          identityId = def.identity_id;
        } else {
          throw new Error(
            `identity_id is required — workspace has ${publishable.length} ${provider} identities. Call get_social_identities and pass identity_id.`
          );
        }
      }
      // zero publishable: let create_social_post surface the connection error
    }

    const { createMCPServer } = await import('@/services/mcp/MCPServer');
    const server = createMCPServer({ tenantId, userId: ctx.userId });

    return server.runTool('create_social_post', {
      tenant_id: tenantId,
      user_id: ctx.userId,
      caption: args.content,
      media_asset_ids: args.asset_id ? [args.asset_id] : [],
      platforms: [args.platform],
      publish_now: false,
      scheduled_at: args.scheduled_at,
      ...(identityId ? { identity_id: identityId } : {}),
    });
  },
});

// 3. get_scheduled_posts
registerTool('social', {
  name: 'get_scheduled_posts',
  description: 'Retrieve pending or sent scheduled social posts. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
    status: z.enum(['pending', 'sent', 'failed']).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'sent', 'failed'] },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = requireTenantId(args, ctx);
    let query = supabase
      .from('social_posts')
      .select('id, caption, platforms, status, scheduled_at, published_at, media_urls, created_at')
      .eq('tenant_id', tenantId);

    if (args.status) {
      const normalizedStatus =
        args.status === 'pending' ? 'scheduled' : args.status === 'sent' ? 'published' : 'failed';
      query = query.eq('status', normalizedStatus);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});

// 4. get_post_analytics
registerTool('social', {
  name: 'get_post_analytics',
  description: 'Retrieve engagement metrics and analytics for a social post. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
    post_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      post_id: { type: 'string', format: 'uuid' },
    },
    required: ['post_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const tenantId = requireTenantId(args, ctx);
    const { data, error } = await supabase
      .from('social_post_analytics')
      .select('*')
      .eq('post_id', args.post_id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
});

// 5. upload_media_asset — images/videos for social posts (Claude, Manus, Bonnie)
registerTool('social', {
  name: 'upload_media_asset',
  description:
    'Upload an image or video to workspace media storage. Returns media_asset id and public_url for use with create_social_post (media_asset_ids) or schedule_social_post (asset_id). Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
    file_name: z.string(),
    mime_type: z.string(),
    file_base64: z.string(),
    alt_text: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      file_name: { type: 'string', description: 'Original file name with extension' },
      mime_type: { type: 'string', description: 'MIME type such as image/png or video/mp4' },
      file_base64: { type: 'string', description: 'Base64 file data (raw or data:*;base64,...)' },
      alt_text: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['file_name', 'mime_type', 'file_base64'],
  },
  handler: async (args, ctx) => {
    if (!ctx.userId) throw new Error('user_id is required');
    const tenantId = requireTenantId(args, ctx);
    const { uploadMediaAsset } = await import('@/lib/social/uploadMediaAsset');
    return uploadMediaAsset({
      tenantId,
      userId: ctx.userId,
      fileName: args.file_name,
      mimeType: args.mime_type,
      fileBase64: args.file_base64,
      altText: args.alt_text,
      tags: args.tags,
    });
  },
});

// 6. create_social_post_with_media — one-step upload + publish for agents
registerTool('social', {
  name: 'create_social_post_with_media',
  description:
    'Upload image/video and create or publish a social post in one call. Use for Claude/Manus when attaching media. Supports Facebook immediate publish or schedule/store for other platforms. Tenant is resolved from session.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), // injected from session
    caption: z.string(),
    file_name: z.string(),
    mime_type: z.string(),
    file_base64: z.string(),
    platforms: z.array(z.string()).optional(),
    publish_now: z.boolean().optional(),
    scheduled_at: z.string().optional(),
    page_id: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      caption: { type: 'string' },
      file_name: { type: 'string' },
      mime_type: { type: 'string' },
      file_base64: { type: 'string' },
      platforms: { type: 'array', items: { type: 'string' }, description: 'facebook, linkedin, instagram, x, tiktok' },
      publish_now: { type: 'boolean' },
      scheduled_at: { type: 'string', format: 'date-time' },
      page_id: { type: 'string' },
    },
    required: ['caption', 'file_name', 'mime_type', 'file_base64'],
  },
  handler: async (args, ctx) => {
    const userId = ctx.userId;
    if (!userId) throw new Error('user_id is required');
    const tenantId = requireTenantId(args, ctx);

    const { uploadMediaAsset } = await import('@/lib/social/uploadMediaAsset');
    const asset = await uploadMediaAsset({
      tenantId,
      userId,
      fileName: args.file_name,
      mimeType: args.mime_type,
      fileBase64: args.file_base64,
      tags: ['agent-composite-post'],
    });

    const { createMCPServer } = await import('@/services/mcp/MCPServer');
    const server = createMCPServer({ tenantId, userId });
    return server.runTool('create_social_post', {
      tenant_id: tenantId,
      user_id: userId,
      caption: args.caption,
      media_asset_ids: [asset.id],
      platforms: args.platforms || ['facebook'],
      publish_now: args.publish_now ?? false,
      scheduled_at: args.scheduled_at,
      page_id: args.page_id,
    });
  },
});
