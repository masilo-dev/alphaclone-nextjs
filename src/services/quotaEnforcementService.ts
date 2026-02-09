import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

/**
 * Quota Enforcement Service
 * Tracks usage and enforces subscription tier limits
 */

export interface UsageSummary {
    metric_name: string;
    current_value: number;
    limit_value: number;
    percentage_used: number;
    status: 'ok' | 'approaching' | 'exceeded';
}

export interface QuotaAlert {
    id: string;
    metric_name: string;
    alert_type: 'approaching' | 'exceeded' | 'blocked';
    current_value: number;
    limit_value: number;
    threshold_percentage?: number;
    alerted_at: string;
}

export type MetricName =
    | 'users'
    | 'projects'
    | 'storage_mb'
    | 'api_calls'
    | 'contracts'
    | 'team_members'
    | 'ai_requests'
    | 'video_minutes';

export const quotaEnforcementService = {
    /**
     * Check if tenant can perform an action
     */
    async canPerformAction(
        tenantId: string,
        metricName: MetricName
    ): Promise<{ allowed: boolean; reason?: string; currentUsage?: number; limit?: number }> {
        try {
            const { data, error } = await supabase.rpc('can_perform_action', {
                p_tenant_id: tenantId,
                p_metric_name: metricName,
            });

            if (error) throw error;

            if (!data) {
                // Get usage details for better error message
                const usage = await this.getUsageSummary(tenantId);
                const metric = usage.find(u => u.metric_name === metricName);

                return {
                    allowed: false,
                    reason: `Quota exceeded for ${metricName}. Upgrade your plan to continue.`,
                    currentUsage: metric?.current_value,
                    limit: metric?.limit_value,
                };
            }

            return { allowed: true };
        } catch (error) {
            console.error('Error checking quota:', error);
            // Fail open - allow action if quota check fails
            return { allowed: true };
        }
    },

    /**
     * Track usage for a metric
     */
    async trackUsage(
        tenantId: string,
        metricName: MetricName,
        increment: number = 1,
        userId?: string,
        eventType?: string,
        metadata?: any
    ): Promise<{ success: boolean; quotaExceeded: boolean }> {
        try {
            const { data, error } = await supabase.rpc('track_usage', {
                p_tenant_id: tenantId,
                p_metric_name: metricName,
                p_increment: increment,
                p_user_id: userId,
                p_event_type: eventType,
                p_metadata: metadata || {},
            });

            if (error) throw error;

            return {
                success: true,
                quotaExceeded: !data, // track_usage returns false if quota exceeded
            };
        } catch (error) {
            console.error('Error tracking usage:', error);
            return {
                success: false,
                quotaExceeded: false,
            };
        }
    },

    /**
     * Get usage summary for tenant
     */
    async getUsageSummary(tenantId: string): Promise<UsageSummary[]> {
        try {
            const { data, error } = await supabase.rpc('get_tenant_usage_summary', {
                p_tenant_id: tenantId,
            });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching usage summary:', error);
            return [];
        }
    },

    /**
     * Get quota alerts for tenant
     */
    async getQuotaAlerts(tenantId: string): Promise<QuotaAlert[]> {
        try {
            const { data, error } = await supabase
                .from('quota_alerts')
                .select('*')
                .eq('tenant_id', tenantId)
                .is('resolved_at', null)
                .order('alerted_at', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching quota alerts:', error);
            return [];
        }
    },

    /**
     * Acknowledge quota alert
     */
    async acknowledgeAlert(alertId: string): Promise<{ success: boolean }> {
        try {
            const { error } = await supabase
                .from('quota_alerts')
                .update({ acknowledged_at: new Date().toISOString() })
                .eq('id', alertId);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error acknowledging alert:', error);
            return { success: false };
        }
    },

    /**
     * Resolve quota alert (when user upgrades or usage decreases)
     */
    async resolveAlert(alertId: string): Promise<{ success: boolean }> {
        try {
            const { error } = await supabase
                .from('quota_alerts')
                .update({ resolved_at: new Date().toISOString() })
                .eq('id', alertId);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error resolving alert:', error);
            return { success: false };
        }
    },

    /**
     * Get usage history for a metric
     */
    async getUsageHistory(
        tenantId: string,
        metricName: MetricName,
        days: number = 30
    ): Promise<any[]> {
        try {
            const since = new Date();
            since.setDate(since.getDate() - days);

            const { data, error } = await supabase
                .from('usage_events')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('metric_name', metricName)
                .gte('created_at', since.toISOString())
                .order('created_at', { ascending: true });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching usage history:', error);
            return [];
        }
    },

    /**
     * Helper: Track project creation
     */
    async trackProjectCreation(tenantId: string, userId: string, projectId: string): Promise<boolean> {
        const { allowed } = await this.canPerformAction(tenantId, 'projects');

        if (!allowed) {
            return false;
        }

        await this.trackUsage(tenantId, 'projects', 1, userId, 'project_created', {
            project_id: projectId,
        });

        return true;
    },

    /**
     * Helper: Track user addition
     */
    async trackUserAddition(tenantId: string, adminUserId: string, newUserId: string): Promise<boolean> {
        const { allowed } = await this.canPerformAction(tenantId, 'users');

        if (!allowed) {
            return false;
        }

        await this.trackUsage(tenantId, 'users', 1, adminUserId, 'user_added', {
            new_user_id: newUserId,
        });

        return true;
    },

    /**
     * Helper: Track contract creation
     */
    async trackContractCreation(tenantId: string, userId: string, contractId: string): Promise<boolean> {
        const { allowed } = await this.canPerformAction(tenantId, 'contracts');

        if (!allowed) {
            return false;
        }

        await this.trackUsage(tenantId, 'contracts', 1, userId, 'contract_created', {
            contract_id: contractId,
        });

        return true;
    },

    /**
     * Helper: Track API call
     */
    async trackAPICall(tenantId: string, endpoint: string, userId?: string): Promise<void> {
        // Don't block on quota check for API calls - just track
        await this.trackUsage(tenantId, 'api_calls', 1, userId, 'api_call', {
            endpoint,
        });
    },

    /**
     * Helper: Track AI request
     */
    async trackAIRequest(
        tenantId: string,
        userId: string,
        promptTokens: number,
        completionTokens: number
    ): Promise<boolean> {
        const { allowed } = await this.canPerformAction(tenantId, 'ai_requests');

        if (!allowed) {
            return false;
        }

        await this.trackUsage(tenantId, 'ai_requests', 1, userId, 'ai_request', {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
        });

        return true;
    },

    /**
     * Helper: Track video minutes
     */
    async trackVideoMinutes(
        tenantId: string,
        userId: string,
        minutes: number,
        roomId: string
    ): Promise<boolean> {
        const { allowed } = await this.canPerformAction(tenantId, 'video_minutes');

        if (!allowed) {
            return false;
        }

        await this.trackUsage(tenantId, 'video_minutes', minutes, userId, 'video_call', {
            room_id: roomId,
            duration_minutes: minutes,
        });

        return true;
    },

    /**
     * Helper: Track storage usage
     */
    async trackStorageUsage(
        tenantId: string,
        userId: string,
        sizeMB: number,
        fileId: string
    ): Promise<boolean> {
        const { allowed } = await this.canPerformAction(tenantId, 'storage_mb');

        if (!allowed) {
            return false;
        }

        await this.trackUsage(tenantId, 'storage_mb', sizeMB, userId, 'file_uploaded', {
            file_id: fileId,
            size_mb: sizeMB,
        });

        return true;
    },

    /**
     * Get tier limits for current tenant
     */
    async getTierLimits(tier: string): Promise<any> {
        try {
            const { data, error } = await supabase
                .from('subscription_tier_limits')
                .select('*')
                .eq('tier_name', tier)
                .single();

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error fetching tier limits:', error);
            return null;
        }
    },

    /**
     * Format usage for display
     */
    formatUsage(usage: UsageSummary): string {
        const { current_value, limit_value, percentage_used } = usage;

        if (limit_value === 999999) {
            return `${current_value.toLocaleString()} (Unlimited)`;
        }

        return `${current_value.toLocaleString()} / ${limit_value.toLocaleString()} (${percentage_used.toFixed(1)}%)`;
    },

    /**
     * Get upgrade recommendation based on usage
     */
    getUpgradeRecommendation(usage: UsageSummary[]): string | null {
        const exceeded = usage.filter(u => u.status === 'exceeded');
        const approaching = usage.filter(u => u.status === 'approaching');

        if (exceeded.length > 0) {
            return `You've exceeded limits for: ${exceeded.map(u => u.metric_name).join(', ')}. Upgrade to continue.`;
        }

        if (approaching.length >= 2) {
            return `You're approaching limits for multiple features. Consider upgrading to avoid interruptions.`;
        }

        return null;
    },
};
