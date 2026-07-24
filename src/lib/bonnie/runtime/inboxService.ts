/**
 * Event inbox — persist-first inbound events with duplicate protection.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { insertOutboxEvent } from './outboxService';
import { transitionTask } from './transitionService';

export async function persistInboxEvent(params: {
  tenantId: string;
  workspaceId?: string | null;
  providerEventId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  signatureVerified?: boolean;
  correlationId?: string | null;
}): Promise<{ id: string; duplicate: boolean }> {
  const admin = createSupabaseAdminClient();

  if (params.providerEventId) {
    const { data: existing } = await admin
      .from('agent_event_inbox')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('provider_event_id', params.providerEventId)
      .maybeSingle();
    if (existing) {
      return { id: existing.id, duplicate: true };
    }
  }

  const { data, error } = await admin
    .from('agent_event_inbox')
    .insert({
      tenant_id: params.tenantId,
      workspace_id: params.workspaceId || null,
      provider_event_id: params.providerEventId || null,
      event_type: params.eventType,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      payload: params.payload || {},
      signature_verified: params.signatureVerified === true,
      processing_status: 'pending',
      correlation_id: params.correlationId || null,
    })
    .select('id')
    .single();

  if (error) {
    // Unique violation = duplicate
    if (/duplicate|unique/i.test(error.message) && params.providerEventId) {
      const { data: again } = await admin
        .from('agent_event_inbox')
        .select('id')
        .eq('tenant_id', params.tenantId)
        .eq('provider_event_id', params.providerEventId)
        .maybeSingle();
      if (again) return { id: again.id, duplicate: true };
    }
    throw new Error(error.message);
  }

  return { id: data.id as string, duplicate: false };
}

/**
 * Match active subscriptions and wake waiting tasks (idempotent).
 */
export async function processInboxEvent(eventId: string, tenantId: string): Promise<{
  woken: number;
}> {
  const admin = createSupabaseAdminClient();
  const { data: event } = await admin
    .from('agent_event_inbox')
    .select('*')
    .eq('id', eventId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!event || event.processing_status === 'processed') {
    return { woken: 0 };
  }

  await admin
    .from('agent_event_inbox')
    .update({ processing_status: 'processing' })
    .eq('id', eventId)
    .eq('processing_status', 'pending');

  let q = admin
    .from('agent_event_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('event_type', event.event_type)
    .eq('status', 'active');

  if (event.entity_id) {
    q = q.or(`entity_id.is.null,entity_id.eq.${event.entity_id}`);
  }

  const { data: subs } = await q.limit(50);
  let woken = 0;

  for (const sub of subs || []) {
    const lock = await admin
      .from('agent_event_subscriptions')
      .update({
        status: 'satisfied',
        satisfied_at: new Date().toISOString(),
        satisfied_by_event_id: eventId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();

    if (!lock.data) continue;

    try {
      await transitionTask({
        tenantId,
        taskId: sub.waiting_task_id,
        to: 'READY',
        trigger: 'event_wake',
        actorType: 'system',
        actorId: 'inbox',
        reason: `Event ${event.event_type} matched subscription`,
        relatedEventId: eventId,
        metadata: { subscriptionId: sub.id },
      });

      const { data: task } = await admin
        .from('agent_tasks')
        .select('id, run_id, correlation_id')
        .eq('id', sub.waiting_task_id)
        .maybeSingle();

      if (task) {
        await insertOutboxEvent({
          tenantId,
          eventType: 'task.ready',
          payload: {
            task_id: task.id,
            run_id: task.run_id,
            tenant_id: tenantId,
            correlation_id: task.correlation_id,
          },
          correlationId: task.correlation_id,
        });
      }
      woken += 1;
    } catch (err) {
      console.warn('[inbox] wake failed:', err);
    }
  }

  await admin
    .from('agent_event_inbox')
    .update({
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  return { woken };
}

export async function processPendingInbox(limit = 40) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('agent_event_inbox')
    .select('id, tenant_id')
    .eq('processing_status', 'pending')
    .order('received_at', { ascending: true })
    .limit(limit);

  let woken = 0;
  for (const row of data || []) {
    const r = await processInboxEvent(row.id, row.tenant_id);
    woken += r.woken;
  }
  return { processed: (data || []).length, woken };
}
