/**
 * Canonical business-operating-system event taxonomy.
 * Underscore aliases (legacy `business_automation_events`) map to dotted types.
 */

export const NOTIFICATION_CATEGORIES = [
  'leads',
  'crm',
  'clients',
  'projects',
  'tasks',
  'invoices',
  'contracts',
  'social',
  'campaigns',
  'bookings',
  'tickets',
  'documents',
  'security',
  'system_health',
  'integrations',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type DeliveryUrgency = 'immediate' | 'in_app' | 'digest';
export type EventRecipientRule = 'owner' | 'assignee' | 'attendee' | 'client' | 'none';

export type CanonicalEventDefinition = {
  type: string;
  aliases: string[];
  category: NotificationCategory;
  urgency: DeliveryUrgency;
  recipients: EventRecipientRule[];
  /** Client/prospect email is allowed only for this event class — never for internal updates. */
  clientEmailAllowed: boolean;
  groupKey: string;
  label: string;
  entityType: string;
  chaseStop?: { entityType: string; outcome: string };
};

function def(
  type: string,
  category: NotificationCategory,
  urgency: DeliveryUrgency,
  extras: Partial<CanonicalEventDefinition> & { label: string; entityType: string },
): CanonicalEventDefinition {
  return {
    type,
    aliases: [type.replace(/\./g, '_')],
    recipients: extras.recipients || (urgency === 'digest' ? ['none'] : ['owner']),
    clientEmailAllowed: extras.clientEmailAllowed ?? false,
    groupKey: extras.groupKey || type,
    chaseStop: extras.chaseStop,
    category,
    urgency,
    label: extras.label,
    entityType: extras.entityType,
  };
}

export const CANONICAL_EVENTS: CanonicalEventDefinition[] = [
  def('lead.created', 'leads', 'in_app', { label: 'Lead added', entityType: 'lead', groupKey: 'lead.created' }),
  def('lead.qualified', 'leads', 'in_app', { label: 'Lead qualified', entityType: 'lead', groupKey: 'lead.qualified' }),
  def('lead.saved', 'leads', 'in_app', { label: 'Lead saved to CRM', entityType: 'lead' }),
  def('lead.contacted', 'leads', 'digest', { label: 'Lead contacted', entityType: 'lead', recipients: ['none'] }),
  def('lead.replied', 'leads', 'immediate', {
    label: 'Lead replied',
    entityType: 'lead',
    chaseStop: { entityType: 'lead', outcome: 'replied' },
  }),
  def('lead.converted', 'leads', 'in_app', {
    label: 'Lead converted',
    entityType: 'lead',
    chaseStop: { entityType: 'lead', outcome: 'converted' },
  }),
  def('lead.hot', 'leads', 'immediate', { label: 'Hot lead', entityType: 'lead' }),
  def('client.created', 'clients', 'in_app', { label: 'New client', entityType: 'client' }),
  def('client.updated', 'clients', 'digest', { label: 'Client updated', entityType: 'client', recipients: ['none'] }),
  def('deal.created', 'crm', 'in_app', { label: 'Deal created', entityType: 'deal' }),
  def('deal.stage_changed', 'crm', 'in_app', { label: 'Deal stage updated', entityType: 'deal' }),
  def('deal.won', 'crm', 'immediate', {
    label: 'Deal won',
    entityType: 'deal',
    chaseStop: { entityType: 'deal', outcome: 'won' },
  }),
  def('deal.lost', 'crm', 'in_app', {
    label: 'Deal lost',
    entityType: 'deal',
    chaseStop: { entityType: 'deal', outcome: 'lost' },
  }),
  def('quote.created', 'crm', 'digest', { label: 'Quote created', entityType: 'quote', recipients: ['none'] }),
  def('quote.sent', 'crm', 'in_app', { label: 'Quote sent', entityType: 'quote', clientEmailAllowed: true }),
  def('quote.accepted', 'crm', 'immediate', {
    label: 'Quote accepted',
    entityType: 'quote',
    chaseStop: { entityType: 'quote', outcome: 'accepted' },
  }),
  def('quote.rejected', 'crm', 'in_app', {
    label: 'Quote rejected',
    entityType: 'quote',
    chaseStop: { entityType: 'quote', outcome: 'rejected' },
  }),
  def('contract.created', 'contracts', 'digest', { label: 'Contract created', entityType: 'contract', recipients: ['none'] }),
  def('contract.approved', 'contracts', 'in_app', { label: 'Contract approved', entityType: 'contract' }),
  def('contract.sent', 'contracts', 'in_app', { label: 'Contract sent', entityType: 'contract', clientEmailAllowed: true }),
  def('contract.viewed', 'contracts', 'in_app', { label: 'Contract viewed', entityType: 'contract' }),
  def('contract.signed', 'contracts', 'immediate', {
    label: 'Contract signed',
    entityType: 'contract',
    chaseStop: { entityType: 'contract', outcome: 'signed' },
  }),
  def('contract.expiring', 'contracts', 'immediate', { label: 'Contract expiring', entityType: 'contract' }),
  def('contract.expired', 'contracts', 'in_app', {
    label: 'Contract expired',
    entityType: 'contract',
    chaseStop: { entityType: 'contract', outcome: 'expired' },
  }),
  def('invoice.created', 'invoices', 'digest', { label: 'Invoice created', entityType: 'invoice', recipients: ['none'] }),
  def('invoice.sent', 'invoices', 'in_app', { label: 'Invoice sent', entityType: 'invoice', clientEmailAllowed: true }),
  def('invoice.overdue', 'invoices', 'immediate', { label: 'Invoice overdue', entityType: 'invoice' }),
  def('invoice.paid', 'invoices', 'immediate', {
    label: 'Payment received',
    entityType: 'invoice',
    chaseStop: { entityType: 'invoice', outcome: 'paid' },
  }),
  def('project.created', 'projects', 'in_app', { label: 'Project created', entityType: 'project' }),
  def('project.status_changed', 'projects', 'digest', {
    label: 'Project status updated',
    entityType: 'project',
    recipients: ['none'],
  }),
  def('project.completed', 'projects', 'in_app', {
    label: 'Project completed',
    entityType: 'project',
    chaseStop: { entityType: 'project', outcome: 'completed' },
  }),
  def('task.created', 'tasks', 'digest', { label: 'Task created', entityType: 'task', recipients: ['none'] }),
  def('task.assigned', 'tasks', 'in_app', { label: 'Task assigned', entityType: 'task', recipients: ['assignee'] }),
  def('task.overdue', 'tasks', 'immediate', { label: 'Task overdue', entityType: 'task', recipients: ['assignee', 'owner'] }),
  def('task.completed', 'tasks', 'digest', {
    label: 'Task completed',
    entityType: 'task',
    recipients: ['none'],
    chaseStop: { entityType: 'task', outcome: 'completed' },
  }),
  def('campaign.created', 'campaigns', 'digest', { label: 'Campaign created', entityType: 'campaign', recipients: ['none'] }),
  def('campaign.started', 'campaigns', 'in_app', { label: 'Campaign started', entityType: 'campaign' }),
  def('campaign.completed', 'campaigns', 'in_app', {
    label: 'Campaign completed',
    entityType: 'campaign',
    groupKey: 'campaign.completed',
    chaseStop: { entityType: 'campaign', outcome: 'completed' },
  }),
  def('campaign.failed', 'campaigns', 'immediate', { label: 'Campaign failed', entityType: 'campaign' }),
  def('social.post_published', 'social', 'in_app', {
    label: 'Social post published',
    entityType: 'social_post',
    chaseStop: { entityType: 'social_account', outcome: 'published' },
  }),
  def('social.post_failed', 'social', 'immediate', { label: 'Social post failed', entityType: 'social_post' }),
  def('booking.created', 'bookings', 'immediate', {
    label: 'Booking created',
    entityType: 'booking',
    recipients: ['owner', 'attendee'],
    clientEmailAllowed: true,
  }),
  def('booking.cancelled', 'bookings', 'immediate', {
    label: 'Booking cancelled',
    entityType: 'booking',
    recipients: ['owner', 'attendee'],
    clientEmailAllowed: true,
  }),
  def('booking.completed', 'bookings', 'digest', { label: 'Booking completed', entityType: 'booking', recipients: ['none'] }),
  def('ticket.created', 'tickets', 'in_app', { label: 'Ticket created', entityType: 'ticket', recipients: ['assignee', 'owner'] }),
  def('ticket.escalated', 'tickets', 'immediate', { label: 'Ticket escalated', entityType: 'ticket' }),
  def('ticket.resolved', 'tickets', 'in_app', { label: 'Ticket resolved', entityType: 'ticket' }),
  def('document.created', 'documents', 'digest', { label: 'Document created', entityType: 'document', recipients: ['none'] }),
  def('document.shared', 'documents', 'in_app', {
    label: 'Document shared',
    entityType: 'document',
    recipients: ['assignee'],
    clientEmailAllowed: true,
  }),
  def('document.approved', 'documents', 'in_app', { label: 'Document approved', entityType: 'document' }),
  def('document.expiring', 'documents', 'in_app', { label: 'Document expiring', entityType: 'document' }),
  def('integration.connected', 'integrations', 'in_app', { label: 'Integration connected', entityType: 'integration' }),
  def('integration.disconnected', 'integrations', 'immediate', { label: 'Integration disconnected', entityType: 'integration' }),
  def('integration.auth_failed', 'integrations', 'immediate', { label: 'Integration authentication failed', entityType: 'integration' }),
  def('workflow.started', 'system_health', 'digest', { label: 'Workflow started', entityType: 'workflow', recipients: ['none'] }),
  def('workflow.completed', 'system_health', 'digest', { label: 'Workflow completed', entityType: 'workflow', recipients: ['none'] }),
  def('workflow.failed', 'system_health', 'immediate', { label: 'Workflow failed', entityType: 'workflow' }),
  def('security.event', 'security', 'immediate', { label: 'Security event', entityType: 'security' }),
];

const EXTRA_ALIASES: Record<string, string> = {
  lead_created: 'lead.created',
  form_submitted: 'lead.created',
  invoice_created: 'invoice.created',
  invoice_paid: 'invoice.paid',
  payment_received: 'invoice.paid',
  invoice_overdue: 'invoice.overdue',
  contract_signed: 'contract.signed',
  deal_stage_changed: 'deal.stage_changed',
  campaign_completed: 'campaign.completed',
  campaign_finished: 'campaign.completed',
  project_created: 'project.created',
  client_created: 'client.created',
  crm_client_created: 'client.created',
  clients_imported: 'client.created',
  task_created: 'task.created',
  task_overdue: 'task.overdue',
  task_completed: 'task.completed',
  ticket_created: 'ticket.created',
  social_post_published: 'social.post_published',
  'social.post.published': 'social.post_published',
  lead_replied: 'lead.replied',
  email_received: 'lead.replied',
  quote_accepted: 'quote.accepted',
  quote_rejected: 'quote.rejected',
  payment_failed: 'invoice.overdue',
};

const byType = new Map<string, CanonicalEventDefinition>();
for (const event of CANONICAL_EVENTS) {
  byType.set(event.type, event);
  for (const alias of event.aliases) byType.set(alias, event);
}
for (const [alias, canonical] of Object.entries(EXTRA_ALIASES)) {
  const defn = byType.get(canonical);
  if (defn) byType.set(alias, defn);
}

export function normalizeEventType(eventType: string): string {
  const raw = String(eventType || '').trim();
  const mapped = byType.get(raw) || byType.get(raw.replace(/_/g, '.'));
  return mapped?.type || (raw.includes('.') ? raw : raw.replace(/_/g, '.'));
}

export function getCanonicalEvent(eventType: string): CanonicalEventDefinition | null {
  return byType.get(String(eventType || '').trim()) || byType.get(normalizeEventType(eventType)) || null;
}

export function dispatcherEventKey(eventType: string): string {
  return normalizeEventType(eventType).replace(/\./g, '_');
}

export function eventCategory(eventType: string): NotificationCategory {
  return getCanonicalEvent(eventType)?.category || inferCategory(eventType);
}

export function eventUrgency(eventType: string, status?: string): DeliveryUrgency {
  if (status === 'failed' || /failed|overdue|disconnected|auth_failed|security/i.test(eventType)) {
    return 'immediate';
  }
  return getCanonicalEvent(eventType)?.urgency || 'digest';
}

export function humanEventLabel(eventType: string): string {
  return getCanonicalEvent(eventType)?.label || String(eventType || 'Update').replace(/[._]/g, ' ');
}

export function allowsClientEmail(eventType: string): boolean {
  return Boolean(getCanonicalEvent(eventType)?.clientEmailAllowed);
}

export function chaseStopForEvent(eventType: string): { entityType: string; outcome: string } | null {
  return getCanonicalEvent(eventType)?.chaseStop || null;
}

export function notificationGroupKey(eventType: string): string {
  return getCanonicalEvent(eventType)?.groupKey || normalizeEventType(eventType);
}

function inferCategory(eventType: string): NotificationCategory {
  const t = eventType.toLowerCase();
  if (t.startsWith('lead')) return 'leads';
  if (t.startsWith('client')) return 'clients';
  if (t.startsWith('deal') || t.startsWith('crm') || t.startsWith('quote') || t.startsWith('contact')) return 'crm';
  if (t.startsWith('project')) return 'projects';
  if (t.startsWith('task')) return 'tasks';
  if (t.startsWith('invoice') || t.startsWith('payment')) return 'invoices';
  if (t.startsWith('contract')) return 'contracts';
  if (t.startsWith('social')) return 'social';
  if (t.startsWith('campaign') || t.startsWith('email')) return 'campaigns';
  if (t.startsWith('booking') || t.startsWith('meeting')) return 'bookings';
  if (t.startsWith('ticket')) return 'tickets';
  if (t.startsWith('document')) return 'documents';
  if (t.startsWith('security') || t.startsWith('auth')) return 'security';
  if (t.startsWith('integration') || t.startsWith('oauth')) return 'integrations';
  return 'system_health';
}
