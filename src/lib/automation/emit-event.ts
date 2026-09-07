import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildOperatingEventEnvelope, type OperatingActorType } from '@/lib/events/operatingEventEnvelope';
import { getCanonicalEvent, normalizeEventType } from '@/lib/events/businessEventTaxonomy';

function entityFromPayload(eventType: string, payload: Record<string, unknown>): { entityType: string | null; entityId: string | null } {
  const canonical = getCanonicalEvent(eventType);
  const entityType = canonical?.entityType || (payload.entityType as string) || (payload.entity_type as string) || null;
  const entityId = String(
    payload.entityId ||
      payload.entity_id ||
      payload.contractId ||
      payload.leadId ||
      payload.invoiceId ||
      payload.projectId ||
      payload.clientId ||
      payload.dealId ||
      payload.taskId ||
      payload.ticketId ||
      payload.campaignId ||
      payload.documentId ||
      payload.id ||
      '',
  ) || null;
  return { entityType, entityId };
}

/**
 * Canonical business event emitter.
 * Persists a tenant-scoped row, then fans out notifications and chase stops.
 * Workflows are consumed independently by `/api/cron/process-events`.
 */
export async function emitBusinessEvent(
  tenantId: string,
  eventType: string,
  payload: Record<string, any>,
) {
  if (!tenantId) {
    throw new Error('emitBusinessEvent requires tenant_id');
  }

  const canonicalType = normalizeEventType(eventType);
  const { entityType, entityId } = entityFromPayload(canonicalType, payload || {});
  const envelope = buildOperatingEventEnvelope({
    tenantId,
    eventType: canonicalType,
    actorId: payload?.actorUserId || payload?.userId || payload?.user_id || null,
    actorType: (payload?.source as OperatingActorType) || 'system',
    entityType,
    entityId,
    payload: payload || {},
    correlationId: payload?.correlation_id || payload?.correlationId || null,
    causationId: payload?.causation_id || payload?.causationId || null,
    idempotencyKey: payload?.idempotency_key || payload?.idempotencyKey || null,
  });

  const supabase = createSupabaseAdminClient();
  const row = {
    tenant_id: envelope.tenant_id,
    event_type: envelope.event_type,
    payload: envelope.payload,
    processed: false,
    actor_id: envelope.actor_id,
    actor_type: envelope.actor_type,
    entity_type: envelope.entity_type,
    entity_id: envelope.entity_id,
    correlation_id: envelope.correlation_id,
    causation_id: envelope.causation_id,
    idempotency_key: envelope.idempotency_key,
  };

  let insertedId: string | null = null;
  const inserted = await supabase.from('business_automation_events').insert(row).select('id').maybeSingle();
  if (inserted.error?.code === '23505') {
    return { skipped: true, reason: 'duplicate', idempotencyKey: envelope.idempotency_key };
  }
  if (inserted.error && /column|schema cache/i.test(inserted.error.message || '')) {
    const fallback = await supabase.from('business_automation_events').insert({
      tenant_id: envelope.tenant_id,
      event_type: envelope.event_type,
      payload: envelope.payload,
      processed: false,
    }).select('id').maybeSingle();
    if (fallback.error) {
      console.error(`[Automation] Failed to emit event ${eventType} for tenant ${tenantId}:`, fallback.error.message);
      throw fallback.error;
    }
    insertedId = fallback.data?.id || null;
  } else if (inserted.error) {
    console.error(`[Automation] Failed to emit event ${eventType} for tenant ${tenantId}:`, inserted.error.message);
    throw inserted.error;
  } else {
    insertedId = inserted.data?.id || null;
  }

  const { bridgeAutomationEventToTenantNotification } = await import('@/lib/audit/businessEventBridge');
  await bridgeAutomationEventToTenantNotification(tenantId, envelope.event_type, {
    ...envelope.payload,
    actorUserId: envelope.actor_id,
    correlation_id: envelope.correlation_id,
    source_event_id: insertedId || envelope.event_id,
  }).catch((err) => {
    console.warn('[Automation] Tenant notification bridge failed:', err?.message || err);
  });

  const { resolveChasesForDomainEvent } = await import('@/lib/chaser/chaseEventBridge');
  await resolveChasesForDomainEvent({
    tenantId,
    eventType: envelope.event_type,
    entityId: envelope.entity_id,
    entityType: envelope.entity_type,
  }).catch((err) => {
    console.warn('[Automation] Chase stop bridge failed:', err?.message || err);
  });

  return { skipped: false, eventId: insertedId, correlationId: envelope.correlation_id };
}
