/**
 * Validated state transitions with OCC + audit trail.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { assertTransition, canTransition } from './taskStateMachine';
import type { TaskStatus } from './types';

export async function transitionTask(params: {
  tenantId: string;
  taskId: string;
  to: TaskStatus;
  trigger: string;
  actorType?: string;
  actorId?: string;
  reason?: string;
  relatedEventId?: string | null;
  relatedAttemptId?: string | null;
  expectedVersion?: number;
  metadata?: Record<string, unknown>;
  patch?: Record<string, unknown>;
}): Promise<{ ok: boolean; version?: number; error?: string; previous?: TaskStatus }> {
  const admin = createSupabaseAdminClient();
  const { data: task } = await admin
    .from('agent_tasks')
    .select('id, status, version')
    .eq('id', params.taskId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (!task) return { ok: false, error: 'not_found' };

  const from = task.status as TaskStatus;
  if (!canTransition(from, params.to)) {
    return { ok: false, error: `illegal_transition:${from}->${params.to}`, previous: from };
  }

  if (params.expectedVersion != null && params.expectedVersion !== task.version) {
    return { ok: false, error: 'version_conflict', previous: from };
  }

  assertTransition(from, params.to);

  const nextVersion = (task.version || 1) + 1;
  const { data: updated, error } = await admin
    .from('agent_tasks')
    .update({
      status: params.to,
      version: nextVersion,
      updated_at: new Date().toISOString(),
      ...(params.patch || {}),
    })
    .eq('id', params.taskId)
    .eq('tenant_id', params.tenantId)
    .eq('version', task.version)
    .select('id, version')
    .maybeSingle();

  if (error || !updated) {
    return { ok: false, error: error?.message || 'version_conflict', previous: from };
  }

  await admin.from('agent_state_transitions').insert({
    tenant_id: params.tenantId,
    entity_type: 'task',
    entity_id: params.taskId,
    previous_state: from,
    new_state: params.to,
    trigger: params.trigger,
    actor_type: params.actorType || 'system',
    actor_id: params.actorId || null,
    reason: params.reason || null,
    related_event_id: params.relatedEventId || null,
    related_attempt_id: params.relatedAttemptId || null,
    expected_version: task.version,
    metadata: params.metadata || {},
  });

  return { ok: true, version: nextVersion, previous: from };
}
