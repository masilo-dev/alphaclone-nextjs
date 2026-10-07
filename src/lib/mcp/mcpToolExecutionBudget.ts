/**
 * MCP tool execution time budgets and active-request tracking.
 */

import {
  decrementActiveMcpRequests,
  incrementActiveMcpRequests,
} from '@/lib/runtime/workerRuntimeCounters';
import { isBackgroundJobHeapBlocked, backgroundJobBlockedReason } from '@/lib/runtime/backgroundJobGate';

const SYNC_TIMEOUT_MS = Number(process.env.MCP_TOOL_SYNC_TIMEOUT_MS || 60_000);
const HEAVY_SYNC_TIMEOUT_MS = Number(process.env.MCP_TOOL_HEAVY_SYNC_TIMEOUT_MS || 120_000);
const SOCIAL_PUBLISH_TIMEOUT_MS = Number(process.env.MCP_TOOL_SOCIAL_PUBLISH_TIMEOUT_MS || 120_000);
const EMAIL_OUTBOUND_TIMEOUT_MS = Number(process.env.MCP_TOOL_EMAIL_OUTBOUND_TIMEOUT_MS || 90_000);

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

export function resolveMcpToolTimeoutMs(toolName: string): number {
  if (SOCIAL_PUBLISH_TOOLS.has(toolName)) return SOCIAL_PUBLISH_TIMEOUT_MS;
  if (EMAIL_OUTBOUND_TOOLS.has(toolName)) return EMAIL_OUTBOUND_TIMEOUT_MS;
  return HEAVY_TOOLS.has(toolName) ? HEAVY_SYNC_TIMEOUT_MS : SYNC_TIMEOUT_MS;
}

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
  const timeoutMs = resolveMcpToolTimeoutMs(toolName);

  try {
    // Reliability contract: the MCP gateway must not manufacture short 15–45s
    // failures while the underlying operation is still progressing. Long/heavy
    // work should queue at the tool boundary; synchronous work gets a generous
    // safety deadline so platform/proxy requests cannot hang forever.
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        const timer = setTimeout(() => {
          const error = new Error(
            `Tool ${toolName} exceeded its ${timeoutMs}ms execution safety deadline. The operation may still be reconciling; check its durable action status before retrying.`
          ) as Error & { code?: string; retryable?: boolean };
          error.code = 'MCP_EXECUTION_DEADLINE';
          error.retryable = true;
          reject(error);
        }, timeoutMs);
        if (typeof timer.unref === 'function') timer.unref();
      }),
    ]);
  } finally {
    decrementActiveMcpRequests();
  }
}
