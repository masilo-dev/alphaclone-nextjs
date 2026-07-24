/**
 * Transactional outbox — thin payloads only.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ThinQueuePayload } from './types';
import { backoffWithJitter } from './utils';

export async function insertOutboxEvent(params: {
  tenantId: string;
  eventType: string;
  payload: ThinQueuePayload | Record<string, unknown>;
  correlationId?: string | null;
  eventVersion?: number;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('agent_event_outbox')
    .insert({
      tenant_id: params.tenantId,
      event_type: params.eventType,
      event_version: params.eventVersion || 1,
      payload: params.payload,
      correlation_id: params.correlationId || null,
      delivery_status: 'pending',
      next_attempt_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) {
    console.warn('[outbox] insert failed:', error.message);
    return null;
  }
  return data?.id as string;
}

/**
 * Deliver pending outbox rows. For task.ready: mark task QUEUED if still READY.
 */
export async function publishOutboxBatch(limit = 50): Promise<{
  delivered: number;
  failed: number;
  deadLetter: number;
}> {
  const admin = createSupabaseAdminClient();
  const workerId = `outbox-${process.pid}-${Date.now()}`;
  const now = new Date().toISOString();

  const { data: rows } = await admin
    .from('agent_event_outbox')
    .select('*')
    .in('delivery_status', ['pending', 'failed'])
    .lte('next_attempt_at', now)
    .order('created_at', { ascending: true })
    .limit(limit);

  let delivered = 0;
  let failed = 0;
  let deadLetter = 0;

  for (const row of rows || []) {
    const locked = await admin
      .from('agent_event_outbox')
      .update({
        delivery_status: 'delivering',
        locked_by: workerId,
        locked_at: now,
        delivery_attempts: (row.delivery_attempts || 0) + 1,
      })
      .eq('id', row.id)
      .in('delivery_status', ['pending', 'failed'])
      .select('id')
      .maybeSingle();

    if (!locked.data) continue;

    try {
      const payload = (row.payload || {}) as ThinQueuePayload;
      if (row.event_type === 'task.ready' && payload.task_id) {
        const { data: task } = await admin
          .from('agent_tasks')
          .select('id, status, version')
          .eq('id', payload.task_id)
          .eq('tenant_id', row.tenant_id)
          .maybeSingle();

        if (task?.status === 'READY') {
          await admin
            .from('agent_tasks')
            .update({
              status: 'QUEUED',
              version: (task.version || 1) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id)
            .eq('version', task.version)
            .eq('status', 'READY');
        }
      }

      await admin
        .from('agent_event_outbox')
        .update({
          delivery_status: 'delivered',
          delivered_at: new Date().toISOString(),
          locked_by: null,
          locked_at: null,
          last_error: null,
        })
        .eq('id', row.id);
      delivered += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = (row.delivery_attempts || 0) + 1;
      if (attempts >= 8) {
        await admin
          .from('agent_event_outbox')
          .update({
            delivery_status: 'dead_letter',
            last_error: message,
            locked_by: null,
            locked_at: null,
          })
          .eq('id', row.id);
        deadLetter += 1;
      } else {
        await admin
          .from('agent_event_outbox')
          .update({
            delivery_status: 'failed',
            last_error: message,
            next_attempt_at: new Date(Date.now() + backoffWithJitter(attempts)).toISOString(),
            locked_by: null,
            locked_at: null,
          })
          .eq('id', row.id);
        failed += 1;
      }
    }
  }

  return { delivered, failed, deadLetter };
}
