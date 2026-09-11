import 'server-only';

import { emitTenantBusinessEvent } from '@/lib/notifications/emitTenantBusinessEvent';
import type { TenantBusinessEventInput } from '@/lib/notifications/eventCatalog';
import { getCanonicalEvent, humanEventLabel } from '@/lib/events/businessEventTaxonomy';

function actionUrlFor(entityType: string): string | undefined {
  switch (entityType) {
    case 'lead':
      return '/dashboard/leads';
    case 'invoice':
      return '/dashboard/business/invoices';
    case 'contract':
      return '/dashboard/business/contracts/manage';
    case 'deal':
    case 'quote':
      return '/dashboard/crm';
    case 'project':
      return '/dashboard/business/projects';
    case 'client':
      return '/dashboard/crm/accounts';
    case 'campaign':
      return '/dashboard/outreach';
    case 'booking':
      return '/dashboard/calendar';
    case 'ticket':
      return '/dashboard/tickets';
    case 'document':
      return '/dashboard/documents';
    default:
      return undefined;
  }
}

function entityIdFromPayload(payload: Record<string, unknown>): string | undefined {
  const value =
    payload.entityId ||
    payload.entity_id ||
    payload.contractId ||
    payload.leadId ||
    payload.invoiceId ||
    payload.campaignId ||
    payload.projectId ||
    payload.clientId ||
    payload.dealId ||
    payload.taskId ||
    payload.ticketId ||
    payload.documentId ||
    payload.id;
  return value ? String(value) : undefined;
}

/**
 * Bridges legacy business_automation_events emitters into tenant notifications.
 */
export async function bridgeAutomationEventToTenantNotification(
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const canonical = getCanonicalEvent(eventType);
  if (!canonical) return;

  const userId = (payload.actorUserId || payload.userId || payload.user_id) as string | undefined;
  const clientName = (payload.clientName || payload.client_name) as string | undefined;
  const entityId = entityIdFromPayload(payload);
  const title = canonical.type === 'campaign.completed'
    ? `Campaign completed${payload.campaignName ? ` — ${payload.campaignName}` : ''}`
    : humanEventLabel(canonical.type);
  const message = String(payload.message || canonical.label);

  await emitTenantBusinessEvent({
    tenantId,
    userId,
    eventType: canonical.type,
    source: (payload.source as TenantBusinessEventInput['source']) || 'user',
    title,
    message,
    actionUrl: actionUrlFor(canonical.entityType),
    clientName,
    projectName: (payload.projectName || payload.name) as string | undefined,
    entityType: canonical.entityType,
    entityId,
    status: payload.status === 'failed' ? 'failed' : 'success',
    communicationIntent: payload.communication_intent === 'send' ? 'send' : 'internal',
    correlationId: (payload.correlation_id || payload.correlationId) as string | undefined,
    metadata: payload,
  }).catch((err) => {
    console.warn('[businessEventBridge]', eventType, err);
  });
}
