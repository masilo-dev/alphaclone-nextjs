/**
 * Durable MCP bulk job queue — backed by mcp_event_queue.
 * HTTP/MCP returns immediately; cron worker executes batches.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type BulkMcpToolName =
  | 'bulk_update_records'
  | 'send_bulk_email'
  | 'bulk_upload_media';

export type BulkJobProgress = {
  requested: number;
  processed: number;
  succeeded: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  remaining: number;
  provider_summary: Record<string, { sent: number; failed: number }>;
  recipient_results: unknown[];
};

export type BulkJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'partially_completed'
  | 'failed';

const BULK_EVENT_PREFIX = 'bulk_mcp:';

function eventNameForTool(tool: BulkMcpToolName): string {
  return `${BULK_EVENT_PREFIX}${tool}`;
}

function toolFromEventName(eventName: string): BulkMcpToolName | null {
  if (!eventName.startsWith(BULK_EVENT_PREFIX)) return null;
  const tool = eventName.slice(BULK_EVENT_PREFIX.length);
  if (tool === 'bulk_update_records' || tool === 'send_bulk_email' || tool === 'bulk_upload_media') {
    return tool;
  }
  return null;
}

function computeRemaining(progress: Partial<BulkJobProgress>): number {
  const requested = Number(progress.requested || 0);
  const processed = Number(progress.processed || 0);
  return Math.max(0, requested - processed);
}

function mapQueueStatus(
  status: string,
  progress: Partial<BulkJobProgress>,
  lastError: string | null
): BulkJobStatus {
  if (status === 'pending') return 'queued';
  if (status === 'processing') return 'processing';
  if (status === 'dead_letter') return 'failed';
  if (status === 'done') {
    const failed = Number(progress.failed || 0);
    const succeeded = Number(progress.succeeded || 0);
    if (failed > 0 && succeeded > 0) return 'partially_completed';
    if (failed > 0 && succeeded === 0) return 'failed';
    return 'completed';
  }
  if (lastError) return 'failed';
  return 'queued';
}

export async function enqueueBulkMcpJob(params: {
  tenantId: string;
  userId: string | null | undefined;
  tool: BulkMcpToolName;
  args: Record<string, unknown>;
  requested: number;
  idempotencyKey?: string | null;
}): Promise<{ jobId: string; requested: number; status: 'queued' }> {
  const admin = createSupabaseAdminClient();
  const progress: BulkJobProgress = {
    requested: params.requested,
    processed: 0,
    succeeded: 0,
    failed: 0,
    remaining: params.requested,
  };

  const row: Record<string, unknown> = {
    tenant_id: params.tenantId,
    user_id: params.userId || null,
    event_name: eventNameForTool(params.tool),
    payload: {
      tool: params.tool,
      args: params.args,
      progress,
    },
    status: 'pending',
    attempts: 0,
    available_at: new Date().toISOString(),
  };

  if (params.idempotencyKey) {
    row.idempotency_key = params.idempotencyKey;
  }

  const { data, error } = await admin
    .from('mcp_event_queue')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    if (params.idempotencyKey && /duplicate|unique/i.test(error.message || '')) {
      const { data: existing, error: lookupError } = await admin
        .from('mcp_event_queue')
        .select('id')
        .eq('tenant_id', params.tenantId)
        .eq('idempotency_key', params.idempotencyKey)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (lookupError) throw new Error(`Failed to resolve existing bulk job: ${lookupError.message}`);
      if (existing?.id) {
        return { jobId: String(existing.id), requested: params.requested, status: 'queued' };
      }
    }
    throw new Error(`Failed to queue bulk job: ${error.message}`);
  }

  return {
    jobId: String(data.id),
    requested: params.requested,
    status: 'queued',
  };
}

export async function getBulkJobStatus(
  tenantId: string,
  jobId: string
): Promise<{
  job_id: string;
  tool: string | null;
  status: BulkJobStatus;
  requested: number;
  processed: number;
  succeeded: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  remaining: number;
  provider_summary: Record<string, { sent: number; failed: number }>;
  recipient_results: unknown[];
  last_error: string | null;
  result: Record<string, unknown> | null;
}> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('mcp_event_queue')
    .select('id, event_name, status, payload, result, last_error')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw new Error(`BULK_JOB_STATUS_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error('BULK_JOB_NOT_FOUND: No bulk MCP job exists for this tenant and job_id.');

  const payload = (data.payload || {}) as Record<string, unknown>;
  const progress = (payload.progress || {}) as Partial<BulkJobProgress>;
  const tool = toolFromEventName(String(data.event_name || '')) || (payload.tool as string | null);

  const requested = Number(progress.requested || 0);
  const processed = Number(progress.processed || 0);
  const succeeded = Number(progress.succeeded ?? (data.result as any)?.succeeded ?? 0);
  const failed = Number(progress.failed ?? (data.result as any)?.failed ?? 0);
  const remaining = computeRemaining({ requested, processed });

  const output = (data.result as Record<string, unknown> | null)?.output as Record<string, unknown> | undefined;
  const recipientResults = Array.isArray(output?.recipients) ? output.recipients : [];
  const skippedResults = Array.isArray(output?.skipped_recipients) ? output.skipped_recipients : [];
  const providerSummary: Record<string, { sent: number; failed: number }> = {};
  for (const row of recipientResults as Array<Record<string, unknown>>) {
    const provider = String(row.provider || 'unknown');
    providerSummary[provider] ||= { sent: 0, failed: 0 };
    if (row.status === 'provider_accepted' || row.status === 'sent') providerSummary[provider].sent += 1;
    if (row.status === 'failed') providerSummary[provider].failed += 1;
  }

  return {
    job_id: String(data.id),
    tool,
    status: mapQueueStatus(String(data.status), { requested, processed, succeeded, failed }, data.last_error),
    requested,
    processed,
    succeeded,
    sent: succeeded,
    failed,
    skipped: Number(output?.skipped || skippedResults.length),
    pending: remaining,
    remaining,
    provider_summary: providerSummary,
    recipient_results: [...recipientResults, ...skippedResults],
    last_error: data.last_error || null,
    result: (data.result as Record<string, unknown>) || null,
  };
}

export async function updateBulkJobProgress(
  jobId: string,
  progress: BulkJobProgress,
  extraPayload?: Record<string, unknown>
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from('mcp_event_queue')
    .select('payload')
    .eq('id', jobId)
    .maybeSingle();

  const payload = (row?.payload || {}) as Record<string, unknown>;
  await admin
    .from('mcp_event_queue')
    .update({
      payload: {
        ...payload,
        ...extraPayload,
        progress: {
          ...progress,
          remaining: computeRemaining(progress),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

export { toolFromEventName, eventNameForTool };
