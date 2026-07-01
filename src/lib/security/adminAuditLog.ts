import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type AdminAuditEvent = {
  adminUserId: string;
  eventType: string;
  tenantId?: string | null;
  eventDetails?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'critical';
  ipAddress?: string;
};

/**
 * Records platform super-admin actions in security_logs for accountability.
 */
export async function logPlatformAdminAction(event: AdminAuditEvent): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from('security_logs').insert({
      tenant_id: event.tenantId ?? null,
      user_id: event.adminUserId,
      event_type: event.eventType,
      ip_address: event.ipAddress || 'platform-admin-api',
      event_details: event.eventDetails ?? {},
      severity: event.severity ?? 'info',
    });
  } catch (err) {
    console.warn('[adminAuditLog] insert skipped:', err);
  }
}
