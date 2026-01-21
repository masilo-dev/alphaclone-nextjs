import { supabase } from '../lib/supabase';

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
    }): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('security_logs')
                .insert({
                    tenant_id: event.tenantId,
                    user_id: event.userId,
                    event_type: event.eventType,
                    ip_address: event.ipAddress,
                    user_agent: event.userAgent,
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
            const { data, error } = await supabase
                .from('security_logs')
                .select(`
                    *,
                    tenant:tenant_id (name),
                    user:user_id (name, email)
                `)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            const logs = (data || []).map(log => ({
                id: log.id,
                tenantId: log.tenant_id,
                userId: log.user_id,
                eventType: log.event_type,
                ipAddress: log.ip_address,
                userAgent: log.user_agent,
                location: log.location,
                deviceInfo: log.device_info,
                eventDetails: log.event_details,
                severity: log.severity,
                createdAt: log.created_at,
                tenant: log.tenant,
                user: log.user
            }));

            return { logs, error: null };
        } catch (err: any) {
            console.error('Error fetching security logs:', err);
            return { logs: [], error: err.message };
        }
    },

    /**
     * Get security logs for a specific tenant
     */
    async getTenantLogs(tenantId: string, limit: number = 100): Promise<{ logs: SecurityLog[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('security_logs')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            const logs = (data || []).map(log => ({
                id: log.id,
                tenantId: log.tenant_id,
                userId: log.user_id,
                eventType: log.event_type,
                ipAddress: log.ip_address,
                userAgent: log.user_agent,
                location: log.location,
                deviceInfo: log.device_info,
                eventDetails: log.event_details,
                severity: log.severity,
                createdAt: log.created_at
            }));

            return { logs, error: null };
        } catch (err: any) {
            console.error('Error fetching tenant logs:', err);
            return { logs: [], error: err.message };
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
