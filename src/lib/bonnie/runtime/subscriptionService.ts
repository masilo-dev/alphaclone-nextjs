/**
 * Durable event subscriptions for waiting tasks.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function createEventSubscription(params: {
  tenantId: string;
  workspaceId?: string | null;
  runId: string;
  waitingTaskId: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  matchConditions?: Record<string, unknown>;
  expiresAt?: string | null;
  timeoutBehavior?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('agent_event_subscriptions')
    .insert({
      tenant_id: params.tenantId,
      workspace_id: params.workspaceId || null,
      waiting_task_id: params.waitingTaskId,
      run_id: params.runId,
      event_type: params.eventType,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      match_conditions: params.matchConditions || {},
      status: 'active',
      expires_at: params.expiresAt || null,
      timeout_behavior: params.timeoutBehavior || { action: 'escalate' },
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}
