import 'server-only';

import { mapEventTypeToNotificationType } from '@/lib/notifications/notificationType';

type Admin = { from: (table: string) => any };

export type CanonicalNotificationInsert = {
  tenantId: string;
  recipientUserId: string;
  recipientRole?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  eventType: string;
  title: string;
  message: string;
  severity?: 'low' | 'medium' | 'high' | 'urgent';
  channel?: 'in_app' | 'email' | 'digest';
  actionUrl?: string | null;
  dedupeKey?: string | null;
  sourceEventId?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Insert a tenant-scoped in-app notification. Falls back to legacy columns
 * when the operating-system migration has not been applied yet.
 */
export async function insertTenantNotification(
  admin: Admin,
  input: CanonicalNotificationInsert,
): Promise<{ created: boolean; error?: string }> {
  if (!input.tenantId || !input.recipientUserId) {
    return { created: false, error: 'tenant and recipient are required' };
  }

  const now = new Date().toISOString();
  const type = mapEventTypeToNotificationType(input.eventType);
  const canonical = {
    user_id: input.recipientUserId,
    tenant_id: input.tenantId,
    type,
    title: input.title,
    message: input.message,
    action_url: input.actionUrl || null,
    link: input.actionUrl || null,
    read: false,
    priority: input.severity || 'medium',
    recipient_role: input.recipientRole || null,
    entity_type: input.entityType || null,
    entity_id: input.entityId || null,
    event_type: input.eventType,
    severity: input.severity || 'medium',
    channel: input.channel || 'in_app',
    status: 'unread',
    created_at: now,
    dedupe_key: input.dedupeKey || null,
    source_event_id: input.sourceEventId || null,
    correlation_id: input.correlationId || null,
    metadata: {
      event_type: input.eventType,
      ...(input.metadata || {}),
    },
  };

  const { error } = await admin.from('notifications').insert(canonical);
  if (!error) return { created: true };
  if (error.code === '23505') return { created: false, error: 'duplicate' };

  const { error: legacyError } = await admin.from('notifications').insert({
    user_id: input.recipientUserId,
    tenant_id: input.tenantId,
    type,
    title: input.title,
    message: input.message,
    action_url: input.actionUrl || null,
    link: input.actionUrl || null,
    read: false,
    priority: input.severity || 'medium',
    metadata: canonical.metadata,
  });
  if (!legacyError) return { created: true };
  return { created: false, error: legacyError.message || error.message };
}
