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
): Promise<{ created: boolean; updated?: boolean; notificationId?: string; error?: string }> {
  if (!input.tenantId || !input.recipientUserId) {
    return { created: false, error: 'tenant and recipient are required' };
  }

  const now = new Date().toISOString();
  const type = mapEventTypeToNotificationType(input.eventType);

  // Check for existing logical notification by correlationId or dedupeKey to mutate in place
  if (input.correlationId || input.dedupeKey) {
    try {
      let query = admin
        .from('notifications')
        .select('id, metadata, status, title, message')
        .eq('tenant_id', input.tenantId);

      if (input.correlationId) {
        query = query.eq('correlation_id', input.correlationId);
      } else if (input.dedupeKey) {
        query = query.eq('dedupe_key', input.dedupeKey);
      }

      const { data: existingRows } = await query.limit(1);
      const existing = existingRows && existingRows[0];

      if (existing?.id) {
        const existingMeta =
          typeof existing.metadata === 'object' && existing.metadata ? existing.metadata : {};
        const patch = {
          title: input.title,
          message: input.message,
          action_url: input.actionUrl || null,
          link: input.actionUrl || null,
          priority: input.severity || 'medium',
          severity: input.severity || 'medium',
          status: 'unread',
          read: false,
          event_type: input.eventType,
          type,
          metadata: {
            ...existingMeta,
            event_type: input.eventType,
            ...(input.metadata || {}),
            last_mutated_at: now,
          },
        };

        const { error: updateError } = await admin
          .from('notifications')
          .update(patch)
          .eq('id', existing.id);

        if (!updateError) {
          return { created: false, updated: true, notificationId: existing.id };
        }
      }
    } catch (lookupErr) {
      console.warn('[insertTenantNotification] correlation lookup failed, falling back to insert:', lookupErr);
    }
  }

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

  const { data: insertedData, error } = await admin.from('notifications').insert(canonical).select('id').maybeSingle();
  if (!error) return { created: true, notificationId: insertedData?.id };
  if (error.code === '23505') {
    // Unique violation on dedupe_key / correlation_id — update the existing row
    if (input.correlationId || input.dedupeKey) {
      const { data: existingRows } = await admin
        .from('notifications')
        .select('id')
        .eq('tenant_id', input.tenantId)
        .or(`correlation_id.eq.${input.correlationId || 'none'},dedupe_key.eq.${input.dedupeKey || 'none'}`)
        .limit(1);
      if (existingRows && existingRows[0]?.id) {
        await admin
          .from('notifications')
          .update({
            title: input.title,
            message: input.message,
            priority: input.severity || 'medium',
            severity: input.severity || 'medium',
            status: 'unread',
            read: false,
            metadata: canonical.metadata,
          })
          .eq('id', existingRows[0].id);
        return { created: false, updated: true, notificationId: existingRows[0].id };
      }
    }
    return { created: false, error: 'duplicate' };
  }

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
