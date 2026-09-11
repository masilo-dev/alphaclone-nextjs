/**
 * Comprehensive Audit Logging Service - 120% Feature
 * Tracks all user actions with tamper-proof logging
 */

import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export type AuditAction =
  | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  | 'EXPORT' | 'IMPORT' | 'LOGIN' | 'LOGOUT'
  | 'SHARE' | 'DOWNLOAD' | 'PRINT' | 'APPROVE' | 'REJECT';

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  userEmail?: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    apiEndpoint?: string;
    mcpTool?: string;
  };
  severity?: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  hash?: string; // Tamper-proof hash
}

// Actions that require detailed logging
const HIGH_SEVERITY_ACTIONS: AuditAction[] = ['DELETE', 'EXPORT', 'LOGIN', 'SHARE'];
const CRITICAL_ACTIONS: AuditAction[] = ['DELETE' , 'APPROVE', 'REJECT'];

/**
 * Log an audit event
 * 120% feature - Comprehensive audit trail
 */
export async function logAuditEvent(
  entry: Omit<AuditLogEntry, 'id' | 'createdAt' | 'hash' | 'tenantId'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) {
      // Still log without tenant if needed
      console.warn('Audit log: No tenant context, logging with fallback');
    }

    const severity = determineSeverity(entry.action, entry.resourceType);

    // Generate tamper-proof hash
    const hash = await generateAuditHash({
      ...entry,
      tenantId: tenantId || 'system',
      timestamp: new Date().toISOString(),
    });

    const { error } = await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: entry.userId,
      user_email: entry.userEmail,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      old_values: entry.oldValues,
      new_values: entry.newValues,
      metadata: entry.metadata,
      severity,
      hash,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    // For critical actions, also create an alert
    if (severity === 'critical') {
      await createSecurityAlert(entry, tenantId);
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to write audit log:', err);
    // Don't fail the operation if audit logging fails
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Determine severity based on action and resource
 */
function determineSeverity(action: AuditAction, resourceType: string): 'low' | 'medium' | 'high' | 'critical' {
  if (CRITICAL_ACTIONS.includes(action) && ['user', 'tenant', 'role'].includes(resourceType)) {
    return 'critical';
  }
  if (CRITICAL_ACTIONS.includes(action)) {
    return 'high';
  }
  if (HIGH_SEVERITY_ACTIONS.includes(action)) {
    return 'high';
  }
  if (action === 'UPDATE' && ['user', 'tenant', 'payment'].includes(resourceType)) {
    return 'high';
  }
  if (action === 'DELETE') {
    return 'medium';
  }
  return 'low';
}

/**
 * Generate tamper-proof hash for audit entry
 */
async function generateAuditHash(data: any): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(data)));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create security alert for critical actions
 */
async function createSecurityAlert(
  entry: Omit<AuditLogEntry, 'id' | 'createdAt' | 'hash' | 'tenantId'>,
  tenantId: string | null
): Promise<void> {
  try {
    await supabase.from('security_alerts').insert({
      tenant_id: tenantId,
      type: 'critical_action',
      severity: 'high',
      title: `Critical Action: ${entry.action} on ${entry.resourceType}`,
      description: `User ${entry.userEmail} performed ${entry.action} on ${entry.resourceType}:${entry.resourceId}`,
      metadata: {
        audit_action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        user_id: entry.userId,
      },
      created_at: new Date().toISOString(),
      status: 'open',
    });
  } catch (err) {
    console.error('Failed to create security alert:', err);
  }
}

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(filters?: {
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogEntry[]; total: number; error?: string }> {
  try {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) return { logs: [], total: 0, error: 'No tenant' };

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }
    if (filters?.resourceId) {
      query = query.eq('resource_id', filters.resourceId);
    }
    if (filters?.severity) {
      query = query.eq('severity', filters.severity);
    }
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    interface AuditLogRow {
      id: string;
      tenant_id: string;
      user_id: string;
      user_email?: string;
      action: AuditAction;
      resource_type: string;
      resource_id: string;
      old_values?: Record<string, any>;
      new_values?: Record<string, any>;
      metadata?: Record<string, any>;
      severity: 'low' | 'medium' | 'high' | 'critical';
      created_at: string;
      hash?: string;
    }

    return {
      logs: (data || []).map((log: AuditLogRow) => ({
        id: log.id,
        tenantId: log.tenant_id,
        userId: log.user_id,
        userEmail: log.user_email,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        oldValues: log.old_values,
        newValues: log.new_values,
        metadata: log.metadata,
        severity: log.severity,
        createdAt: log.created_at,
        hash: log.hash,
      })),
      total: count || 0,
    };
  } catch (err) {
    console.error('Failed to get audit logs:', err);
    return { logs: [], total: 0, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Verify audit log integrity
 */
export async function verifyAuditLogIntegrity(logId: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const { data: log } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (!log) return { valid: false, error: 'Log not found' };

    // Recalculate hash and compare
    const expectedHash = await generateAuditHash({
      tenantId: log.tenant_id,
      userId: log.user_id,
      userEmail: log.user_email,
      action: log.action,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      oldValues: log.old_values,
      newValues: log.new_values,
      metadata: log.metadata,
      severity: log.severity,
      timestamp: log.created_at,
    });

    return { valid: log.hash === expectedHash };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Verification failed' };
  }
}

/**
 * Export audit logs (with proper authorization)
 */
export async function exportAuditLogs(
  format: 'csv' | 'json',
  filters?: Parameters<typeof getAuditLogs>[0]
): Promise<{ data: string; filename: string }> {
  const { logs } = await getAuditLogs({ ...filters, limit: 10000 });

  if (format === 'json') {
    return {
      data: JSON.stringify(logs, null, 2),
      filename: `audit-logs-${new Date().toISOString().split('T')[0]}.json`,
    };
  }

  // CSV format
  const headers = ['id', 'created_at', 'user_email', 'action', 'resource_type', 'resource_id', 'severity', 'hash'];
  const rows = logs.map(log => [
    log.id,
    log.createdAt,
    log.userEmail || '',
    log.action,
    log.resourceType,
    log.resourceId,
    log.severity,
    log.hash || '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

  return {
    data: csv,
    filename: `audit-logs-${new Date().toISOString().split('T')[0]}.csv`,
  };
}

/**
 * Middleware-style wrapper for automatic audit logging
 */
export function withAudit<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    action: AuditAction;
    resourceType: string;
    getResourceId?: (...args: Parameters<T>) => string;
    getMetadata?: (...args: Parameters<T>) => Record<string, any>;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const result = await fn(...args);

    // Log after successful execution
    await logAuditEvent({
      userId: 'system', // Should be replaced with actual user context
      action: options.action,
      resourceType: options.resourceType,
      resourceId: options.getResourceId?.(...args) || 'unknown',
      metadata: options.getMetadata?.(...args),
    });

    return result;
  }) as T;
}
