/**
 * Checkpoints for safe-point resume.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function saveCheckpoint(params: {
  tenantId: string;
  taskId: string;
  attemptId: string;
  completedStage: string;
  intermediateOutput?: Record<string, unknown>;
  remainingWork?: Record<string, unknown>;
  externalReferences?: Record<string, unknown>;
  cursorState?: Record<string, unknown>;
  resumeToken?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: last } = await admin
    .from('agent_task_checkpoints')
    .select('sequence')
    .eq('attempt_id', params.attemptId)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sequence = (last?.sequence || 0) + 1;
  const { data, error } = await admin
    .from('agent_task_checkpoints')
    .insert({
      tenant_id: params.tenantId,
      task_id: params.taskId,
      attempt_id: params.attemptId,
      sequence,
      completed_stage: params.completedStage,
      intermediate_output: params.intermediateOutput || {},
      remaining_work: params.remainingWork || {},
      external_references: params.externalReferences || {},
      cursor_state: params.cursorState || {},
      resume_token: params.resumeToken || `ckpt_${sequence}`,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getLatestCheckpoint(taskId: string, tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('agent_task_checkpoints')
    .select('*')
    .eq('task_id', taskId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
