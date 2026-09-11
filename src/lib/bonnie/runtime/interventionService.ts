/**
 * Intervention / dead-letter inbox.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function openIntervention(params: {
  tenantId: string;
  runId?: string | null;
  taskId?: string | null;
  category: string;
  title: string;
  detail?: string;
  suggestedResolution?: string;
  attemptHistory?: unknown[];
  lastCheckpoint?: Record<string, unknown> | null;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('agent_interventions')
    .insert({
      tenant_id: params.tenantId,
      run_id: params.runId || null,
      task_id: params.taskId || null,
      category: params.category,
      title: params.title,
      detail: params.detail || null,
      suggested_resolution: params.suggestedResolution || null,
      attempt_history: params.attemptHistory || [],
      last_checkpoint: params.lastCheckpoint || null,
      status: 'open',
    })
    .select('*')
    .single();
  if (error) {
    console.warn('[intervention] open failed:', error.message);
    return null;
  }
  return data;
}

export async function listInterventions(tenantId: string, status: string = 'open') {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('agent_interventions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50);
  return data || [];
}
