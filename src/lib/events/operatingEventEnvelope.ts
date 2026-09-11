import { createHash, randomUUID } from 'node:crypto';
import { normalizeEventType } from '@/lib/events/businessEventTaxonomy';

export type OperatingActorType = 'user' | 'system' | 'mcp' | 'cron' | 'agent' | 'webhook' | 'bonnie';

export type OperatingEventInput = {
  tenantId: string;
  eventType: string;
  actorId?: string | null;
  actorType?: OperatingActorType;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
  idempotencyKey?: string | null;
};

export type OperatingEventEnvelope = {
  event_id: string;
  tenant_id: string;
  actor_id: string | null;
  actor_type: OperatingActorType;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  correlation_id: string;
  causation_id: string | null;
  idempotency_key: string;
};

export function newCorrelationId(): string {
  return randomUUID();
}

export function buildIdempotencyKey(input: OperatingEventInput): string {
  if (input.idempotencyKey) return String(input.idempotencyKey).slice(0, 80);
  const raw = [
    input.tenantId,
    normalizeEventType(input.eventType),
    input.entityType || '',
    input.entityId || '',
    typeof input.payload?.execution_id === 'string' ? input.payload.execution_id : '',
  ].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

export function buildOperatingEventEnvelope(input: OperatingEventInput): OperatingEventEnvelope {
  if (!input.tenantId) {
    throw new Error('Operating events require tenant_id');
  }
  const eventType = normalizeEventType(input.eventType);
  const correlationId = input.correlationId || newCorrelationId();
  const createdAt = new Date().toISOString();
  const eventId = randomUUID();
  const payload = { ...(input.payload || {}) };
  const envelope: OperatingEventEnvelope = {
    event_id: eventId,
    tenant_id: input.tenantId,
    actor_id: input.actorId || null,
    actor_type: input.actorType || 'system',
    event_type: eventType,
    entity_type: input.entityType || null,
    entity_id: input.entityId || null,
    payload,
    created_at: createdAt,
    correlation_id: correlationId,
    causation_id: input.causationId || null,
    idempotency_key: buildIdempotencyKey({ ...input, eventType }),
  };
  payload._envelope = {
    event_id: envelope.event_id,
    correlation_id: envelope.correlation_id,
    causation_id: envelope.causation_id,
    idempotency_key: envelope.idempotency_key,
    actor_id: envelope.actor_id,
    actor_type: envelope.actor_type,
    entity_type: envelope.entity_type,
    entity_id: envelope.entity_id,
  };
  return envelope;
}

export function assertSameTenant(ownerTenantId: string, claimedTenantId: string | null | undefined, label: string): void {
  if (!claimedTenantId || claimedTenantId !== ownerTenantId) {
    throw new Error(`${label} rejected: tenant mismatch`);
  }
}
