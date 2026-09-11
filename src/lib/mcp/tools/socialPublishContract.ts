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

export const SOCIAL_DESTINATION_VALUES = ['personal', 'organization', 'page'] as const;

export const publishSocialTargetSchema = z
  .object({
    integration: z.enum(['facebook', 'linkedin']).optional(),
    destination: z.enum(SOCIAL_DESTINATION_VALUES).optional(),
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
    destination: z.enum(SOCIAL_DESTINATION_VALUES).optional(),
    post_as: z.enum(['personal', 'company', 'organization', 'all_pages']).optional(),
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

export function destinationToIdentityType(
  platform: 'facebook' | 'linkedin' | undefined,
  destination: (typeof SOCIAL_DESTINATION_VALUES)[number] | undefined
): 'facebook_page' | 'linkedin_person' | 'linkedin_organization' | undefined {
  if (!destination) return undefined;
  if (destination === 'personal') return platform === 'linkedin' ? 'linkedin_person' : undefined;
  if (destination === 'organization') return platform === 'linkedin' ? 'linkedin_organization' : undefined;
  if (destination === 'page') return platform === 'facebook' ? 'facebook_page' : undefined;
  return undefined;
}

export const publishSocialPostJsonSchema = {
  type: 'object' as const,
  properties: {
    target: {
      type: 'object',
      description:
        'Optional destination envelope. If the user says personal, organization/company, or Facebook page, set destination accordingly. If the user already named a destination, do not ask again.',
      properties: {
        integration: { type: 'string', enum: ['facebook', 'linkedin'] },
        destination: {
          type: 'string',
          enum: [...SOCIAL_DESTINATION_VALUES],
          description: 'Human-friendly target: personal = LinkedIn personal profile, organization = LinkedIn company page, page = Facebook Page.',
        },
        identity_type: {
          type: 'string',
          enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
          description: 'Low-level identity type; destination is preferred when the user speaks naturally.',
        },
        identity_id: {
          type: 'string',
          description: 'Internal identity UUID from connected_accounts or get_social_identities.',
        },
        resource_type: { type: 'string' },
        resource_id: { type: 'string' },
      },
    },
    destination: {
      type: 'string',
      enum: [...SOCIAL_DESTINATION_VALUES],
      description: 'Set from the user intent. personal routes to LinkedIn personal; organization routes to LinkedIn organization; page routes to Facebook Page.',
    },
    post_as: {
      type: 'string',
      enum: ['personal', 'company', 'organization', 'all_pages'],
      description: 'Legacy LinkedIn destination alias. personal routes only to linkedin_person; company/organization route only to linkedin_organization.',
    },
    identity_id: {
      type: 'string',
      description: 'Internal identity UUID from connected_accounts or get_social_identities. Required only when more than one identity of the selected type exists.',
    },
    platform: {
      type: 'string',
      enum: ['facebook', 'linkedin'],
      description: 'Target social platform.',
    },
    identity_type: {
      type: 'string',
      enum: ['facebook_page', 'linkedin_person', 'linkedin_organization'],
      description: 'Low-level target type. Prefer destination for personal/organization/page language.',
    },
    caption: { type: 'string' },
    content: { type: 'string', description: 'Alias for caption' },
    media: { type: 'array', items: { type: 'object' } },
    media_asset_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
    media_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
    media_urls: { type: 'array', items: { type: 'string' } },
    media_url: { type: 'string' },
    image_url: { type: 'string' },
    media_id: { type: 'string', format: 'uuid' },
    media_asset_id: { type: 'string', format: 'uuid' },
    link_url: { type: 'string' },
    publish_now: { type: 'boolean', description: 'Publish immediately.' },
    status: { type: 'string', enum: [...PUBLISH_EXECUTION_STATUS_VALUES] },
    scheduled_at: { type: 'string', format: 'date-time' },
    idempotency_key: { type: 'string' },
    page_id: { type: 'string' },
    linkedin_organization_id: { type: 'string' },
    content_base64: { type: 'string' },
    data_url: { type: 'string' },
    source_url: { type: 'string' },
    dry_run: { type: 'boolean' },
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
