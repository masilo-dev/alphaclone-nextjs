import { supabase } from '@/lib/supabase';

export interface AuditLogEntry {
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  user_agent?: string;
  city?: string;
  country?: string;
}

export class AuditService {
  /**
   * Log an action to the audit trail
   */
  async log(entry: AuditLogEntry): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Capture basic request context if available (browser environments)
    let userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

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
        city: entry.city,
        country: entry.country
      });

    if (error) {
      console.error('[AuditService] Failed to write audit log:', error);
      // We don't throw here to avoid breaking the calling operation, 
      // but in a critical system you might want to.
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
