/**
 * Execute queued bulk MCP jobs from mcp_event_queue.
 */

import {
  executeBulkEmail,
  executeBulkUpdateRecords,
  executeBulkUploadMedia,
} from '@/lib/mcp/bulkOperations';
import { toolFromEventName, updateBulkJobProgress, type BulkJobProgress } from '@/lib/mcp/bulkJobQueue';
import { acquireBonnieLock } from '@/lib/cron/distributedLock';

export async function processBulkMcpQueueEvent(params: {
  eventId: string;
  tenantId: string;
  userId: string | null;
  eventName: string;
  payload: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const tool = toolFromEventName(params.eventName);
  if (!tool) {
    throw new Error(`Unsupported bulk MCP event: ${params.eventName}`);
  }
  if (!params.userId) {
    throw new Error('Bulk MCP job missing user_id');
  }

  const lock = await acquireBonnieLock(`bulk-mcp:${params.eventId}`, 900);
  if (!lock.acquired) {
    return { skipped: true, reason: 'lock_held' };
  }

  try {
    const args = (params.payload.args || {}) as Record<string, unknown>;
    const ctx = { tenantId: params.tenantId, userId: params.userId };
    const requested = Number((params.payload.progress as BulkJobProgress | undefined)?.requested || 0);

    await updateBulkJobProgress(params.eventId, {
      requested,
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: requested,
    });

    let output: Record<string, unknown>;

    switch (tool) {
      case 'bulk_update_records':
        output = (await executeBulkUpdateRecords(args as any, ctx)) as Record<string, unknown>;
        break;
      case 'send_bulk_email':
        output = (await executeBulkEmail(args as any, ctx)) as Record<string, unknown>;
        break;
      case 'bulk_upload_media':
        output = (await executeBulkUploadMedia(args as any, ctx)) as Record<string, unknown>;
        break;
      default:
        throw new Error(`Unhandled bulk tool: ${tool}`);
    }

    const succeeded = Number(output.updated_or_sent || 0);
    const failed = Number(output.failed || 0);
    const processed = Number(output.processed ?? succeeded + failed);
    const progress: BulkJobProgress = {
      requested: Number(output.requested || requested),
      processed,
      succeeded,
      failed,
      remaining: Math.max(0, Number(output.requested || requested) - processed),
    };

    await updateBulkJobProgress(params.eventId, progress);

    return {
      tool,
      ...progress,
      output,
    };
  } finally {
    await lock.release();
  }
}
