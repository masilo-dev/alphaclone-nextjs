import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// 1. get_social_accounts
registerTool('social', {
  name: 'get_social_accounts',
  description: 'Retrieve configured social media integration accounts for the tenant.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('integrations')
      .select('id, type, enabled, config, updated_at')
      .eq('tenant_id', args.tenant_id)
      .in('type', ['linkedin', 'twitter', 'facebook', 'instagram', 'youtube']);

    if (error) throw error;
    return data;
  },
});

// 1b. get_linkedin_identities (updated to return both person and org identities)
registerTool('social', {
  name: 'get_linkedin_identities',
  description: 'List posting identities for LinkedIn: personal profile and any connected company pages.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    
    // Get person identity from linkedin_integrations
    const { data: personIdentity, error: personError } = await supabase
      .from('linkedin_integrations')
      .select('linkedin_member_id, linkedin_person_urn, scopes, metadata, is_active, updated_at')
      .eq('tenant_id', args.tenant_id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (personError) throw personError;

    // Get organization identities from linkedin_identities table
    const { data: orgIdentities, error: orgError } = await supabase
      .from('linkedin_identities')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .eq('type', 'organization');

    if (orgError) throw orgError;

    const identities: any[] = [];

    if (personIdentity) {
      const scopes = Array.isArray(personIdentity.scopes)
        ? personIdentity.scopes.map((s: any) => String(s).toLowerCase())
        : [];
      identities.push({
        type: 'person',
        linkedin_member_id: personIdentity.linkedin_member_id || null,
        author_urn: personIdentity.linkedin_person_urn,
        can_post: scopes.includes('w_member_social'),
      });
    }

    if (orgIdentities && orgIdentities.length > 0) {
      for (const org of orgIdentities) {
        identities.push({
          type: 'organization',
          linkedin_organization_id: org.linkedin_organization_id,
          author_urn: org.author_urn,
          can_post: org.can_post !== false,
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
  description: 'Schedule a social media post for future publication.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    platform: z.enum(['linkedin', 'x', 'facebook']),
    content: z.string(),
    scheduled_at: z.string(),
    asset_id: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      platform: { type: 'string', enum: ['linkedin', 'x', 'facebook'] },
      content: { type: 'string', description: 'Post content' },
      scheduled_at: { type: 'string', format: 'date-time' },
      asset_id: { type: 'string', description: 'Optional media asset ID' },
    },
    required: ['tenant_id', 'platform', 'content', 'scheduled_at'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({
        tenant_id: args.tenant_id,
        user_id: ctx.userId || null,
        platform: args.platform,
        content: args.content,
        asset_id: args.asset_id || null,
        scheduled_at: args.scheduled_at,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 3. get_scheduled_posts
registerTool('social', {
  name: 'get_scheduled_posts',
  description: 'Retrieve pending or sent scheduled social posts.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    status: z.enum(['pending', 'sent', 'failed']).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['pending', 'sent', 'failed'] },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('scheduled_posts')
      .select('*')
      .eq('tenant_id', args.tenant_id);

    if (args.status) {
      query = query.eq('status', args.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});

// 4. get_post_analytics
registerTool('social', {
  name: 'get_post_analytics',
  description: 'Retrieve engagement metrics and analytics for a social post.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
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
    const { data, error } = await supabase
      .from('social_post_analytics')
      .select('*')
      .eq('post_id', args.post_id)
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
});
