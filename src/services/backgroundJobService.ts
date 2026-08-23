import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'paused';

export interface BackgroundJobPayload {
  id?: string;
  tenantId: string;
  jobType: string;
  title: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface JobProgressUpdate {
  jobId: string;
  tenantId: string;
  status: JobStatus;
  progressPercent?: number;
  processedCount?: number;
  totalCount?: number;
  errorReason?: string;
  metadata?: Record<string, unknown>;
}

export async function createBackgroundJob(payload: BackgroundJobPayload) {
  const admin = createSupabaseAdminClient();

  if (payload.idempotencyKey) {
    const { data: existing } = await admin
      .from('agent_tasks')
      .select('id, status, metadata')
      .eq('tenant_id', payload.tenantId)
      .eq('idempotency_key', payload.idempotencyKey)
      .maybeSingle();

    if (existing) {
      return existing;
    }
  }

  const { data, error } = await admin
    .from('agent_tasks')
    .insert({
      tenant_id: payload.tenantId,
      task_type: payload.jobType,
      title: payload.title,
      status: 'pending',
      metadata: {
        ...(payload.metadata || {}),
        progress_percent: 0,
        started_at: new Date().toISOString(),
      },
      idempotency_key: payload.idempotencyKey || null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[backgroundJobService] createBackgroundJob failed:', error.message);
    throw error;
  }

  return data;
}

export async function updateBackgroundJobProgress(update: JobProgressUpdate) {
  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    status: update.status,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await admin
    .from('agent_tasks')
    .select('metadata')
    .eq('id', update.jobId)
    .maybeSingle();

  const currentMeta = (existing?.metadata as Record<string, unknown>) || {};
  patch.metadata = {
    ...currentMeta,
    ...(update.metadata || {}),
    progress_percent: update.progressPercent ?? currentMeta.progress_percent ?? 0,
    processed_count: update.processedCount ?? currentMeta.processed_count ?? 0,
    total_count: update.totalCount ?? currentMeta.total_count ?? 0,
    error_reason: update.errorReason || currentMeta.error_reason || null,
    completed_at: update.status === 'completed' || update.status === 'failed' ? new Date().toISOString() : null,
  };

  const { data, error } = await admin
    .from('agent_tasks')
    .update(patch)
    .eq('id', update.jobId)
    .eq('tenant_id', update.tenantId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[backgroundJobService] updateBackgroundJobProgress failed:', error.message);
  }

  return data;
}
