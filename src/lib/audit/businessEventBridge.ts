import 'server-only';

import { emitTenantBusinessEvent } from '@/lib/notifications/emitTenantBusinessEvent';
import type { TenantBusinessEventInput } from '@/lib/notifications/eventCatalog';
import { recordBusinessActivity } from '@/lib/audit/businessAuditEngine';

const EVENT_MAP: Record<string, { eventType: string; title: (p: Record<string, unknown>) => string; message: (p: Record<string, unknown>) => string; actionUrl?: string }> = {
  contract_signed: {
    eventType: 'contract.signed',
    title: (p) => `Contract signed — ${p.title || 'Agreement'}`,
    message: (p) => `${p.clientName || 'Client'} signed the contract.`,
    actionUrl: '/dashboard/business/contracts/manage',
  },
  lead_created: {
    eventType: 'lead.created',
    title: () => 'New lead added',
    message: (p) => `Lead ${p.email || p.name || ''} was added to your CRM.`,
    actionUrl: '/dashboard/leads',
  },
  invoice_created: {
    eventType: 'invoice.created',
    title: (p) => `Invoice created${p.invoiceNumber ? ` #${p.invoiceNumber}` : ''}`,
    message: (p) => `Invoice for ${p.clientName || 'client'}.`,
    actionUrl: '/dashboard/business/invoices',
  },
  deal_stage_changed: {
    eventType: 'deal.stage_changed',
    title: () => 'Deal stage updated',
    message: (p) => `Deal moved to ${p.stage || 'new stage'}.`,
    actionUrl: '/dashboard/crm',
  },
  invoice_paid: {
    eventType: 'invoice.paid',
    title: (p) => `Invoice paid${p.invoiceNumber ? ` #${p.invoiceNumber}` : ''}`,
    message: (p) => `Payment received${p.clientName ? ` from ${p.clientName}` : ''}.`,
    actionUrl: '/dashboard/business/invoices',
  },
  campaign_completed: {
    eventType: 'campaign.completed',
    title: (p) => `Campaign completed — ${p.campaignName || 'Outreach'}`,
    message: (p) => `${p.totalSent ?? 0} emails sent${p.totalFailed ? ` (${p.totalFailed} failed)` : ''}.`,
    actionUrl: '/dashboard/outreach',
  },
  form_submitted: {
    eventType: 'lead.created',
    title: () => 'Form submission received',
    message: (p) => `New inquiry from ${p.email || 'prospect'}.`,
    actionUrl: '/dashboard/leads',
  },
  project_created: {
    eventType: 'project.created',
    title: (p) => `Project created — ${p.projectName || p.name || 'New project'}`,
    message: (p) => `Project "${p.projectName || p.name || 'New project'}" was added to your workspace.`,
    actionUrl: '/dashboard/business/projects',
  },
  client_created: {
    eventType: 'crm.client_created',
    title: (p) => `Client added — ${p.clientName || p.name || 'New client'}`,
    message: (p) => `${p.clientName || p.name || 'A new client'} is now in your CRM.`,
    actionUrl: '/dashboard/crm/accounts',
  },
  clients_imported: {
    eventType: 'crm.clients_imported',
    title: (p) => `${Number(p.count) || 'Multiple'} clients imported`,
    message: (p) => `${Number(p.count) || 'Several'} client record(s) were imported into your workspace.`,
    actionUrl: '/dashboard/crm/accounts',
  },
};

/**
 * Bridges legacy business_automation_events emitters into tenant notifications + business activity.
 */
export async function bridgeAutomationEventToTenantNotification(
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const mapping = EVENT_MAP[eventType];
  if (!mapping) return;

  const userId = (payload.actorUserId || payload.userId || payload.user_id) as string | undefined;
  const clientName = (payload.clientName || payload.client_name) as string | undefined;

  await recordBusinessActivity({
    tenantId,
    event: mapping.title(payload),
    actor: (payload.source_agent as string) || 'System',
    client: clientName,
    businessContext: mapping.message(payload),
    relatedRecordType: mapping.eventType.split('.')[0],
    relatedRecordId: (payload.contractId || payload.leadId || payload.invoiceId || payload.id) as string | undefined,
    result: mapping.message(payload),
    status: 'success',
    technicalDetails: { source: 'automation_bridge', automation_event: eventType, ...payload },
  }).catch(() => undefined);

  await emitTenantBusinessEvent({
    tenantId,
    userId,
    eventType: mapping.eventType,
    source: (payload.source as TenantBusinessEventInput['source']) || 'user',
    title: mapping.title(payload),
    message: mapping.message(payload),
    actionUrl: mapping.actionUrl,
    clientName,
    projectName: (payload.projectName || payload.name) as string | undefined,
    entityType: mapping.eventType.split('.')[0],
    entityId: (payload.contractId || payload.leadId || payload.invoiceId || payload.campaignId || payload.projectId || payload.clientId) as string | undefined,
    status: 'success',
    metadata: payload,
  }).catch((err) => {
    console.warn('[businessEventBridge]', eventType, err);
  });
}
