import { supabase } from '@/lib/supabase';

export interface AuditLogEntry {
  user_id?: string;
  action: string;
  /**
   * entity_type is required — maps to the audit_logs.entity_type column.
   * Examples: 'lead', 'invoice', 'contract', 'user', 'mcp_tool'
   */
  entity_type: string;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  user_agent?: string;
  /** city is supported — audit_logs schema includes this column via 20260410000002_ai_audit_schema.sql */
  city?: string;
  /** country is supported — audit_logs schema includes this column via 20260410000002_ai_audit_schema.sql */
  country?: string;
}

export class AuditService {
  /**
   * Log an action to the immutable audit trail.
   *
   * Failures are logged to console but never propagated to callers — this is
   * intentional: a secondary observability concern must not block a primary
   * business operation. For critical governance contexts, callers should check
   * the return value (once we expose it).
   */
  async log(entry: AuditLogEntry): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

      const { error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: entry.user_id || user?.id,
          action: entry.action,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          old_value: entry.old_value,
          new_value: entry.new_value,
          ip_address: entry.ip_address,
          user_agent: entry.user_agent || userAgent,
          city: entry.city,       // column exists — 20260410000002_ai_audit_schema.sql
          country: entry.country, // column exists — 20260410000002_ai_audit_schema.sql
        });

      if (error) {
        console.error('[AuditService] Failed to write audit log:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[AuditService] Unexpected error writing audit log:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Get audit logs for an entity
   */
  async getEntityLogs(entityType: string, entityId: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get suspicious activity (multiple failed actions or deletes)
   */
  async getSuspiciousActivity(limit: number = 10) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .ilike('action', '%delete%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

export const auditService = new AuditService();
