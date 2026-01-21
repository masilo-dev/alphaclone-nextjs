import { supabase } from '../lib/supabase';

export interface AuditLogEntry {
  id?: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  city?: string;
  country?: string;
  user_agent?: string;
  created_at?: string;
}

class AuditLoggingService {
  /**
   * Log an action to the audit trail
   */
  async logAction(
    action: string,
    entityType: string,
    entityId?: string,
    oldValue?: any,
    newValue?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let ipBox = { ip: 'Unknown', city: 'Unknown', country: 'Unknown' };
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          ipBox = { ip: data.ip, city: data.city, country: data.country_name };
        }
      } catch (e) {
        // Fallback or silent fail
      }

      const logEntry: AuditLogEntry = {
        user_id: user?.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_value: oldValue,
        new_value: newValue,
        user_agent: navigator.userAgent,
        ip_address: ipBox.ip,
        city: ipBox.city,
        country: ipBox.country
      };

      const { error } = await supabase
        .from('audit_logs')
        .insert(logEntry);

      if (error) {
        console.error('Audit log error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('Audit logging failed:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityLogs(
    entityType: string,
    entityId: string
  ): Promise<{ logs: AuditLogEntry[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) {
        return { logs: [], error: error.message };
      }

      return { logs: data || [], error: undefined };
    } catch (err) {
      return { logs: [], error: String(err) };
    }
  }

  /**
   * Get recent audit logs for admin dashboard
   */
  async getRecentLogs(
    limit: number = 50
  ): Promise<{ logs: AuditLogEntry[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { logs: [], error: error.message };
      }

      return { logs: data || [], error: undefined };
    } catch (err) {
      return { logs: [], error: String(err) };
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserLogs(
    userId: string,
    limit: number = 100
  ): Promise<{ logs: AuditLogEntry[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { logs: [], error: error.message };
      }

      return { logs: data || [], error: undefined };
    } catch (err) {
      return { logs: [], error: String(err) };
    }
  }

  /**
   * Search audit logs by action type
   */
  async searchByAction(
    action: string,
    limit: number = 50
  ): Promise<{ logs: AuditLogEntry[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', action)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { logs: [], error: error.message };
      }

      return { logs: data || [], error: undefined };
    } catch (err) {
      return { logs: [], error: String(err) };
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ stats: any; error?: string }> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('action, entity_type, created_at');

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        return { stats: null, error: error.message };
      }

      // Calculate statistics
      const stats = {
        total: data?.length || 0,
        byAction: this.groupBy(data || [], 'action'),
        byEntityType: this.groupBy(data || [], 'entity_type'),
      };

      return { stats, error: undefined };
    } catch (err) {
      return { stats: null, error: String(err) };
    }
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((acc: Record<string, number>, item: any) => {
      const value = item[key];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
}

export const auditLoggingService = new AuditLoggingService();
