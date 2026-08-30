import 'server-only';

import { createHash } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  classifyEventPriority,
  priorityToNotificationLevel,
  shouldEmailForBusinessEvent,
  type TenantBusinessEventInput,
} from './eventCatalog';
import { dispatchBusinessNotification } from './businessNotificationEngine';

function digestWindowKey(date = new Date()): string {
  const hour = date.toISOString().slice(0, 13);
  return hour;
}

function buildIdempotencyKey(input: TenantBusinessEventInput): string {
  const executionId =
    (typeof input.metadata?.execution_id === 'string' && input.metadata.execution_id) ||
    (typeof input.metadata?.idempotency_key === 'string' && input.metadata.idempotency_key) ||
    '';
  const raw = [
    input.tenantId,
    input.eventType,
    input.entityType || '',
    input.entityId || '',
    executionId,
    digestWindowKey(),
    input.title,
  ].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

async function recordDelivery(params: {
  tenantId: string;
  userId?: string;
  eventType: string;
  channel: 'email' | 'in_app' | 'digest_queue';
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  recipient?: string;
  providerMessageId?: string;
  error?: string;
}) {
  if (!params.userId) return;
  try {
    const admin = createSupabaseAdminClient();
    await admin.from('notification_deliveries').insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      channel: params.channel === 'digest_queue' ? 'email' : params.channel === 'in_app' ? 'in_app' : 'email',
      event_type: params.eventType,
      recipient: params.recipient || null,
      status: params.status,
      provider_message_id: params.providerMessageId || null,
      error: params.error || null,
    });
  } catch (err) {
    console.warn('[emitTenantBusinessEvent] delivery log failed:', err);
  }
}

async function queueForDigest(input: TenantBusinessEventInput, idempotencyKey: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('tenant_business_event_inbox').upsert(
    {
      tenant_id: input.tenantId,
      user_id: input.userId || null,
      event_type: input.eventType,
      title: input.title,
      message: input.message,
      action_url: input.actionUrl || null,
      entity_type: input.entityType || null,
      entity_id: input.entityId || null,
      source: input.source || 'system',
      actor: input.actor || null,
      status: input.status || 'success',
      metadata: input.metadata || {},
      idempotency_key: idempotencyKey,
      digest_status: 'pending',
    },
    { onConflict: 'idempotency_key', ignoreDuplicates: true }
  );
  if (error) {
    console.warn('[emitTenantBusinessEvent] digest queue failed:', error.message);
  }
}

/**
 * Central tenant business event emitter.
 * Event → priority → activity log → in-app → email/digest (with idempotency).
 */
export async function emitTenantBusinessEvent(input: TenantBusinessEventInput) {
  const priority = classifyEventPriority(input.eventType, input.status);
  const level = priorityToNotificationLevel(priority, input.status);
  const idempotencyKey = buildIdempotencyKey(input);

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('tenant_business_event_inbox')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing?.id) {
    return { skipped: true, reason: 'duplicate', priority, level };
  }

  const emailNow = shouldEmailForBusinessEvent(
    input.eventType,
    priority,
    input.source,
    input.status,
  );
  const dispatch = await dispatchBusinessNotification({
    tenantId: input.tenantId,
    level: emailNow ? 'level3_urgent_email' : level,
    type: input.eventType,
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl,
    clientName: input.clientName,
    projectName: input.projectName,
    responsibleUserId: input.userId,
    actorName: input.actor || (input.source === 'mcp' ? 'Bonnie / MCP' : 'AlphaClone'),
    relatedRecordId: input.entityId,
    relatedRecordType: input.entityType,
    status: input.status,
    businessContext: input.message,
    technicalDetails: {
      source: input.source,
      ...(input.metadata || {}),
    },
  });

  if (dispatch.inAppCreated) {
    await recordDelivery({
      tenantId: input.tenantId,
      userId: dispatch.recipientUserId,
      eventType: input.eventType,
      channel: 'in_app',
      status: 'sent',
    });
  }

  if (dispatch.emailSent) {
    await recordDelivery({
      tenantId: input.tenantId,
      userId: dispatch.recipientUserId,
      eventType: input.eventType,
      channel: 'email',
      status: 'sent',
      recipient: dispatch.recipientEmail,
    });
  } else if (level === 'level2_digest' || level === 'level1_record_only') {
    await queueForDigest(input, idempotencyKey);
    await recordDelivery({
      tenantId: input.tenantId,
      userId: input.userId,
      eventType: input.eventType,
      channel: 'digest_queue',
      status: 'queued',
    });
  }

  return {
    skipped: false,
    priority,
    level,
    dispatch,
    idempotencyKey,
  };
}
