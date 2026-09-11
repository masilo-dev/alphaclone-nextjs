/**
 * Unified Trigger Gateway
 * Standardizes incoming API, webhook, timer, CRM, social, and domain event triggers
 * into a canonical trigger envelope and enqueues/creates durable runs on the agent_tasks DAG engine.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createRunForObjective } from './goalRunService';
import { insertOutboxEvent } from './outboxService';
import { createHash } from 'crypto';

export type TriggerType =
  | 'api_request'
  | 'ui_action'
  | 'domain_event'
  | 'webhook'
  | 'timer'
  | 'scheduled_workflow'
  | 'agent_delegation'
  | 'human_approval'
  | 'crm_change'
  | 'incoming_email';

export type NormalizedTriggerEnvelope = {
  tenant_id: string;
  user_id?: string | null;
  trigger_type: TriggerType;
  event_type: string;
  source: string;
  correlation_id: string;
  deduplication_key: string;
  payload: Record<string, unknown>;
  created_at?: string;
};

export function buildDeduplicationKey(tenantId: string, eventType: string, sourceId: string): string {
  return createHash('sha256')
    .update(`${tenantId}:${eventType}:${sourceId}`)
    .digest('hex');
}

export async function processNormalizedTrigger(envelope: NormalizedTriggerEnvelope): Promise<{
  runId?: string;
  deduplicated?: boolean;
  success: boolean;
}> {
  const admin = createSupabaseAdminClient();
  const correlationId = envelope.correlation_id || `trig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const deduplicationKey = envelope.deduplication_key || buildDeduplicationKey(envelope.tenant_id, envelope.event_type, JSON.stringify(envelope.payload));

  // Check inbox for duplicate event processing
  const { data: existingInbox } = await admin
    .from('agent_event_inbox')
    .select('id, run_id')
    .eq('tenant_id', envelope.tenant_id)
    .eq('deduplication_key', deduplicationKey)
    .maybeSingle();

  if (existingInbox) {
    console.log(`[TriggerGateway] Deduplicated trigger key: ${deduplicationKey}`);
    return { runId: existingInbox.run_id || undefined, deduplicated: true, success: true };
  }

  // Determine objective and create durable run
  const objective = `Execute trigger [${envelope.event_type}] from ${envelope.source}: ${JSON.stringify(envelope.payload).slice(0, 200)}`;

  const runResult = await createRunForObjective({
    tenantId: envelope.tenant_id,
    userId: envelope.user_id || null,
    objective,
    executionMode: 'autonomous',
    successCriteria: { trigger: envelope.event_type, payload: envelope.payload },
    seedGraph: true,
  });

  // Record in agent_event_inbox
  try {
    await admin.from('agent_event_inbox').insert({
      tenant_id: envelope.tenant_id,
      event_type: envelope.event_type,
      entity_type: envelope.trigger_type,
      entity_id: correlationId,
      deduplication_key: deduplicationKey,
      run_id: runResult.run.id,
      payload: envelope.payload,
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    });
  } catch {
    // Ignore inbox insertion failure
  }

  // Emit event outbox for reactive consumers
  await insertOutboxEvent({
    tenantId: envelope.tenant_id,
    eventType: `trigger.${envelope.event_type}`,
    payload: {
      run_id: runResult.run.id,
      trigger_type: envelope.trigger_type,
      event_type: envelope.event_type,
      correlation_id: correlationId,
      payload: envelope.payload,
    },
    correlationId,
  });

  return { runId: runResult.run.id, deduplicated: false, success: true };
}
