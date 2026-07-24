// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  getFacebookIntegrationWithToken,
  upsertFacebookIntegration,
} from '@/services/facebook/facebookIntegrationService';

const SAFE_INTEGRATION_COLUMNS =
  'id, page_id, page_name, expires_at, is_active, connected_at, updated_at, metadata';

async function resolveFacebookPageForTenant(tenantId: string, pageId?: string) {
  const { resolveTenantIdentityForPublish } = await import('@/lib/social/socialIdentityStore');
  const identity = await resolveTenantIdentityForPublish({
    tenantId,
    identityId: pageId,
    identityType: 'facebook_page',
    provider: 'facebook',
    allowDefault: !pageId,
  });
  const admin = createSupabaseAdminClient();
  const integration = await getFacebookIntegrationWithToken(admin, {
    tenantId,
    pageId: identity.provider_identity_id,
    requireActive: true,
  });
  if (!integration?.pageAccessToken) {
    throw new Error('No connected Facebook Page found for this tenant. Connect a page first.');
  }
  return {
    page_id: integration.page_id,
    page_name: integration.page_name,
    page_access_token: integration.pageAccessToken,
  };
}

// ── get_facebook_token ────────────────────────────────────────────────────────
registerTool('facebook', {
  name: 'get_facebook_token',
  description: 'Retrieve connected Facebook Page metadata for the tenant (tokens are never returned).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    page_id: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      page_id: { type: 'string', description: 'Optional specific Facebook Page ID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('facebook_integrations')
      .select(SAFE_INTEGRATION_COLUMNS)
      .eq('tenant_id', args.tenant_id)
      .eq('is_active', true);
    if (args.page_id) query = query.eq('page_id', args.page_id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});

// ── store_facebook_token ──────────────────────────────────────────────────────
registerTool('facebook', {
  name: 'store_facebook_token',
  description: 'Store or update a Facebook Page Access Token for publishing (encrypted at rest).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().uuid(),
    page_id: z.string(),
    page_name: z.string().optional(),
    page_access_token: z.string(),
    token_expires_at: z.string().optional(),
    scopes: z.array(z.string()).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      user_id: { type: 'string', format: 'uuid' },
      page_id: { type: 'string' },
      page_name: { type: 'string' },
      page_access_token: { type: 'string' },
      token_expires_at: { type: 'string', format: 'date-time' },
      scopes: { type: 'array', items: { type: 'string' } },
    },
    required: ['tenant_id', 'user_id', 'page_id', 'page_access_token'],
  },
  handler: async (args) => {
    const result = await upsertFacebookIntegration({
      userId: args.user_id,
      tenantId: args.tenant_id,
      pageId: args.page_id,
      pageName: args.page_name || null,
      pageAccessToken: args.page_access_token,
      userAccessToken: args.page_access_token,
      appScopedUserId: args.user_id,
      expiresAt: args.token_expires_at || null,
      metadata: {
        scopes: args.scopes || [],
        source: 'mcp_store_facebook_token',
      },
    });
    if (!result.integrationId) {
      throw new Error(result.error || 'Failed to store Facebook integration');
    }
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('facebook_integrations')
      .select(SAFE_INTEGRATION_COLUMNS)
      .eq('id', result.integrationId)
      .single();
    if (error) throw error;
    return data;
  },
});

// ── publish_facebook_reel ─────────────────────────────────────────────────────
registerTool('facebook', {
  name: 'publish_facebook_reel',
  description:
    'Publishes a Facebook Reel (short-form video) to a connected Facebook Page using the Facebook Graph API. Supports public video URLs or base64-encoded video content.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    page_id: z.string().optional(),
    video_url: z.string().url().optional(),
    video_base64: z.string().optional(),
    video_filename: z.string().optional().default('reel.mp4'),
    description: z.string().optional(),
    title: z.string().optional(),
    publish_now: z.boolean().optional().default(false),
    scheduled_publish_time: z.number().int().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      page_id: { type: 'string', description: 'Facebook Page ID (required when tenant has multiple pages; otherwise tenant default or sole page)' },
      video_url: { type: 'string', description: 'Public URL of the video to publish as a Reel' },
      video_base64: { type: 'string', description: 'Base64-encoded video content (alternative to video_url)' },
      video_filename: { type: 'string', description: 'Filename for base64 video (default: reel.mp4)', default: 'reel.mp4' },
      description: { type: 'string', description: 'Reel caption/description' },
      title: { type: 'string', description: 'Optional Reel title' },
      publish_now: { type: 'boolean', description: 'Publish immediately (default: false)', default: false },
      scheduled_publish_time: { type: 'number', description: 'Unix timestamp for scheduled publishing (only when publish_now is false)' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const { page_id, page_name, page_access_token } = await resolveFacebookPageForTenant(
      args.tenant_id,
      args.page_id
    );

    if (!args.video_url && !args.video_base64) {
      throw new Error('Either video_url or video_base64 is required to publish a Reel.');
    }

    let uploadVideoId: string | null = null;

    // Step 1: Upload video via Resumable Upload or URL
    if (args.video_url) {
      // Initialize resumable upload session
      const initRes = await fetch(
        `https://graph.facebook.com/v21.0/${page_id}/video_reels`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'start',
            access_token: page_access_token,
          }),
        }
      );
      const initData = await initRes.json();
      if (!initRes.ok || !initData.video_id) {
        throw new Error(`Failed to initialize Reel upload: ${JSON.stringify(initData)}`);
      }
      uploadVideoId = initData.video_id;

      // Upload from URL using Facebook's pull-from-URL feature
      const uploadRes = await fetch(
        `https://graph.facebook.com/v21.0/${page_id}/video_reels`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: uploadVideoId,
            upload_phase: 'pull',
            file_url: args.video_url,
            access_token: page_access_token,
          }),
        }
      );
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(`Failed to upload Reel from URL: ${JSON.stringify(uploadData)}`);
      }
    } else if (args.video_base64) {
      // Initialize upload session for binary upload
      const initRes = await fetch(
        `https://graph.facebook.com/v21.0/${page_id}/video_reels`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'start',
            access_token: page_access_token,
          }),
        }
      );
      const initData = await initRes.json();
      if (!initRes.ok || !initData.video_id) {
        throw new Error(`Failed to initialize Reel upload: ${JSON.stringify(initData)}`);
      }
      uploadVideoId = initData.video_id;
      const uploadUri = initData.upload_url || `https://rupload.facebook.com/video-upload/v21.0/${uploadVideoId}`;

      const videoBuffer = Buffer.from(args.video_base64, 'base64');
      const uploadRes = await fetch(uploadUri, {
        method: 'POST',
        headers: {
          Authorization: `OAuth ${page_access_token}`,
          'Content-Type': 'video/mp4',
          'Content-Length': String(videoBuffer.byteLength),
          offset: '0',
          file_size: String(videoBuffer.byteLength),
        },
        body: videoBuffer,
      });
      if (!uploadRes.ok) {
        throw new Error(`Failed to upload Reel binary: ${await uploadRes.text()}`);
      }
    }

    // Step 2: Publish the Reel
    const publishBody: any = {
      video_id: uploadVideoId,
      upload_phase: 'finish',
      video_state: args.publish_now !== false ? 'PUBLISHED' : 'SCHEDULED',
      description: args.description || '',
      title: args.title || '',
      access_token: page_access_token,
    };
    if (!args.publish_now && args.scheduled_publish_time) {
      publishBody.scheduled_publish_time = args.scheduled_publish_time;
    }

    const pubRes = await fetch(
      `https://graph.facebook.com/v21.0/${page_id}/video_reels`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publishBody),
      }
    );
    const pubData = await pubRes.json();
    if (!pubRes.ok) throw new Error(`Failed to publish Reel: ${JSON.stringify(pubData)}`);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          video_id: uploadVideoId,
          page_id,
          page_name,
          status: args.publish_now !== false ? 'published' : 'scheduled',
          description: args.description,
        }, null, 2),
      }],
    };
  },
});

// ── publish_facebook_multi_photo ──────────────────────────────────────────────
registerTool('facebook', {
  name: 'publish_facebook_multi_photo',
  description:
    'Publishes a Facebook post with multiple photos (up to 10) attached in a single post. Accepts public image URLs or base64-encoded images. This creates a proper Facebook carousel/album post.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    page_id: z.string().optional(),
    caption: z.string(),
    photos: z.array(
      z.object({
        url: z.string().url().optional(),
        base64: z.string().optional(),
        filename: z.string().optional().default('photo.jpg'),
      })
    ).min(1).max(10),
    link_url: z.string().url().optional(),
    publish_now: z.boolean().optional().default(false),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      page_id: { type: 'string', description: 'Facebook Page ID (required when tenant has multiple pages; otherwise tenant default or sole page)' },
      caption: { type: 'string', description: 'Post caption/text' },
      photos: {
        type: 'array',
        description: 'List of photos to attach (1–10). Each photo needs either a url or base64.',
        minItems: 1,
        maxItems: 10,
        items: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Public URL of the image' },
            base64: { type: 'string', description: 'Base64-encoded image content' },
            filename: { type: 'string', description: 'Filename for base64 uploads (default: photo.jpg)', default: 'photo.jpg' },
          },
        },
      },
      link_url: { type: 'string', description: 'Optional link to attach to the post' },
      publish_now: { type: 'boolean', description: 'Publish immediately (default: false)', default: false },
    },
    required: ['tenant_id', 'caption', 'photos'],
  },
  handler: async (args) => {
    const { page_id, page_name, page_access_token } = await resolveFacebookPageForTenant(
      args.tenant_id,
      args.page_id
    );

    // Step 1: Upload each photo as an unpublished photo to get media fbids
    const attachedMediaIds: Array<{ media_fbid: string }> = [];

    for (const photo of args.photos) {
      let photoRes: Response;

      if (photo.url) {
        // Upload from URL
        photoRes = await fetch(
          `https://graph.facebook.com/v21.0/${page_id}/photos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: photo.url,
              published: false,
              access_token: page_access_token,
            }),
          }
        );
      } else if (photo.base64) {
        // Upload from base64 as multipart form
        const blob = Buffer.from(photo.base64, 'base64');
        const formData = new FormData();
        formData.append('source', new Blob([new Uint8Array(blob)], { type: 'image/jpeg' }), photo.filename || 'photo.jpg');
        formData.append('published', 'false');
        formData.append('access_token', page_access_token);

        photoRes = await fetch(
          `https://graph.facebook.com/v21.0/${page_id}/photos`,
          { method: 'POST', body: formData }
        );
      } else {
        throw new Error('Each photo must have either a url or base64 field.');
      }

      const photoData = await photoRes.json();
      if (!photoRes.ok || !photoData.id) {
        throw new Error(`Failed to upload photo: ${JSON.stringify(photoData)}`);
      }
      attachedMediaIds.push({ media_fbid: photoData.id });
    }

    // Step 2: Publish the multi-photo post
    const postBody: any = {
      message: args.caption,
      attached_media: attachedMediaIds,
      access_token: page_access_token,
    };
    if (args.link_url) postBody.link = args.link_url;

    const postRes = await fetch(
      `https://graph.facebook.com/v21.0/${page_id}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody),
      }
    );
    const postData = await postRes.json();
    if (!postRes.ok) throw new Error(`Failed to publish multi-photo post: ${JSON.stringify(postData)}`);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          post_id: postData.id,
          page_id,
          page_name,
          photos_uploaded: attachedMediaIds.length,
          caption: args.caption,
        }, null, 2),
      }],
    };
  },
});
