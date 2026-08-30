import { randomUUID } from 'node:crypto';
import {
  resolveEmailIntegrationDefaults,
  resolveSocialPublishDefaults,
} from '@/lib/mcp/integrationDefaults';

const WRITE_TOOL_PATTERN =
  /(^|_)(send|publish|upload|create|update|delete|queue|retry|approve|reject|schedule|sign|pay|mark)_?|^(send|publish|upload|create|update|delete|queue|approve|reject)/i;

const WORKFLOW_TOOLS = new Set(['run_workflow', 'run_playbook', 'stop_workflow', 'resume_workflow']);

const EMAIL_TOOLS = new Set([
  'send_email',
  'send_transactional_email',
  'send_outreach_email',
  'reply_to_email',
  'generate_outreach_draft',
  'queue_email_campaign_send',
  'send_bulk_email_campaign',
]);

const SOCIAL_PUBLISH_TOOLS = new Set([
  'publish_social_post',
  'publish_post',
  'create_social_post',
  'create_social_post_with_media',
  'publish_now',
  'schedule_post',
  'schedule_social_post',
]);

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return undefined;
}

function coalesceArgs(args: Record<string, unknown>): Record<string, unknown> {
  const next = { ...args };

  next.text = firstNonEmpty(next.text, next.body, next.message, next.content, next.email_body);
  next.to = firstNonEmpty(next.to, next.recipient, next.recipient_email, next.email, next.email_address);
  next.subject = firstNonEmpty(next.subject, next.title, next.email_subject);
  next.caption = firstNonEmpty(next.caption, next.content, next.text, next.post_text, next.message);
  next.recipient_name = firstNonEmpty(next.recipient_name, next.name, next.contact_name);

  if (!next.media_urls && next.media_url) next.media_urls = [next.media_url];
  if (!next.media_urls && next.image_url) next.media_urls = [next.image_url];
  if (!next.media_asset_ids && next.media_id) next.media_asset_ids = [next.media_id];
  if (!next.media_asset_ids && next.media_asset_id) next.media_asset_ids = [next.media_asset_id];
  if (!next.media_ids && next.media_asset_ids) next.media_ids = next.media_asset_ids;

  if (next.publish_immediately === true || next.immediate === true) {
    next.publish_now = true;
  }
  if (next.status === 'publish_now') {
    next.publish_now = true;
  }

  // Social post ID aliases (ChatGPT often sends post_id / id)
  next.social_post_id = firstNonEmpty(
    next.social_post_id,
    next.post_id,
    next.socialPostId,
    next.postId,
    next.id
  );

  // Email read aliases
  next.message_id = firstNonEmpty(next.message_id, next.email_id, next.messageId);
  if (next.limit !== undefined && next.limit !== null && typeof next.limit !== 'number') {
    const parsed = parseInt(String(next.limit), 10);
    if (!Number.isNaN(parsed)) next.limit = parsed;
  }

  return next;
}

function needsAutoIdempotency(toolName: string): boolean {
  if (WRITE_TOOL_PATTERN.test(toolName)) return true;
  return EMAIL_TOOLS.has(toolName) || SOCIAL_PUBLISH_TOOLS.has(toolName) || WORKFLOW_TOOLS.has(toolName);
}

/**
 * Normalize MCP tool arguments so chat agents can execute writes without
 * memorizing internal field names or integration setup details.
 */
export async function normalizeToolArguments(
  toolName: string,
  rawArgs: Record<string, unknown>,
  ctx: { tenantId: string; userId: string }
): Promise<Record<string, unknown>> {
  let args = coalesceArgs(rawArgs);

  if (needsAutoIdempotency(toolName) && !firstNonEmpty(args.idempotency_key, args.idempotencyKey)) {
    args.idempotency_key = `mcp-${toolName}-${randomUUID()}`;
  }

  if (EMAIL_TOOLS.has(toolName)) {
    if (!args.text && args.subject) {
      args.text = String(args.subject);
    }
    if (!args.provider) {
      const defaults = await resolveEmailIntegrationDefaults(ctx.tenantId);
      if (defaults.provider) args.provider = defaults.provider;
      if (!args.from && defaults.senderEmail) args.from = defaults.senderEmail;
    }
  }

  if (toolName === 'run_workflow' || toolName === 'run_playbook') {
    if (!args.playbook_id && args.workflow_id) {
      args.playbook_id = args.workflow_id;
    }
    if (!args.inputs && args.input) {
      args.inputs = args.input;
    }
  }

  if (SOCIAL_PUBLISH_TOOLS.has(toolName)) {
    const platformHint = firstNonEmpty(args.platform, args.provider);
    if (
      !args.identity_id &&
      !args.facebook_page_id &&
      !args.linkedin_organization_id &&
      !args.linkedin_member_id
    ) {
      const defaults = await resolveSocialPublishDefaults(
        ctx.tenantId,
        platformHint
      );
      if (defaults.identity_id) args.identity_id = defaults.identity_id;
      if (defaults.platform && !args.platform) args.platform = defaults.platform;
      if (defaults.identity_type && !args.identity_type) {
        args.identity_type = defaults.identity_type;
      }
      if (defaults.facebook_page_id && !args.facebook_page_id) {
        args.facebook_page_id = defaults.facebook_page_id;
      }
      if (defaults.linkedin_organization_id && !args.linkedin_organization_id) {
        args.linkedin_organization_id = defaults.linkedin_organization_id;
      }
      if (defaults.linkedin_member_id && !args.linkedin_member_id) {
        args.linkedin_member_id = defaults.linkedin_member_id;
      }
    }
  }

  return args;
}
