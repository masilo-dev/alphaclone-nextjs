import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

// Simple user agent parser (lightweight alternative to ua-parser-js)
const parseUserAgent = (ua: string) => {
    const browsers = {
        chrome: /Chrome\/(\d+)/,
        firefox: /Firefox\/(\d+)/,
        safari: /Safari\/(\d+)/,
        edge: /Edg\/(\d+)/,
    };

    const devices = {
        mobile: /Mobile|Android|iPhone/i,
        tablet: /Tablet|iPad/i,
    };

    let browser = 'Unknown';
    for (const [name, regex] of Object.entries(browsers)) {
        if (regex.test(ua)) {
            browser = name.charAt(0).toUpperCase() + name.slice(1);
            break;
        }
    }

    let deviceType = 'desktop';
    for (const [type, regex] of Object.entries(devices)) {
        if (regex.test(ua)) {
            deviceType = type;
            break;
        }
    }

    return { browser, deviceType };
};

// Get IP and location data - Disabled to avoid CORS errors
// Service worker will block external API calls anyway
const getLocationData = async () => {
    // Return default values immediately - no external API call
    // Location tracking is optional and not critical for the app
    return {
        ip: null,
        country: 'Unknown',
        city: 'Unknown',
        countryCode: 'XX',
    };
};

export const activityService = {
    /**
     * Log user activity
     */
    async logActivity(userId: string, action: string, metadata: Record<string, unknown> = {}) {
        const locationData = await getLocationData();
        const { browser, deviceType } = parseUserAgent(navigator.userAgent);
        const tenantId = tenantService.getCurrentTenantId();

        const { error } = await supabase.from('activity_logs').insert({
            user_id: userId,
            action,
            ip_address: locationData.ip,
            country: locationData.country,
            city: locationData.city,
            device_type: deviceType,
            browser,
            user_agent: navigator.userAgent,
            metadata,
            tenant_id: tenantId,
        });

        return { error };
    },

    /**
     * Create login session
     */
    async createLoginSession(userId: string) {
        const locationData = await getLocationData();
        const { browser, deviceType } = parseUserAgent(navigator.userAgent);
        const tenantId = tenantService.getCurrentTenantId();

        const { data, error } = await supabase
            .from('login_sessions')
            .insert({
                user_id: userId,
                ip_address: locationData.ip,
                country: locationData.country,
                city: locationData.city,
                device_info: {
                    browser,
                    deviceType,
                    userAgent: navigator.userAgent,
                },
                tenant_id: tenantId,
            })
            .select()
            .single();

        if (!error && data) {
            // Store session ID in localStorage for logout tracking
            localStorage.setItem('session_id', data.id);
        }

        return { session: data, error };
    },

    /**
     * End login session
     */
    async endLoginSession() {
        const sessionId = localStorage.getItem('session_id');
        if (!sessionId) return { error: null };

        const { error } = await supabase
            .from('login_sessions')
            .update({
                logout_time: new Date().toISOString(),
                is_active: false,
            })
            .eq('id', sessionId);

        localStorage.removeItem('session_id');
        return { error };
    },

    /**
     * Get user's activity logs
     */
    async getActivityLogs(userId: string, limit = 50) {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('created_at', { ascending: false })
            .limit(limit);

        return { logs: data, error };
    },

    /**
     * Get user's login sessions
     */
    async getLoginSessions(userId: string, limit = 20) {
        const { data, error } = await supabase
            .from('login_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('login_time', { ascending: false })
            .limit(limit);

        return { sessions: data, error };
    },

    /**
     * Get all activity logs (admin only)
     */
    async getAllActivityLogs(limit = 100) {
        const { data, error } = await supabase
            .from('activity_logs')
            .select(`
        *,
        profiles:user_id (
          email,
          name,
          role
        )
      `)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('created_at', { ascending: false })
            .limit(limit);

        return { logs: data, error };
    },

    /**
     * Get all login sessions (admin only)
     */
    async getAllLoginSessions(limit = 100) {
        const { data, error } = await supabase
            .from('login_sessions')
            .select(`
        *,
        profiles:user_id (
          email,
          name,
          role
        )
      `)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('login_time', { ascending: false })
            .limit(limit);

        return { sessions: data, error };
    },

    /**
     * Get security alerts
     */
    async getSecurityAlerts(userId?: string, limit = 50) {
        let query = supabase
            .from('security_alerts')
            .select(`
        *,
        profiles:user_id (
          email,
          name
        )
      `)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('created_at', { ascending: false })
            .limit(limit);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        return { alerts: data, error };
    },

    /**
     * Resolve security alert
     */
    async resolveAlert(alertId: string) {
        const { error } = await supabase
            .from('security_alerts')
            .update({
                is_resolved: true,
                resolved_at: new Date().toISOString(),
            })
            .eq('id', alertId);

        return { error };
    },

    /**
     * Check if country is blocked
     */
    async isCountryBlocked(countryCode?: string) {
        // Get current location if not provided
        let code = countryCode;
        if (!code) {
            const locationData = await getLocationData();
            code = locationData.countryCode;
        }

        const { data, error } = await supabase
            .from('blocked_countries')
            .select('*')
            .eq('country_code', code)
            .eq('is_active', true)
            .single();

        return {
            blocked: !!data,
            country: data,
            error: error?.code === 'PGRST116' ? null : error, // Ignore "not found" error
        };
    },

    /**
     * Get blocked countries list
     */
    async getBlockedCountries() {
        const { data, error } = await supabase
            .from('blocked_countries')
            .select('*')
            .eq('is_active', true)
            .order('country_name');

        return { countries: data, error };
    },

    /**
     * Add blocked country (admin only)
     */
    async addBlockedCountry(countryCode: string, countryName: string, reason: string) {
        const { data, error } = await supabase
            .from('blocked_countries')
            .insert({
                country_code: countryCode,
                country_name: countryName,
                reason,
            })
            .select()
            .single();

        return { country: data, error };
    },

    /**
     * Remove blocked country (admin only)
     */
    async removeBlockedCountry(countryCode: string) {
        const { error } = await supabase
            .from('blocked_countries')
            .update({ is_active: false })
            .eq('country_code', countryCode);

        return { error };
    },

    /**
     * Get activity statistics (admin only)
     */
    async getActivityStats() {
        const { data: totalLogs, error: logsError } = await supabase
            .from('activity_logs')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantService.getCurrentTenantId());

        const { data: suspiciousLogs, error: suspiciousError } = await supabase
            .from('activity_logs')
            .select('id', { count: 'exact', head: true })
            .eq('is_suspicious', true)
            .eq('tenant_id', tenantService.getCurrentTenantId());

        const { data: activeSessions, error: sessionsError } = await supabase
            .from('login_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('tenant_id', tenantService.getCurrentTenantId());

        const { data: unresolvedAlerts, error: alertsError } = await supabase
            .from('security_alerts')
            .select('id', { count: 'exact', head: true })
            .eq('is_resolved', false)
            .eq('tenant_id', tenantService.getCurrentTenantId());

        return {
            stats: {
                totalLogs: totalLogs || 0,
                suspiciousLogs: suspiciousLogs || 0,
                activeSessions: activeSessions || 0,
                unresolvedAlerts: unresolvedAlerts || 0,
            },
            error: logsError || suspiciousError || sessionsError || alertsError,
        };
    },
    /**
     * Log a security alert (e.g. failed login)
     */
    async logSecurityAlert(userId: string, type: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
        const { error } = await supabase
            .from('security_alerts')
            .insert({
                user_id: userId,
                alert_type: type,
                description,
                severity,
                is_resolved: false,
                tenant_id: tenantService.getCurrentTenantId()
            });
        return { error };
    },

    /**
     * Log navigation event
     */
    async logNavigation(userId: string, path: string) {
        return this.logActivity(userId, 'Navigation', { path });
    }
};
