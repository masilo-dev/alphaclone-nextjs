import { eventBus } from '@/lib/engine/eventBus';
import { clearStatsCacheForTenant } from '@/lib/dashboard/statsCache';

export type CrmDomainEventType =
  | 'crm.lead.created'
  | 'crm.lead.matched'
  | 'crm.contact.updated'
  | 'crm.lead.converted'
  | 'crm.records.merged'
  | 'outreach.sent'
  | 'outreach.skipped'
  | 'campaign.recipient.updated'
  | 'campaign.metrics.updated';

const DASHBOARD_INVALIDATING_EVENTS = new Set<CrmDomainEventType>([
  'crm.lead.created',
  'crm.lead.matched',
  'crm.contact.updated',
  'crm.lead.converted',
  'crm.records.merged',
  'outreach.sent',
  'outreach.skipped',
  'campaign.recipient.updated',
  'campaign.metrics.updated',
]);

export async function emitCrmDomainEvent(params: {
  tenantId: string;
  eventType: CrmDomainEventType;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  actorId?: string;
  actorType?: 'user' | 'system' | 'mcp' | 'cron' | 'agent';
  correlationId?: string;
}): Promise<{ id: string | null }> {
  let eventId: string | null = null;
  try {
    const emitted = await eventBus.emit({
      tenant_id: params.tenantId,
      event_type: params.eventType,
      aggregate_type: params.aggregateType,
      aggregate_id: params.aggregateId,
      payload: params.payload || {},
      actor_type: params.actorType || 'system',
      actor_id: params.actorId,
      correlation_id: params.correlationId,
    });
    eventId = emitted.id || null;
  } catch (err) {
    console.warn('[crmDomainEvents] emit failed:', err);
  }

  if (DASHBOARD_INVALIDATING_EVENTS.has(params.eventType)) {
    clearStatsCacheForTenant(params.tenantId);
  }

  return { id: eventId };
}

/** Server-side: bust in-memory stats cache after CRM mutations. */
export function invalidateServerDashboardCache(tenantId: string): void {
  clearStatsCacheForTenant(tenantId);
}
