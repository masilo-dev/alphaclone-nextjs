import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface SecurityThreat {
    id: string;
    type: 'failed_login' | 'suspicious_activity' | 'data_breach_attempt' | 'unauthorized_access' | 'rate_limit_exceeded';
    severity: 'low' | 'medium' | 'high' | 'critical';
    user_id?: string;
    ip_address: string;
    user_agent: string;
    description: string;
    metadata: any;
    status: 'detected' | 'investigating' | 'resolved' | 'false_positive';
    created_at: string;
    resolved_at?: string;
}

export interface IPBlockRule {
    ip_address: string;
    reason: string;
    blocked_at: string;
    expires_at?: string;
}

export interface SecurityMetrics {
    totalThreats: number;
    activeThreats: number;
    blockedIPs: number;
    failedLogins24h: number;
    suspiciousActivities: number;
}

class SecurityThreatService {
    private failedLoginAttempts: Map<string, number> = new Map();
    private blockedIPs: Set<string> = new Set();

    /**
     * Detect and log security threat
     */
    async detectThreat(
        type: SecurityThreat['type'],
        severity: SecurityThreat['severity'],
        ipAddress: string,
        userAgent: string,
        description: string,
        metadata?: any,
        userId?: string
    ): Promise<{ threat: SecurityThreat | null; action?: string }> {
        try {
            // Create threat record
            const { data: threat } = await supabase
                .from('security_threats')
                .insert({
                    type,
                    severity,
                    user_id: userId,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    description,
                    metadata,
                    status: 'detected',
                    created_at: new Date().toISOString(),
                })
                .select()
                .single();

            // Log to audit trail
            await auditLoggingService.logAction(
                'security_threat_detected',
                'security',
                threat?.id || 'unknown',
                undefined,
                { type, severity, ip_address: ipAddress }
            );

            // Take automatic action based on severity
            let action: string | undefined;
            if (severity === 'critical' || severity === 'high') {
                action = await this.handleHighSeverityThreat(threat!, ipAddress, userId);
            }

            // Notify admin
            await this.notifyAdminOfThreat(threat!);

            return { threat, action };
        } catch (error) {
            console.error('Error detecting threat:', error);
            return { threat: null };
        }
    }

    /**
     * Track failed login attempt
     */
    async trackFailedLogin(
        email: string,
        ipAddress: string,
        userAgent: string
    ): Promise<{ blocked: boolean; attemptsRemaining: number }> {
        const key = `${email}:${ipAddress}`;
        const attempts = (this.failedLoginAttempts.get(key) || 0) + 1;
        this.failedLoginAttempts.set(key, attempts);

        // Block after 5 failed attempts
        if (attempts >= 5) {
            await this.blockIP(ipAddress, 'Multiple failed login attempts', 24); // Block for 24 hours

            await this.detectThreat(
                'failed_login',
                'high',
                ipAddress,
                userAgent,
                `5 failed login attempts for ${email}`,
                { email, attempts }
            );

            return { blocked: true, attemptsRemaining: 0 };
        }

        // Log failed attempt
        if (attempts >= 3) {
            await this.detectThreat(
                'failed_login',
                'medium',
                ipAddress,
                userAgent,
                `${attempts} failed login attempts for ${email}`,
                { email, attempts }
            );
        }

        return { blocked: false, attemptsRemaining: 5 - attempts };
    }

    /**
     * Reset failed login attempts (on successful login)
     */
    resetFailedLogins(email: string, ipAddress: string): void {
        const key = `${email}:${ipAddress}`;
        this.failedLoginAttempts.delete(key);
    }

    /**
     * Block IP address
     */
    async blockIP(
        ipAddress: string,
        reason: string,
        hoursToBlock: number = 24
    ): Promise<{ success: boolean }> {
        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + hoursToBlock);

            await supabase.from('blocked_ips').insert({
                ip_address: ipAddress,
                reason,
                blocked_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString(),
            });

            this.blockedIPs.add(ipAddress);

            await auditLoggingService.logAction(
                'ip_blocked',
                'security',
                ipAddress,
                undefined,
                { reason, expires_at: expiresAt.toISOString() }
            );

            return { success: true };
        } catch (error) {
            console.error('Error blocking IP:', error);
            return { success: false };
        }
    }

    /**
     * Check if IP is blocked
     */
    async isIPBlocked(ipAddress: string): Promise<boolean> {
        try {
            const { data: blocked } = await supabase
                .from('blocked_ips')
                .select('*')
                .eq('ip_address', ipAddress)
                .gt('expires_at', new Date().toISOString())
                .single();

            return !!blocked;
        } catch (error) {
            return false;
        }
    }

    /**
     * Detect suspicious activity patterns
     */
    async detectSuspiciousActivity(
        userId: string,
        activity: string,
        metadata: any
    ): Promise<boolean> {
        try {
            // Check for rapid API calls (rate limiting)
            const recentActivity = await this.getRecentActivity(userId, 60); // Last 60 seconds

            if (recentActivity.length > 100) {
                await this.detectThreat(
                    'rate_limit_exceeded',
                    'medium',
                    metadata.ip_address || 'unknown',
                    metadata.user_agent || 'unknown',
                    'Excessive API calls detected',
                    { activity_count: recentActivity.length, user_id: userId },
                    userId
                );
                return true;
            }

            // Check for unusual access patterns
            if (activity === 'data_export' && recentActivity.filter(a => a.activity === 'data_export').length > 5) {
                await this.detectThreat(
                    'data_breach_attempt',
                    'critical',
                    metadata.ip_address || 'unknown',
                    metadata.user_agent || 'unknown',
                    'Multiple data export attempts detected',
                    { user_id: userId },
                    userId
                );
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error detecting suspicious activity:', error);
            return false;
        }
    }

    /**
     * Get recent activity for a user
     */
    private async getRecentActivity(userId: string, seconds: number): Promise<any[]> {
        try {
            const since = new Date();
            since.setSeconds(since.getSeconds() - seconds);

            const { data } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', since.toISOString());

            return data || [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Handle high severity threats
     */
    private async handleHighSeverityThreat(
        threat: SecurityThreat,
        ipAddress: string,
        userId?: string
    ): Promise<string> {
        // Block IP immediately
        await this.blockIP(ipAddress, `High severity threat: ${threat.type}`, 72);

        // If user account involved, lock it
        if (userId) {
            await supabase
                .from('profiles')
                .update({ account_locked: true, locked_reason: threat.description })
                .eq('id', userId);

            return 'IP blocked and user account locked';
        }

        return 'IP blocked';
    }

    /**
     * Notify admin of security threat
     */
    private async notifyAdminOfThreat(threat: SecurityThreat): Promise<void> {
        try {
            // In production, send email/SMS to admin
            console.warn(`Security Threat Detected: ${threat.type} - ${threat.severity}`);

            // Create admin notification
            const { data: admins } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', 'admin');

            if (admins) {
                for (const admin of admins) {
                    await supabase.from('messages').insert({
                        sender_id: 'system',
                        recipient_id: admin.id,
                        text: `Security Alert: ${threat.description}`,
                        priority: threat.severity === 'critical' ? 'urgent' : 'high',
                        created_at: new Date().toISOString(),
                    });
                }
            }
        } catch (error) {
            console.error('Error notifying admin:', error);
        }
    }

    /**
     * Get security metrics
     */
    async getSecurityMetrics(): Promise<SecurityMetrics> {
        try {
            const last24h = new Date();
            last24h.setHours(last24h.getHours() - 24);

            const [threats, activeThreats, blockedIPs, failedLogins] = await Promise.all([
                supabase.from('security_threats').select('id', { count: 'exact' }),
                supabase.from('security_threats').select('id', { count: 'exact' }).in('status', ['detected', 'investigating']),
                supabase.from('blocked_ips').select('id', { count: 'exact' }).gt('expires_at', new Date().toISOString()),
                supabase.from('security_threats').select('id', { count: 'exact' }).eq('type', 'failed_login').gte('created_at', last24h.toISOString()),
            ]);

            return {
                totalThreats: threats.count || 0,
                activeThreats: activeThreats.count || 0,
                blockedIPs: blockedIPs.count || 0,
                failedLogins24h: failedLogins.count || 0,
                suspiciousActivities: 0, // Would calculate from audit logs
            };
        } catch (error) {
            console.error('Error fetching security metrics:', error);
            return {
                totalThreats: 0,
                activeThreats: 0,
                blockedIPs: 0,
                failedLogins24h: 0,
                suspiciousActivities: 0,
            };
        }
    }

    /**
     * Resolve threat
     */
    async resolveThreat(
        threatId: string,
        resolution: 'resolved' | 'false_positive'
    ): Promise<{ success: boolean }> {
        try {
            await supabase
                .from('security_threats')
                .update({
                    status: resolution,
                    resolved_at: new Date().toISOString(),
                })
                .eq('id', threatId);

            await auditLoggingService.logAction(
                'security_threat_resolved',
                'security',
                threatId,
                undefined,
                { resolution }
            );

            return { success: true };
        } catch (error) {
            return { success: false };
        }
    }

    /**
     * Enable 2FA enforcement
     */
    async enforce2FA(userId: string): Promise<{ success: boolean }> {
        try {
            await supabase
                .from('profiles')
                .update({ require_2fa: true })
                .eq('id', userId);

            return { success: true };
        } catch (error) {
            return { success: false };
        }
    }
}

export const securityThreatService = new SecurityThreatService();
