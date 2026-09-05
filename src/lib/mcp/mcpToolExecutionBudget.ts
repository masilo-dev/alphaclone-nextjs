/**
 * MCP tool execution time budgets and active-request tracking.
 */

import {
  decrementActiveMcpRequests,
  incrementActiveMcpRequests,
} from '@/lib/runtime/workerRuntimeCounters';
import { isBackgroundJobHeapBlocked, backgroundJobBlockedReason } from '@/lib/runtime/backgroundJobGate';

const SYNC_TIMEOUT_MS = Number(process.env.MCP_TOOL_SYNC_TIMEOUT_MS || 15_000);
const HEAVY_SYNC_TIMEOUT_MS = Number(process.env.MCP_TOOL_HEAVY_SYNC_TIMEOUT_MS || 25_000);
const SOCIAL_PUBLISH_TIMEOUT_MS = Number(process.env.MCP_TOOL_SOCIAL_PUBLISH_TIMEOUT_MS || 45_000);

const HEAVY_TOOLS = new Set([
  'bulk_update_records',
  'send_bulk_email',
  'bulk_upload_media',
  'send_batch_outreach',
  'bulk_create_leads',
  'execute_batch_outreach',
]);

const SOCIAL_PUBLISH_TOOLS = new Set([
  'publish_post',
  'publish_social_post',
  'create_linkedin_post',
  'create_social_post',
  'create_social_post_with_media',
  'preflight_social_publish',
  'publish_facebook_multi_photo',
  'publish_facebook_photo',
  'publish_facebook_video',
  'publish_linkedin_image',
  'publish_linkedin_document',
  'upload_social_media',
]);

const QUEUED_ONLY_TOOLS = new Set([
  'bulk_update_records',
  'send_bulk_email',
  'bulk_upload_media',
]);

export function resolveMcpToolTimeoutMs(toolName: string): number {
  if (SOCIAL_PUBLISH_TOOLS.has(toolName)) return SOCIAL_PUBLISH_TIMEOUT_MS;
  return HEAVY_TOOLS.has(toolName) ? HEAVY_SYNC_TIMEOUT_MS : SYNC_TIMEOUT_MS;
}

export function isHeavyMcpTool(toolName: string): boolean {
  return HEAVY_TOOLS.has(toolName) || SOCIAL_PUBLISH_TOOLS.has(toolName);
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
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        if (typeof timer.unref === 'function') timer.unref();
      }),
    ]);
  } finally {
    decrementActiveMcpRequests();
  }
}
