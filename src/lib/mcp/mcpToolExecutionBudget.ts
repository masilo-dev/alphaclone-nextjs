/**
 * MCP tool execution time budgets and active-request tracking.
 */

import {
  decrementActiveMcpRequests,
  incrementActiveMcpRequests,
} from '@/lib/runtime/workerRuntimeCounters';
import { isBackgroundJobHeapBlocked, backgroundJobBlockedReason } from '@/lib/runtime/backgroundJobGate';

const HEAVY_TOOLS = new Set([
  'bulk_update_records',
  'send_bulk_email',
  'bulk_upload_media',
  'send_batch_outreach',
  'bulk_create_leads',
  'execute_batch_outreach',
]);

const EMAIL_OUTBOUND_TOOLS = new Set([
  'send_email',
  'send_transactional_email',
  'send_outreach_email',
  'reply_to_email',
  'send_project_email',
  'gmail_send_email',
  'microsoft_send_email',
]);

const SOCIAL_PUBLISH_TOOLS = new Set([
  'publish_post',
  'publish_social_post',
  'create_linkedin_post',
  'create_social_post',
  'create_social_post_with_media',
  'create_social_post_with_ai_image',
  'preflight_social_publish',
  'publish_facebook_multi_photo',
  'publish_facebook_photo',
  'publish_facebook_album',
  'publish_facebook_video',
  'publish_instagram_photo',
  'publish_instagram_reel',
  'publish_instagram_carousel',
  'publish_linkedin_image',
  'publish_linkedin_document',
  'publish_x_image',
  'publish_x_video',
  'upload_social_media',
]);

const QUEUED_ONLY_TOOLS = new Set([
  'bulk_update_records',
  'send_bulk_email',
  'bulk_upload_media',
]);

export function isHeavyMcpTool(toolName: string): boolean {
  return HEAVY_TOOLS.has(toolName) || SOCIAL_PUBLISH_TOOLS.has(toolName) || EMAIL_OUTBOUND_TOOLS.has(toolName);
}

export function mustQueueHeavyMcpTool(toolName: string, executing: boolean): boolean {
  if (!executing) return false;
  return QUEUED_ONLY_TOOLS.has(toolName);
}

export async function executeMcpToolWithBudget<T>(
  toolName: string,
  fn: () => Promise<T>
): Promise<T> {
  if (isBackgroundJobHeapBlocked()) {
    throw new Error(
      `Server memory pressure — defer heavy work. ${backgroundJobBlockedReason()}`
    );
  }

  incrementActiveMcpRequests();

  try {
    // Do not impose an application-level wall-clock timeout on MCP execution.
    // Provider/database layers retain their own bounded connection/request guards,
    // and long-running business work should use durable queue/action semantics.
    // The gateway itself must not manufacture a failure merely because work is slow.
    return await fn();
  } finally {
    decrementActiveMcpRequests();
  }
}
