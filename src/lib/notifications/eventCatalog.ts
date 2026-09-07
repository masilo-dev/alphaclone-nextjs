import type { NotificationLevel } from './businessNotificationEngine';
import { eventUrgency, normalizeEventType } from '@/lib/events/businessEventTaxonomy';

export type EventPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type TenantBusinessEventInput = {
  eventType: string;
  tenantId: string;
  userId?: string;
  actor?: string;
  source?: 'mcp' | 'bonnie' | 'cron' | 'webhook' | 'user' | 'system';
  title: string;
  message: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  clientName?: string;
  projectName?: string;
  status?: 'success' | 'failed' | 'waiting' | 'blocked' | 'at_risk' | 'pending_approval';
  metadata?: Record<string, unknown>;
  correlationId?: string;
  communicationIntent?: 'internal' | 'send';
};

const IMMEDIATE_EMAIL_PATTERNS = [
  /^security\./,
  /^integration\.(disconnected|failed|expiring)/,
  /^invoice\.overdue/,
  /^payment\.failed/,
  /^campaign\.failed/,
  /^automation\.failed/,
  /^social\.post_failed/,
  /^mcp\.action_failed/,
  /^lead\.replied/,
  /^meeting\.booked/,
  /^contract\.(signed|expiring)/,
];

const IN_APP_PATTERNS = [
  /^lead\./,
  /^crm\./,
  /^deal\./,
  /^project\./,
  /^campaign\./,
  /^email\./,
  /^meeting\./,
  /^invoice\./,
  /^proposal\./,
  /^contract\./,
  /^social\./,
  /^integration\./,
  /^mcp\./,
  /^automation\./,
  /^document\./,
];

const DIGEST_ONLY_PATTERNS = [
  /^contact\.updated/,
  /^lead\.imported_bulk/,
  /^mcp\.action_completed/,
  /^background\./,
];

export function classifyEventPriority(eventType: string, status?: string): EventPriority {
  const type = normalizeEventType(eventType).toLowerCase();
  if (type.startsWith('security.') || (status === 'failed' && type.includes('payment'))) return 'P0';
  const urgency = eventUrgency(type, status);
  if (urgency === 'immediate') return type.startsWith('security.') ? 'P0' : 'P1';
  if (DIGEST_ONLY_PATTERNS.some((p) => p.test(type))) return 'P3';
  if (urgency === 'in_app' || IN_APP_PATTERNS.some((p) => p.test(type))) return 'P2';
  return 'P3';
}

export function priorityToNotificationLevel(
  priority: EventPriority,
  status?: string
): NotificationLevel {
  if (priority === 'P0' || priority === 'P1') return 'level3_urgent_email';
  if (priority === 'P2') return 'level2_digest';
  return 'level1_record_only';
}

export function shouldSendImmediateEmail(eventType: string, priority: EventPriority): boolean {
  if (priority === 'P0') return true;
  if (priority === 'P1') return IMMEDIATE_EMAIL_PATTERNS.some((p) => p.test(normalizeEventType(eventType).toLowerCase())) || eventUrgency(eventType) === 'immediate';
  return IMMEDIATE_EMAIL_PATTERNS.some((p) => p.test(normalizeEventType(eventType).toLowerCase()));
}

/** Opt-in noisy email for every mutating write. Default is off — use digest + urgent rules. */
export function shouldNotifyEveryBusinessWrite(): boolean {
  return process.env.MCP_NOTIFY_EVERY_ACTION === 'true';
}

export function shouldEmailForBusinessEvent(
  eventType: string,
  priority: EventPriority,
  source?: TenantBusinessEventInput['source'],
  status?: TenantBusinessEventInput['status'],
): boolean {
  if (status === 'failed') return true;
  if (shouldSendImmediateEmail(eventType, priority)) return true;
  if (!shouldNotifyEveryBusinessWrite()) return false;

  const type = eventType.toLowerCase();
  const writeSources = new Set<TenantBusinessEventInput['source']>([
    'mcp',
    'bonnie',
    'user',
    'system',
    'webhook',
    'cron',
  ]);
  if (source && !writeSources.has(source)) return false;

  return (
    type.startsWith('mcp.') ||
    type.startsWith('lead.') ||
    type.startsWith('social.') ||
    type.startsWith('crm.') ||
    type.startsWith('project.') ||
    type.startsWith('deal.') ||
    type.startsWith('invoice.') ||
    type.startsWith('contract.') ||
    type.startsWith('campaign.') ||
    type.startsWith('email.') ||
    type.startsWith('document.')
  );
}

export function isMutatingMcpTool(toolName: string): boolean {
  const n = toolName.toLowerCase();
  if (n.startsWith('get_') || n.startsWith('list_') || n.startsWith('search_') || n.startsWith('fetch_')) {
    return false;
  }
  if (n.startsWith('inspect_') || n.startsWith('audit_') || n.includes('_health')) return false;
  return /^(create|update|delete|send|publish|schedule|import|add|change|mark|run|stop|upload|reply|assign|move|void|approve|reject|resume)/.test(
    n
  ) || n.includes('outreach') || n.includes('invoice') || n.includes('lead');
}
