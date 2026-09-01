/**
 * Shared MCP publish contract (schemas + status helpers) — no runtime side effects.
 */

import { z } from 'zod';

export const PUBLISH_EXECUTION_STATUS_VALUES = [
  'execute_now',
  'publish_now',
  'draft',
  'scheduled',
] as const;

export const publishSocialTargetSchema = z
  .object({
    integration: z.enum(['facebook', 'linkedin']).optional(),
    identity_type: z
      .enum(['facebook_page', 'linkedin_person', 'linkedin_organization'])
      .optional(),
    identity_id: z.string().min(1).optional(),
    resource_type: z.string().optional(),
    resource_id: z.string().optional(),
  })
  .optional();

export const publishSocialPostInputSchema = z
  .object({
    tenant_id: z.string().uuid().optional(),
    target: publishSocialTargetSchema,
    identity_id: z.string().min(1).optional(),
    platform: z.enum(['facebook', 'linkedin']).optional(),
    identity_type: z
      .enum(['facebook_page', 'linkedin_person', 'linkedin_organization'])
      .optional(),
    caption: z.string().optional(),
    content: z.string().optional(),
    media: z.array(z.record(z.string(), z.unknown())).optional(),
    media_ids: z.array(z.string().uuid()).optional(),
    media_asset_ids: z.array(z.string().uuid()).optional(),
    media_urls: z.array(z.string()).optional(),
    media_url: z.string().optional(),
    image_url: z.string().optional(),
    media_id: z.string().uuid().optional(),
    media_asset_id: z.string().uuid().optional(),
    link_url: z.string().url().optional(),
    publish_now: z.boolean().optional().default(false),
    status: z.enum(PUBLISH_EXECUTION_STATUS_VALUES).optional(),
    scheduled_at: z.string().datetime().optional(),
    idempotency_key: z.string().optional(),
    page_id: z.string().optional(),
    linkedin_organization_id: z.string().optional(),
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
    signed_url: z.string().optional(),
    dry_run: z.boolean().optional(),
  })
  .refine((v) => Boolean(String(v.caption || v.content || '').trim()), {
    message: 'caption or content is required',
  });

export type PublishSocialPostArgs = z.infer<typeof publishSocialPostInputSchema>;

export const publishSocialPostJsonSchema = {
  type: 'object' as const,
  properties: {
    target: {
      type: 'object',
      description:
        'Normalized publish destination. Required when multiple identities are connected.',
      properties: {
        integration: { type: 'string', enum: ['facebook', 'linkedin'] },
        identity_type: {
          type: 'string',
          enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
        },
        identity_id: {
          type: 'string',
          description: 'Internal identity UUID from get_social_identities',
        },
        resource_type: { type: 'string' },
        resource_id: { type: 'string' },
      },
    },
    identity_id: {
      type: 'string',
      description:
        'Internal identity UUID from get_social_identities. Required when multiple identities connected.',
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
    media_url: { type: 'string', description: 'Single public HTTPS media URL from upload_social_media' },
    image_url: { type: 'string', description: 'Alias for media_url' },
    media_id: { type: 'string', format: 'uuid', description: 'Single media_id from upload_social_media' },
    media_asset_id: { type: 'string', format: 'uuid', description: 'Alias for media_id' },
    link_url: { type: 'string' },
    publish_now: { type: 'boolean', description: 'Publish immediately (preferred over status)' },
    status: {
      type: 'string',
      enum: [...PUBLISH_EXECUTION_STATUS_VALUES],
      description: 'Use execute_now or publish_now for immediate publish; draft or scheduled otherwise.',
    },
    scheduled_at: { type: 'string', format: 'date-time' },
    idempotency_key: { type: 'string' },
    page_id: { type: 'string', description: 'Legacy Facebook page id alias' },
    linkedin_organization_id: { type: 'string', description: 'Legacy LinkedIn org id alias' },
    content_base64: { type: 'string', description: 'Inline base64 image (uploaded before publish)' },
    data_url: { type: 'string', description: 'data:image/...;base64,... string' },
    source_url: { type: 'string', description: 'Public HTTPS image URL' },
    dry_run: { type: 'boolean', description: 'Validate only — no provider write' },
  },
  required: [] as string[],
};

export function resolvePublishNow(args: PublishSocialPostArgs): boolean {
  if (args.dry_run) return false;
  if (args.publish_now === true) return true;
  if (args.status === 'execute_now' || args.status === 'publish_now') return true;
  if (args.scheduled_at || args.status === 'scheduled' || args.status === 'draft') return false;
  return !args.scheduled_at && args.status !== 'draft';
}
