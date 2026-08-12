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

registerTool('social-publishing', {
  name: 'check_mcp_execution_readiness',
  description:
    'Check whether the current MCP workspace can execute ChatGPT write actions, especially social publishing and email sending. Use this when tools are visible but posting or sending fails.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    action: z.enum(['all', 'social_post', 'email_send', 'media_upload']).optional().default('all'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['all', 'social_post', 'email_send', 'media_upload'],
      },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const tenantId = requireTenantId(args, ctx);
    const userId = ctx.userId;
    if (!userId) throw new Error('Authenticated user required');

    const { assertTenantMembership } = await import('@/lib/tenant/platformTenant');
    const { resolveTenantRole } = await import('@/lib/mcp/connector/permissions');
    const { hasTool } = await import('../tool-registry');
    await assertTenantMembership(tenantId, userId);

    const supabase = createSupabaseAdminClient();
    const role = await resolveTenantRole(tenantId, userId);
    const canSocial = role.permissions.includes('social:publish');
    const canWriteSocial = role.permissions.includes('social:write');
    const canEmail = role.permissions.includes('sales:write') || role.permissions.includes('marketing:write');

    const [identitiesRes, emailIntegrationsRes, senderRes] = await Promise.all([
      supabase
        .from('social_identities')
        .select('identity_id, provider, identity_type, display_name, can_publish, can_upload_media, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
      supabase
        .from('integrations')
        .select('id, provider, type, status, is_active, config')
        .eq('tenant_id', tenantId)
        .in('provider', ['zoho', 'gmail', 'brevo', 'sendgrid', 'resend', 'outlook', 'smtp']),
      supabase
        .from('email_sender_addresses')
        .select('id, provider, email_address, display_name, is_default, is_verified')
        .eq('tenant_id', tenantId),
    ]);

    const identities = identitiesRes.data || [];
    const publishableIdentities = identities.filter((i) => i.can_publish);
    const uploadableIdentities = identities.filter((i) => i.can_upload_media);
    const emailIntegrations = (emailIntegrationsRes.data || []).filter(
      (i) => i.is_active !== false && String(i.status || 'connected') !== 'disconnected'
    );
    const senders = senderRes.data || [];
    const verifiedSenders = senders.filter((s) => s.is_verified !== false);

    const tools = {
      upload_social_media: hasTool('upload_social_media'),
      publish_social_post: hasTool('publish_social_post'),
      get_social_identities: hasTool('get_social_identities'),
      send_email: hasTool('send_email'),
    };

    const socialMissing: string[] = [];
    if (!tools.publish_social_post || !tools.get_social_identities) socialMissing.push('MCP social tools are not registered');
    if (!canSocial) socialMissing.push('Workspace role lacks social:publish permission');
    if (publishableIdentities.length === 0) socialMissing.push('No active publishable Facebook/LinkedIn identity is connected');

    const mediaMissing: string[] = [];
    if (!tools.upload_social_media) mediaMissing.push('upload_social_media is not registered');
    if (!canWriteSocial) mediaMissing.push('Workspace role lacks social:write permission');
    if (identities.length > 0 && uploadableIdentities.length === 0) {
      mediaMissing.push('Connected social identities do not advertise media upload capability');
    }

    const emailMissing: string[] = [];
    if (!tools.send_email) emailMissing.push('send_email is not registered');
    if (!canEmail) emailMissing.push('Workspace role lacks sales:write or marketing:write permission');
    if (emailIntegrations.length === 0) emailMissing.push('No active email provider integration is connected');
    if (verifiedSenders.length === 0) emailMissing.push('No verified/default sender address is configured');

    const readiness = {
      requested_action: args.action || 'all',
      workspace: {
        tenant_id: tenantId,
        user_id: userId,
        role: role.role,
      },
      tools,
      social_post: {
        executable: socialMissing.length === 0,
        missing: socialMissing,
        identities: publishableIdentities.map((i) => ({
          identity_id: i.identity_id,
          provider: i.provider,
          identity_type: i.identity_type,
          display_name: i.display_name,
          can_publish: i.can_publish,
          can_upload_media: i.can_upload_media,
        })),
      },
      media_upload: {
        executable: mediaMissing.length === 0,
        missing: mediaMissing,
        accepted_sources: ['file', 'base64', 'source_url'],
        accepted_media_types: ['image', 'video', 'document'],
      },
      email_send: {
        executable: emailMissing.length === 0,
        missing: emailMissing,
        providers: emailIntegrations.map((i) => ({
          integration_id: i.id,
          provider: i.provider || i.type,
          status: i.status,
        })),
        sender_addresses: verifiedSenders.map((s) => ({
          sender_id: s.id,
          provider: s.provider,
          email_address: s.email_address,
          display_name: s.display_name,
          is_default: s.is_default,
        })),
      },
    };

    return toMcpContent(
      okResult('check_mcp_execution_readiness', readiness, {
        meta: {
          note:
            'If executable=false, ChatGPT can see the tool but the workspace/provider setup is not ready for that action.',
        },
      })
    );
  },
});

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

type MediaToolAsset = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  status: string;
  width?: number | null;
  height?: number | null;
  thumbnail_url?: string | null;
  checksum?: string | null;
  provider?: string | null;
};

/** ChatGPT / Claude / connector-friendly media envelope. */
function mediaToolResult(asset: MediaToolAsset) {
  const mediaType = asset.mime_type.startsWith('video/')
    ? 'video'
    : asset.mime_type === 'application/pdf'
      ? 'document'
      : 'image';
  return {
    success: true,
    ok: true,
    media_id: asset.id,
    media_asset_id: asset.id,
    media_url: asset.url,
    storage_url: asset.url,
    public_url: asset.url,
    asset_id: asset.id,
    filename: asset.filename,
    mime_type: asset.mime_type,
    media_type: mediaType,
    size_bytes: asset.size_bytes,
    thumbnail_url: asset.thumbnail_url || null,
    provider: asset.provider || 'supabase',
    asset,
  };
}

function rejectLocalAiPaths(value: string | undefined, field: string) {
  const v = String(value || '').trim();
  if (!v) return;
  // ChatGPT sandbox / desktop local paths are not fetchable by Alphaclone or Facebook.
  if (
    /^\/mnt\/data\//i.test(v) ||
    /^\/tmp\//i.test(v) ||
    /^file:/i.test(v) ||
    /^[A-Za-z]:\\/.test(v)
  ) {
    throw new Error(
      `${field} looks like a local AI sandbox path (${v}). ` +
        'Read the image bytes in the session, pass them as content_base64 (or data_url), ' +
        'then use the returned media_url with publish_post / publish_social_post.'
    );
  }
}

registerTool('social-publishing', {
  name: 'create_social_post_with_ai_image',
  description: 'Generate an image with OpenAI, upload it permanently, create or publish an image post, then return the provider receipt and live URL. Publishing is approval-controlled by Bonnie policy.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(), prompt: z.string().min(3).max(20_000), caption: z.string().min(1).max(20_000),
    size: z.enum(['1024x1024','1536x1024','1024x1536']).optional().default('1024x1024'),
    platform: z.enum(['facebook','linkedin']), identity_type: z.enum(['facebook_page','linkedin_person','linkedin_organization']).optional(),
    identity_id: z.string().optional(), publish_now: z.boolean().optional().default(false), scheduled_at: z.string().datetime().optional(), alt_text: z.string().max(2000).optional(),
  }),
  jsonSchema: { type: 'object', properties: { prompt: { type: 'string' }, caption: { type: 'string' }, size: { type: 'string', enum: ['1024x1024','1536x1024','1024x1536'] }, platform: { type: 'string', enum: ['facebook','linkedin'] }, identity_type: { type: 'string', enum: ['facebook_page','linkedin_person','linkedin_organization'] }, identity_id: { type: 'string' }, publish_now: { type: 'boolean' }, scheduled_at: { type: 'string', format: 'date-time' }, alt_text: { type: 'string' } }, required: ['prompt','caption','platform'] },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, args.publish_now ? 'social:publish' : 'social:write');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
    const response = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt: args.prompt, n: 1, size: args.size, quality: 'high', output_format: 'png' }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `OpenAI image generation failed (${response.status})`);
    const base64 = payload?.data?.[0]?.b64_json;
    if (!base64) throw new Error('OpenAI did not return image bytes');
    const asset = await uploadSocialMedia({ tenantId, userId, filename: `bonnie-${crypto.randomUUID()}.png`, mimeType: 'image/png', contentBase64: base64, altText: args.alt_text });
    const { executeTool } = await import('../tool-registry');
    const post = await executeTool(tenantId, userId, 'create_social_post', { tenant_id: tenantId, platform: args.platform, platforms: [args.platform], identity_type: args.identity_type, identity_id: args.identity_id, caption: args.caption, media_asset_ids: [asset.media_asset_id], publish_now: args.publish_now, scheduled_at: args.scheduled_at });
    return { generated: true, model, revised_prompt: payload?.data?.[0]?.revised_prompt || null, media_id: asset.media_asset_id, media_url: asset.public_url, post, verification: { image_stored: Boolean(asset.public_url), post_action_returned: Boolean(post) } };
  },
});

registerTool('social-publishing', {
  name: 'upload_social_media',
  description:
    'Canonical MCP media ingestion for social publishing. Accept exactly one source: file/base64 bytes, base64, or source_url. Stores media in AlphaClone first and returns media_id + storage_url for publish_social_post. Handles ChatGPT-generated images and user-uploaded files; never pass /mnt/data paths as URLs.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    file: z.string().optional(),
    base64: z.string().optional(),
    source_url: z.string().optional(),
    filename: z.string().optional(),
    mime_type: z.string().optional(),
    media_type: z.enum(['image', 'video', 'document']).optional(),
    purpose: z.string().optional().default('social'),
    alt_text: z.string().optional(),
  }).refine((v) => [v.file, v.base64, v.source_url].filter((x) => Boolean(String(x || '').trim())).length === 1, {
    message: 'Provide exactly one media source: file, base64, or source_url',
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description:
          'MCP file/binary content when the client can transfer it. If represented as bytes, pass base64 or a data URI string here.',
      },
      base64: {
        type: 'string',
        description: 'Raw base64 bytes or data:image/png;base64,... fallback.',
      },
      source_url: {
        type: 'string',
        description: 'Public HTTPS media URL to ingest into AlphaClone storage.',
      },
      filename: { type: 'string', description: 'Required for raw base64/file bytes' },
      mime_type: {
        type: 'string',
        description: 'Declared MIME. Server validates actual file signature.',
      },
      media_type: { type: 'string', enum: ['image', 'video', 'document'] },
      purpose: { type: 'string', description: 'Defaults to social' },
      alt_text: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:write');
    const { ingestMediaInput } = await import('@/lib/media/ingestMedia');
    const source = args.file || args.base64 || args.source_url || '';

    rejectLocalAiPaths(args.source_url, 'source_url');
    rejectLocalAiPaths(args.file, 'file');
    rejectLocalAiPaths(args.base64, 'base64');
    rejectLocalAiPaths(args.filename, 'filename');

    const asset = await ingestMediaInput({
      tenantId,
      userId,
      purpose: args.purpose || 'social',
      media: args.source_url
        ? { type: 'url', url: args.source_url, filename: args.filename }
        : {
            type: String(source).startsWith('data:') ? 'data_url' : 'base64',
            ...(String(source).startsWith('data:')
              ? { dataUrl: source, filename: args.filename }
              : {
                  data: source,
                  filename: args.filename || `social-upload.${args.media_type === 'document' ? 'pdf' : args.media_type === 'video' ? 'mp4' : 'png'}`,
                  mimeType: args.mime_type || (args.media_type === 'document' ? 'application/pdf' : args.media_type === 'video' ? 'video/mp4' : 'image/png'),
                }),
          } as any,
    });

    return mediaToolResult({
      id: asset.id,
      filename: asset.filename,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes,
      url: asset.url,
      status: asset.status,
      width: asset.width,
      height: asset.height,
      checksum: asset.checksum,
    });
  },
});

defineConnectorTool({
  module: 'social-publishing',
  name: 'upload_media',
  description:
    'Upload social media asset (image PNG/JPG/JPEG/GIF/WebP, video MP4/MOV/WebM, or document PDF) via base64, data URL, remote HTTPS source URL, or file. Returns media_asset_id and public_url for social publishing.',
  permission: 'social:write',
  rateLimitClass: 'heavy',
  auditAction: 'mcp_upload_media',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    filename: z.string().optional(),
    file_name: z.string().optional(),
    mime_type: z.string().optional(),
    content_type: z.string().optional(),
    content_base64: z.string().optional(),
    file_base64: z.string().optional(),
    file: z.string().optional(),
    data_url: z.string().optional(),
    source_url: z.string().optional(),
    url: z.string().optional(),
    purpose: z.string().optional(),
    alt_text: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      filename: { type: 'string', description: 'Original file name e.g. post.png' },
      file_name: { type: 'string', description: 'Alias for filename' },
      mime_type: { type: 'string', description: 'MIME type e.g. image/png, video/mp4' },
      content_type: { type: 'string', description: 'Alias for mime_type' },
      content_base64: { type: 'string', description: 'Base64 file content string' },
      file_base64: { type: 'string', description: 'Alias for content_base64' },
      file: { type: 'string', description: 'Alias for content_base64' },
      data_url: { type: 'string', description: 'data:image/...;base64,... string' },
      source_url: { type: 'string', description: 'HTTPS source URL of media to fetch/ingest' },
      url: { type: 'string', description: 'Alias for source_url' },
      purpose: { type: 'string', description: 'Defaults to social_post' },
      alt_text: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:write');
    const { ingestMediaInput } = await import('@/lib/media/ingestMedia');

    const filename = args.filename || args.file_name;
    const mimeType = args.mime_type || args.content_type;
    const contentBase64 = args.content_base64 || args.file_base64 || args.file;
    const sourceUrl = args.source_url || args.url;

    rejectLocalAiPaths(sourceUrl, 'source_url');
    rejectLocalAiPaths(contentBase64, 'content_base64');
    rejectLocalAiPaths(args.data_url, 'data_url');
    rejectLocalAiPaths(filename, 'filename');

    let mediaInput: any = null;

    if (args.data_url || (contentBase64 && String(contentBase64).startsWith('data:'))) {
      mediaInput = {
        type: 'data_url' as const,
        dataUrl: args.data_url || String(contentBase64),
        filename,
      };
    } else if (sourceUrl) {
      mediaInput = {
        type: 'url' as const,
        url: sourceUrl,
        filename,
      };
    } else if (contentBase64 && filename && mimeType) {
      mediaInput = {
        type: 'base64' as const,
        base64: contentBase64,
        filename,
        mimeType,
      };
    } else if (contentBase64) {
      mediaInput = {
        type: 'base64' as const,
        base64: contentBase64,
        filename: filename || 'upload.png',
        mimeType: mimeType || 'image/png',
      };
    } else {
      throwConnectorError(
        'INVALID_INPUT',
        'Provide content_base64 (or file/file_base64) + filename, or source_url, or data_url. Local paths like /mnt/data are prohibited.'
      );
    }

    try {
      const asset = await ingestMediaInput({
        tenantId,
        userId,
        purpose: args.purpose || 'social_post',
        media: mediaInput,
      });

      return okResult(
        'upload_media',
        {
          media_asset_id: asset.id,
          media_id: asset.id,
          media_url: asset.url,
          public_url: asset.url,
          filename: asset.filename,
          mime_type: asset.mime_type,
          size_bytes: asset.size_bytes,
          width: asset.width,
          height: asset.height,
          checksum: asset.checksum,
          status: asset.status,
        },
        {
          receipt: {
            action_id: asset.id,
            status: 'completed',
            entity_id: asset.id,
            entity_type: 'media_asset',
            live_url: asset.url,
            timestamp: new Date().toISOString(),
            verification: {
              permanent_public_url: Boolean(asset.url),
              mime_type: asset.mime_type,
              size_bytes: asset.size_bytes,
            },
          },
        }
      );
    } catch (err: any) {
      throwConnectorError(
        'UPLOAD_FAILED',
        err?.message || 'Media ingestion failed',
        err
      );
    }
  },
});

registerTool('social-publishing', {
  name: 'get_media',
  description:
    'Fetch a tenant-scoped media asset by media_id / media_asset_id. Returns the permanent public media_url (no storage credentials). Use after upload_media or list_media_assets.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    media_id: z.string().uuid().optional(),
    media_asset_id: z.string().uuid().optional(),
    asset_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      media_id: { type: 'string', format: 'uuid', description: 'Alias for media_asset_id' },
      media_asset_id: { type: 'string', format: 'uuid' },
      asset_id: { type: 'string', format: 'uuid', description: 'Alias for media_asset_id' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    const assetId = args.media_id || args.media_asset_id || args.asset_id;
    if (!assetId) throw new Error('media_id (or media_asset_id / asset_id) is required');
    const { ingestMediaInput } = await import('@/lib/media/ingestMedia');
    const asset = await ingestMediaInput({
      tenantId,
      userId,
      media: { type: 'asset_id', assetId },
    });
    return mediaToolResult({
      id: asset.id,
      filename: asset.filename,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes,
      url: asset.url,
      status: asset.status,
      width: asset.width,
      height: asset.height,
    });
  },
});

registerTool('social-publishing', {
  name: 'get_media_asset',
  description: 'Return tenant-scoped social asset metadata, dimensions, URL, checksum and readiness.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    asset_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: { asset_id: { type: 'string', format: 'uuid' } },
    required: ['asset_id'],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:read');
    const { ingestMediaInput } = await import('@/lib/media/ingestMedia');
    const asset = await ingestMediaInput({
      tenantId,
      userId,
      media: { type: 'asset_id', assetId: args.asset_id },
    });
    return mediaToolResult({
      id: asset.id,
      filename: asset.filename,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes,
      url: asset.url,
      status: asset.status,
      width: asset.width,
      height: asset.height,
      checksum: asset.checksum,
    });
  },
});

registerTool('social-publishing', {
  name: 'list_media_assets',
  description: 'List tenant-scoped social assets filtered by images, videos, or documents.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    type: z.enum(['all', 'images', 'videos', 'documents']).optional().default('all'),
    limit: z.number().int().min(1).max(100).optional().default(25),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['all', 'images', 'videos', 'documents'] },
      limit: { type: 'number', minimum: 1, maximum: 100 },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId } = await requireSocialAuth(args, ctx, 'social:read');
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('media_assets')
      .select('id, file_name, file_type, asset_type, file_size_bytes, public_url, thumbnail_url, width, height, checksum_sha256, storage_provider, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(args.limit || 25);
    if (args.type === 'images') query = query.in('asset_type', ['image', 'gif']);
    if (args.type === 'videos') query = query.eq('asset_type', 'video');
    if (args.type === 'documents') query = query.eq('asset_type', 'document');
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return {
      assets: (data || []).map((row) => ({
        asset_id: row.id,
        filename: row.file_name,
        mime_type: row.file_type,
        asset_type: row.asset_type,
        size_bytes: row.file_size_bytes,
        media_url: row.public_url,
        thumbnail_url: row.thumbnail_url || null,
        width: row.width,
        height: row.height,
        checksum: row.checksum_sha256,
        provider: row.storage_provider || 'supabase',
        status: row.status || 'ready',
        created_at: row.created_at,
      })),
    };
  },
});

registerTool('social-publishing', {
  name: 'delete_media',
  description:
    'Delete a tenant-scoped media asset from Alphaclone storage and the media library. Cannot delete another tenant’s files.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    media_id: z.string().uuid().optional(),
    media_asset_id: z.string().uuid().optional(),
    asset_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      media_id: { type: 'string', format: 'uuid' },
      media_asset_id: { type: 'string', format: 'uuid' },
      asset_id: { type: 'string', format: 'uuid' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:write');
    void userId;
    const assetId = args.media_id || args.media_asset_id || args.asset_id;
    if (!assetId) throw new Error('media_id (or media_asset_id / asset_id) is required');

    const supabase = createSupabaseAdminClient();
    const { data: asset, error } = await supabase
      .from('media_assets')
      .select('id, storage_path, tenant_id, public_url')
      .eq('tenant_id', tenantId)
      .eq('id', assetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!asset) throw new Error(`media_asset_id not found for tenant: ${assetId}`);
    if (asset.tenant_id !== tenantId) throw new Error('Cross-tenant media access denied');

    if (asset.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('public-assets')
        .remove([asset.storage_path]);
      if (storageError) throw new Error(storageError.message);
    }

    const { error: deleteError } = await supabase
      .from('media_assets')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', assetId);
    if (deleteError) throw new Error(deleteError.message);

    return {
      success: true,
      ok: true,
      deleted: true,
      media_id: assetId,
      media_asset_id: assetId,
      media_url: asset.public_url || null,
    };
  },
});

registerTool('social-publishing', {
  name: 'delete_media_asset',
  description: 'Safely delete an unused tenant-owned media asset and its storage object.',
  inputSchema: z.object({
    tenant_id: z.string().uuid().optional(),
    asset_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: { asset_id: { type: 'string', format: 'uuid' } },
    required: ['asset_id'],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:write');
    const { executeTool } = await import('../tool-registry');
    return executeTool(tenantId, userId, 'delete_media', {
      tenant_id: tenantId,
      asset_id: args.asset_id,
    });
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
    media: z.array(z.record(z.string(), z.unknown())).optional(),
    media_ids: z.array(z.string().uuid()).optional(),
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
      media_ids: {
        type: 'array',
        description: 'Canonical alias for media_asset_ids returned by upload_social_media.',
        items: { type: 'string', format: 'uuid' },
      },
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
      mediaAssetIds: args.media_ids || args.media_asset_ids,
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

defineConnectorTool({
  module: 'social-publishing',
  name: 'create_social_post_with_media',
  description:
    'One-step media ingestion and social post publishing/scheduling for ChatGPT and MCP clients. Accepts base64 image/video/document content, data URLs, source URLs, or existing asset IDs. Enforces valid media processing and returns verification receipt with provider post ID and live URL.',
  permission: 'social:publish',
  rateLimitClass: 'publish',
  auditAction: 'mcp_create_social_post_with_media',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    caption: z.string().optional(),
    content: z.string().optional(),
    text: z.string().optional(),
    filename: z.string().optional(),
    file_name: z.string().optional(),
    mime_type: z.string().optional(),
    content_type: z.string().optional(),
    content_base64: z.string().optional(),
    file_base64: z.string().optional(),
    file: z.string().optional(),
    data_url: z.string().optional(),
    source_url: z.string().optional(),
    url: z.string().optional(),
    media_url: z.string().optional(),
    asset_id: z.string().optional(),
    asset_ids: z.array(z.string()).optional(),
    media_asset_ids: z.array(z.string()).optional(),
    media_urls: z.array(z.string()).optional(),
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
    idempotency_key: z.string().optional(),
    confirmed: z.boolean().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      caption: { type: 'string', description: 'Post text / caption' },
      content: { type: 'string', description: 'Alias for caption' },
      text: { type: 'string', description: 'Alias for caption' },
      filename: { type: 'string', description: 'Original media filename' },
      file_name: { type: 'string', description: 'Alias for filename' },
      mime_type: { type: 'string', description: 'MIME type e.g. image/png, video/mp4' },
      content_type: { type: 'string', description: 'Alias for mime_type' },
      content_base64: { type: 'string', description: 'Base64 image/video/document string' },
      file_base64: { type: 'string', description: 'Alias for content_base64' },
      file: { type: 'string', description: 'Alias for content_base64' },
      data_url: { type: 'string', description: 'data:image/...;base64,... data URL' },
      source_url: { type: 'string', description: 'Public HTTPS media URL' },
      url: { type: 'string', description: 'Alias for source_url' },
      media_url: { type: 'string', description: 'Alias for source_url' },
      asset_id: { type: 'string', description: 'Existing media asset ID' },
      asset_ids: { type: 'array', items: { type: 'string' } },
      media_asset_ids: { type: 'array', items: { type: 'string' } },
      media_urls: { type: 'array', items: { type: 'string' } },
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
      idempotency_key: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:publish');
    const caption = args.caption || args.content || args.text;
    if (!caption || !caption.trim()) {
      throwConnectorError('INVALID_INPUT', 'caption is required');
    }

    const platformRaw = (args.platform || (Array.isArray(args.platforms) ? args.platforms[0] : 'facebook')).toLowerCase();
    const platform: 'facebook' | 'linkedin' = platformRaw === 'linkedin' ? 'linkedin' : 'facebook';

    let identityId = args.identity_id || args.page_id || args.linkedin_organization_id || undefined;
    let identityType = args.identity_type;

    if (!identityType) {
      if (platform === 'facebook') {
        identityType = 'facebook_page';
      } else if (args.linkedin_organization_id) {
        identityType = 'linkedin_organization';
      } else {
        identityType = 'linkedin_person';
      }
    }

    // Process media inputs
    const { ingestMediaInput } = await import('@/lib/media/ingestMedia');
    const contentBase64 = args.content_base64 || args.file_base64 || args.file;
    const sourceUrl = args.source_url || args.url || args.media_url;
    const filename = args.filename || args.file_name;
    const mimeType = args.mime_type || args.content_type;

    const finalMediaAssetIds: string[] = [
      ...(args.media_asset_ids || []),
      ...(args.asset_ids || []),
      ...(args.asset_id ? [args.asset_id] : []),
    ];
    const finalMediaUrls: string[] = [...(args.media_urls || [])];

    const hasRawMediaInput = Boolean(contentBase64 || args.data_url || sourceUrl);

    if (hasRawMediaInput) {
      rejectLocalAiPaths(sourceUrl, 'source_url');
      rejectLocalAiPaths(contentBase64, 'content_base64');
      rejectLocalAiPaths(args.data_url, 'data_url');
      rejectLocalAiPaths(filename, 'filename');

      let mediaInput: any = null;
      if (args.data_url || (contentBase64 && String(contentBase64).startsWith('data:'))) {
        mediaInput = {
          type: 'data_url' as const,
          dataUrl: args.data_url || String(contentBase64),
          filename,
        };
      } else if (sourceUrl) {
        mediaInput = { type: 'url' as const, url: sourceUrl, filename };
      } else if (contentBase64) {
        mediaInput = {
          type: 'base64' as const,
          base64: contentBase64,
          filename: filename || 'upload.png',
          mimeType: mimeType || 'image/png',
        };
      }

      try {
        const asset = await ingestMediaInput({
          tenantId,
          userId,
          purpose: 'social_post',
          media: mediaInput,
        });
        if (asset?.id) finalMediaAssetIds.push(asset.id);
        if (asset?.url) finalMediaUrls.push(asset.url);
      } catch (err: any) {
        // STRICT RULE: If media input was supplied but ingestion failed, DO NOT publish text-only!
        throwConnectorError(
          'MEDIA_INGESTION_FAILED',
          `Media processing failed: ${err?.message || 'Unknown media ingestion error'}. Aborting post execution.`,
          err
        );
      }
    }

    // Check if media parameters were intended but 0 items ingested
    if (
      (hasRawMediaInput || (args.asset_ids && args.asset_ids.length > 0) || (args.media_asset_ids && args.media_asset_ids.length > 0)) &&
      finalMediaAssetIds.length === 0 &&
      finalMediaUrls.length === 0
    ) {
      throwConnectorError(
        'MEDIA_INGESTION_FAILED',
        'Media was supplied but could not be processed into valid asset IDs or URLs. Refusing to publish text-only post.'
      );
    }

    const publishNow = args.publish_now !== false && !args.scheduled_at;

    const { getSocialPublishingService } = await import('@/lib/social/SocialPublishingService');
    const service = getSocialPublishingService();

    const publishResult = await service.publish({
      tenantId,
      userId,
      platform,
      identityType,
      identityId: identityId || '',
      caption,
      mediaUrls: finalMediaUrls.length > 0 ? finalMediaUrls : undefined,
      mediaAssetIds: finalMediaAssetIds.length > 0 ? finalMediaAssetIds : undefined,
      publishNow,
      scheduledAt: args.scheduled_at || null,
      idempotencyKey: args.idempotency_key,
      aiClient: 'mcp-chatgpt',
    });

    if (!publishResult.ok) {
      throwConnectorError(
        publishResult.error?.code || 'PUBLISH_FAILED',
        publishResult.error?.message || 'Publishing failed',
        publishResult.data
      );
    }

    return okResult('create_social_post_with_media', publishResult.data, {
      receipt: publishResult.receipt
        ? {
            action_id: publishResult.receipt.action_id,
            status: publishResult.data?.status || 'published',
            provider: platform,
            provider_reference: publishResult.data?.provider_post_id || null,
            entity_id: publishResult.data?.social_post_id,
            entity_type: 'social_post',
            live_url: publishResult.data?.live_url || null,
            timestamp: publishResult.data?.published_at || new Date().toISOString(),
            verification: {
              verified: publishResult.receipt.verified,
              verified_at: publishResult.receipt.verified_at,
              correlation_id: publishResult.receipt.correlation_id,
              media_asset_ids: publishResult.data?.media_asset_ids || finalMediaAssetIds,
            },
          }
        : undefined,
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

const assetPublishSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  identity_id: z.string().optional(),
  identity_type: z.enum(['facebook_page', 'linkedin_person', 'linkedin_organization']).optional(),
  content: z.string().min(1),
  asset_ids: z.array(z.string().uuid()).min(1).max(10),
  publish_now: z.boolean().optional().default(true),
  scheduled_at: z.string().datetime().optional(),
  idempotency_key: z.string().optional(),
});

const assetPublishJsonSchema = {
  type: 'object' as const,
  properties: {
    identity_id: { type: 'string' },
    identity_type: {
      type: 'string',
      enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
    },
    content: { type: 'string' },
    asset_ids: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: { type: 'string', format: 'uuid' },
    },
    publish_now: { type: 'boolean' },
    scheduled_at: { type: 'string', format: 'date-time' },
    idempotency_key: { type: 'string' },
  },
  required: ['content', 'asset_ids'],
};

function registerCanonicalAssetPublisher(input: {
  name: string;
  description: string;
  platform: 'facebook' | 'linkedin';
  identityType: 'facebook_page' | 'linkedin_person' | 'linkedin_organization';
  minAssets?: number;
  maxAssets?: number;
  requiredFamily: 'image' | 'video' | 'document';
}) {
  registerTool('social-publishing', {
    name: input.name,
    description: input.description,
    inputSchema: assetPublishSchema,
    jsonSchema: assetPublishJsonSchema,
    handler: async (args, ctx) => {
      const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:publish');
      const min = input.minAssets || 1;
      const max = input.maxAssets || 1;
      if (args.asset_ids.length < min || args.asset_ids.length > max) {
        throw new Error(`${input.name} requires ${min === max ? min : `${min}–${max}`} asset(s)`);
      }
      const { ingestMediaInput } = await import('@/lib/media/ingestMedia');
      const assets = await Promise.all(
        args.asset_ids.map((assetId) =>
          ingestMediaInput({ tenantId, userId, media: { type: 'asset_id', assetId } })
        )
      );
      for (const asset of assets) {
        const family = asset.mime_type.startsWith('image/')
          ? 'image'
          : asset.mime_type.startsWith('video/')
            ? 'video'
            : asset.mime_type === 'application/pdf'
              ? 'document'
              : 'unsupported';
        if (family !== input.requiredFamily) {
          throw new Error(`${input.name} requires ${input.requiredFamily} assets`);
        }
      }
      const { resolveTenantIdentityForPublish } = await import('@/lib/social/socialIdentityStore');
      const requestedIdentityType =
        input.platform === 'linkedin' && args.identity_type === 'linkedin_organization'
          ? 'linkedin_organization'
          : input.identityType;
      const identity = await resolveTenantIdentityForPublish({
        tenantId,
        identityId: args.identity_id,
        identityType: requestedIdentityType,
        provider: input.platform,
        allowDefault: !args.identity_id,
      });
      const service = getSocialPublishingService();
      const result = await service.publish({
        tenantId,
        userId,
        platform: input.platform,
        identityType: requestedIdentityType,
        identityId: identity.provider_identity_id,
        caption: args.content,
        mediaAssetIds: args.asset_ids,
        publishNow: args.publish_now !== false,
        scheduledAt: args.scheduled_at,
        idempotencyKey: args.idempotency_key,
        aiClient: 'mcp',
      });
      if (!result.ok) throw new Error(result.error?.message || `${input.name} failed`);
      return toMcpContent(okResult(input.name, result.data, { receipt: result.receipt }));
    },
  });
}

registerCanonicalAssetPublisher({
  name: 'publish_facebook_photo',
  description: 'Publish one tenant-owned image asset to a connected Facebook Page.',
  platform: 'facebook',
  identityType: 'facebook_page',
  requiredFamily: 'image',
});
registerCanonicalAssetPublisher({
  name: 'publish_facebook_album',
  description: 'Publish 2–10 tenant-owned image assets as one Facebook multi-photo post.',
  platform: 'facebook',
  identityType: 'facebook_page',
  minAssets: 2,
  maxAssets: 10,
  requiredFamily: 'image',
});
registerCanonicalAssetPublisher({
  name: 'publish_facebook_video',
  description: 'Publish one tenant-owned video asset to a connected Facebook Page.',
  platform: 'facebook',
  identityType: 'facebook_page',
  requiredFamily: 'video',
});
registerCanonicalAssetPublisher({
  name: 'publish_linkedin_image',
  description: 'Publish one tenant-owned image asset to a LinkedIn person or organization identity.',
  platform: 'linkedin',
  identityType: 'linkedin_person',
  requiredFamily: 'image',
});
registerCanonicalAssetPublisher({
  name: 'publish_linkedin_document',
  description: 'Upload and publish one tenant-owned PDF document to LinkedIn.',
  platform: 'linkedin',
  identityType: 'linkedin_person',
  requiredFamily: 'document',
});

for (const providerTool of [
  ['publish_instagram_photo', 'photo'],
  ['publish_instagram_reel', 'reel'],
  ['publish_instagram_carousel', 'carousel'],
] as const) {
  registerTool('social-publishing', {
    name: providerTool[0],
    description: `Publish tenant-owned asset IDs as an Instagram ${providerTool[1]} and verify the provider media ID.`,
    inputSchema: assetPublishSchema,
    jsonSchema: assetPublishJsonSchema,
    handler: async (args, ctx) => {
      const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:publish');
      if (args.scheduled_at || args.publish_now === false) {
        throw new Error('Instagram provider scheduling is not enabled for this direct tool; create a scheduled social post instead');
      }
      const { publishInstagramAssets } = await import('@/lib/social/providerAssetPublishers');
      return publishInstagramAssets({
        tenantId,
        userId,
        assetIds: args.asset_ids,
        caption: args.content,
        mode: providerTool[1],
        instagramAccountId: args.identity_id,
      });
    },
  });
}

for (const providerTool of ['publish_x_image', 'publish_x_video'] as const) {
  registerTool('social-publishing', {
    name: providerTool,
    description: `Upload tenant-owned ${providerTool.endsWith('video') ? 'video' : 'image'} assets to X, publish the post, and verify its provider ID.`,
    inputSchema: assetPublishSchema,
    jsonSchema: assetPublishJsonSchema,
    handler: async (args, ctx) => {
      const { tenantId, userId } = await requireSocialAuth(args, ctx, 'social:publish');
      if (args.scheduled_at || args.publish_now === false) {
        throw new Error('X provider scheduling is not enabled for this direct tool; create a scheduled social post instead');
      }
      const { ingestMediaInput } = await import('@/lib/media/ingestMedia');
      const expected = providerTool.endsWith('video') ? 'video/' : 'image/';
      for (const assetId of args.asset_ids) {
        const asset = await ingestMediaInput({
          tenantId,
          userId,
          media: { type: 'asset_id', assetId },
        });
        if (!asset.mime_type.startsWith(expected)) {
          throw new Error(`${providerTool} requires ${expected.slice(0, -1)} assets`);
        }
      }
      const { publishXAssets } = await import('@/lib/social/providerAssetPublishers');
      return publishXAssets({
        tenantId,
        userId,
        assetIds: args.asset_ids,
        content: args.content,
      });
    },
  });
}

export { CANONICAL_SOCIAL_MCP_TOOLS, SOCIAL_PUBLISH_TOOL_CATALOG_VERSION };

// Bust discovery cache after this module registers canonical tools
try {
  const { invalidateUnifiedMcpToolCache } = require('../listAllTools');
  invalidateUnifiedMcpToolCache();
} catch {
  // ignore during early bootstrap
}
