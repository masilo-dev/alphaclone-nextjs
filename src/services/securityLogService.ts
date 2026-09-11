import { createAdminSupabaseClientOrThrow } from '../lib/apiAuth';
import { supabase as anonClient } from '../lib/supabase';

export interface SecurityLog {
    id: string;
    tenantId: string;
    userId?: string;
    eventType: string;
    ipAddress: string;
    userAgent?: string;
    location?: string;
    deviceInfo?: any;
    eventDetails?: any;
    severity: 'info' | 'warning' | 'critical';
    createdAt: string;
    tenant?: { name: string };
    user?: { name: string; email: string };
}

export const securityLogService = {
    /**
     * Log a security event with IP tracking
     */
    async logEvent(event: {
        tenantId?: string;
        userId?: string;
        eventType: string;
        ipAddress: string;
        userAgent?: string;
        location?: string;
        deviceInfo?: any;
        eventDetails?: any;
        severity?: 'info' | 'warning' | 'critical';
        useAdminClient?: boolean;
    }): Promise<{ error: string | null }> {
        try {
            const client = event.useAdminClient ? createAdminSupabaseClientOrThrow() : anonClient;
            
            const { error } = await client
                .from('security_logs')
                .insert({
                    tenant_id: event.tenantId,
                    user_id: event.userId,
                    event_type: event.eventType,
                    ip_address: event.ipAddress,
                    user_agent: event.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Server-Environment'),
                    location: event.location,
                    device_info: event.deviceInfo,
                    event_details: event.eventDetails,
                    severity: event.severity || 'info'
                });

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error logging security event:', err);
            return { error: err.message };
        }
    },

    /**
     * Get all security logs (admin only)
     */
    async getAllLogs(limit: number = 100): Promise<{ logs: SecurityLog[]; error: string | null }> {
        try {
            const res = await fetch(`/api/admin/security-logs?limit=${limit}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { logs: [], error: data.error || 'Failed to fetch security logs' };
            }
            return { logs: data.logs || [], error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch security logs';
            console.error('Error fetching security logs:', err);
            return { logs: [], error: message };
        }
    },

    /**
     * Get security logs for a specific tenant (platform super admin — server-side)
     */
    async getTenantLogs(tenantId: string, limit: number = 100): Promise<{ logs: SecurityLog[]; error: string | null }> {
        try {
            const res = await fetch(`/api/admin/security-logs?tenantId=${encodeURIComponent(tenantId)}&limit=${limit}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { logs: [], error: data.error || 'Failed to fetch tenant security logs' };
            }
            return { logs: data.logs || [], error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch tenant security logs';
            console.error('Error fetching tenant logs:', err);
            return { logs: [], error: message };
        }
    },

    /**
     * Get user's IP address (client-side helper)
     */
    async getUserIP(): Promise<string> {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Error getting IP:', error);
            return 'unknown';
        }
    },

    /**
     * Get device info from user agent
     */
    getDeviceInfo(userAgent: string): any {
        const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
        const isTablet = /Tablet|iPad/i.test(userAgent);
        const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/i)?.[0] || 'Unknown';
        const os = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/i)?.[0] || 'Unknown';

        return {
            deviceType: isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop',
            browser,
            os
        };
    }
};
