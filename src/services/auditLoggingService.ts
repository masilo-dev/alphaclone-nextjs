import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { writeServerAuditLog } from '@/lib/security/serverAuditLog';

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

/**
 * Audit logging that never relies on browser-session RLS for server/MCP paths.
 * Uses the service-role client so inserts succeed without disabling RLS for users.
 */
class AuditLoggingService {
  async logAction(
    action: string,
    entityType: string,
    entityId?: string,
    oldValue?: any,
    newValue?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Prefer centralized server audit writer (service role + redaction)
      const tenantId =
        (typeof newValue === 'object' && newValue && newValue.tenant_id) ||
        (typeof oldValue === 'object' && oldValue && oldValue.tenant_id) ||
        (entityType === 'mcp_integration' ? entityId : null);

      const actorUserId =
        (typeof newValue === 'object' && newValue && (newValue.user_id || newValue.actor_user_id)) ||
        (typeof oldValue === 'object' && oldValue && oldValue.user_id) ||
        null;

<<<<<<< HEAD
      const written = await writeServerAuditLog({
        tenantId: typeof tenantId === 'string' ? tenantId : null,
        actorUserId: typeof actorUserId === 'string' ? actorUserId : null,
        actorType: action.startsWith('mcp_') ? 'mcp' : 'system',
        action,
        resourceType: entityType,
        resourceId: entityId,
        success: true,
        metadata: {
          old_value: oldValue,
          new_value: newValue,
        },
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : 'Server-Environment',
      });
=======
      const logEntry: Record<string, any> = {
        user_id: user?.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_value: oldValue,
        new_value: newValue,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server-Environment',
        ip_address: ipBox.ip,
        // city/country omitted — columns not present in audit_logs table
      };
>>>>>>> origin/main

      if (written.ok) return { success: true };

      // Fallback direct service-role insert with minimal columns
      try {
        const admin = createSupabaseAdminClient();
        const { error } = await admin.from('audit_logs').insert({
          tenant_id: typeof tenantId === 'string' ? tenantId : null,
          user_id: typeof actorUserId === 'string' ? actorUserId : null,
          action,
          entity_type: entityType,
          entity_id: entityId || null,
          resource_type: entityType,
          resource_id: entityId || null,
          created_at: new Date().toISOString(),
        });
        if (error) {
          console.error('Audit log error:', {
            code: error.code,
            message: error.message,
          });
          return { success: false, error: error.message };
        }
        return { success: true };
      } catch (fallbackErr) {
        console.error('Audit logging failed:', fallbackErr);
        return { success: false, error: String(fallbackErr) };
      }
    } catch (err) {
      console.error('Audit logging failed:', err);
      return { success: false, error: String(err) };
    }
  }

  async getEntityLogs(
    entityType: string,
    entityId: string
  ): Promise<{ logs: AuditLogEntry[]; error?: string }> {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from('audit_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) {
        return { logs: [], error: error.message };
      }
      return { logs: (data || []) as AuditLogEntry[] };
    } catch (err) {
      return { logs: [], error: String(err) };
    }
  }

  async getUserLogs(userId: string): Promise<{ logs: AuditLogEntry[]; error?: string }> {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) return { logs: [], error: error.message };
      return { logs: (data || []) as AuditLogEntry[] };
    } catch (err) {
      return { logs: [], error: String(err) };
    }
  }

  async getRecentLogs(limit = 50): Promise<{ logs: AuditLogEntry[]; error?: string }> {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return { logs: [], error: error.message };
      return { logs: (data || []) as AuditLogEntry[] };
    } catch (err) {
      return { logs: [], error: String(err) };
    }
  }

  async searchByAction(
    action: string,
    limit: number = 50
  ): Promise<{ logs: AuditLogEntry[]; error?: string }> {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from('audit_logs')
        .select('*')
        .eq('action', action)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return { logs: [], error: error.message };
      return { logs: (data || []) as AuditLogEntry[] };
    } catch (err) {
      return { logs: [], error: String(err) };
    }
  }

  async getStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ stats: any; error?: string }> {
    try {
      const admin = createSupabaseAdminClient();
      let query = admin.from('audit_logs').select('action, entity_type, created_at');

      if (startDate) query = query.gte('created_at', startDate.toISOString());
      if (endDate) query = query.lte('created_at', endDate.toISOString());

      const { data, error } = await query;
      if (error) return { stats: null, error: error.message };

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
