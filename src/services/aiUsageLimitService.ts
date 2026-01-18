import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface AIUsage {
    id: string;
    user_id: string;
    service: 'gemini' | 'openai' | 'claude';
    operation: 'contract_generation' | 'content_creation' | 'ai_architect' | 'search' | 'email_campaign';
    tokens_used: number;
    cost: number;
    created_at: string;
}

export interface UsageQuota {
    user_id: string;
    monthly_limit: number;
    current_usage: number;
    cost_limit: number;
    current_cost: number;
    reset_date: string;
}

export interface UsageAlert {
    level: 'warning' | 'critical';
    message: string;
    usage_percentage: number;
    cost_percentage: number;
}

class AIUsageLimitService {
    private readonly DEFAULT_MONTHLY_LIMIT = 1000000; // 1M tokens
    private readonly DEFAULT_COST_LIMIT = 100; // $100

    /**
     * Track AI usage
     */
    async trackUsage(
        userId: string,
        service: AIUsage['service'],
        operation: AIUsage['operation'],
        tokensUsed: number,
        cost: number
    ): Promise<{ success: boolean; alert?: UsageAlert; error?: string }> {
        try {
            // Record usage
            await supabase.from('ai_usage').insert({
                user_id: userId,
                service,
                operation,
                tokens_used: tokensUsed,
                cost,
                created_at: new Date().toISOString(),
            });

            // Update quota
            const quota = await this.getOrCreateQuota(userId);
            const newUsage = quota.current_usage + tokensUsed;
            const newCost = quota.current_cost + cost;

            await supabase
                .from('ai_quotas')
                .update({
                    current_usage: newUsage,
                    current_cost: newCost,
                })
                .eq('user_id', userId);

            // Check for alerts
            const alert = this.checkUsageAlert(quota, tokensUsed, cost);

            // Log if approaching limit
            if (alert) {
                await auditLoggingService.logAction(
                    'ai_usage_alert',
                    'ai_quota',
                    userId,
                    undefined,
                    { alert_level: alert.level, usage_percentage: alert.usage_percentage }
                );
            }

            return { success: true, alert };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Check if user can use AI service
     */
    async canUseAI(userId: string, estimatedTokens: number = 0): Promise<{
        allowed: boolean;
        reason?: string;
        quota?: UsageQuota;
    }> {
        try {
            const quota = await this.getOrCreateQuota(userId);

            // Check token limit
            if (quota.current_usage + estimatedTokens > quota.monthly_limit) {
                return {
                    allowed: false,
                    reason: 'Monthly token limit exceeded',
                    quota,
                };
            }

            // Check cost limit
            if (quota.current_cost >= quota.cost_limit) {
                return {
                    allowed: false,
                    reason: 'Monthly cost limit exceeded',
                    quota,
                };
            }

            return { allowed: true, quota };
        } catch (error) {
            return { allowed: false, reason: 'Error checking quota' };
        }
    }

    /**
     * Get or create user quota
     */
    private async getOrCreateQuota(userId: string): Promise<UsageQuota> {
        try {
            const { data: quota } = await supabase
                .from('ai_quotas')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (quota) {
                // Check if quota needs reset
                const resetDate = new Date(quota.reset_date);
                if (resetDate < new Date()) {
                    return await this.resetQuota(userId);
                }
                return quota;
            }

            // Create new quota
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            const { data: newQuota } = await supabase
                .from('ai_quotas')
                .insert({
                    user_id: userId,
                    monthly_limit: this.DEFAULT_MONTHLY_LIMIT,
                    current_usage: 0,
                    cost_limit: this.DEFAULT_COST_LIMIT,
                    current_cost: 0,
                    reset_date: nextMonth.toISOString(),
                })
                .select()
                .single();

            return newQuota!;
        } catch (error) {
            console.error('Error getting quota:', error);
            throw error;
        }
    }

    /**
     * Reset monthly quota
     */
    private async resetQuota(userId: string): Promise<UsageQuota> {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const { data: quota } = await supabase
            .from('ai_quotas')
            .update({
                current_usage: 0,
                current_cost: 0,
                reset_date: nextMonth.toISOString(),
            })
            .eq('user_id', userId)
            .select()
            .single();

        return quota!;
    }

    /**
     * Check for usage alerts
     */
    private checkUsageAlert(
        quota: UsageQuota,
        additionalTokens: number,
        additionalCost: number
    ): UsageAlert | undefined {
        const newUsage = quota.current_usage + additionalTokens;
        const newCost = quota.current_cost + additionalCost;

        const usagePercentage = (newUsage / quota.monthly_limit) * 100;
        const costPercentage = (newCost / quota.cost_limit) * 100;

        if (usagePercentage >= 90 || costPercentage >= 90) {
            return {
                level: 'critical',
                message: 'You have used 90% of your AI quota. Consider upgrading your plan.',
                usage_percentage: usagePercentage,
                cost_percentage: costPercentage,
            };
        }

        if (usagePercentage >= 75 || costPercentage >= 75) {
            return {
                level: 'warning',
                message: 'You have used 75% of your AI quota.',
                usage_percentage: usagePercentage,
                cost_percentage: costPercentage,
            };
        }

        return undefined;
    }

    /**
     * Get usage statistics
     */
    async getUsageStats(userId: string, days: number = 30): Promise<{
        totalTokens: number;
        totalCost: number;
        byService: Record<string, { tokens: number; cost: number }>;
        byOperation: Record<string, { tokens: number; cost: number }>;
        dailyUsage: { date: string; tokens: number; cost: number }[];
    }> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const { data: usage } = await supabase
                .from('ai_usage')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', startDate.toISOString());

            if (!usage || usage.length === 0) {
                return {
                    totalTokens: 0,
                    totalCost: 0,
                    byService: {},
                    byOperation: {},
                    dailyUsage: [],
                };
            }

            const totalTokens = usage.reduce((sum, u) => sum + u.tokens_used, 0);
            const totalCost = usage.reduce((sum, u) => sum + u.cost, 0);

            // Group by service
            const byService: Record<string, { tokens: number; cost: number }> = {};
            usage.forEach(u => {
                if (!byService[u.service]) {
                    byService[u.service] = { tokens: 0, cost: 0 };
                }
                byService[u.service].tokens += u.tokens_used;
                byService[u.service].cost += u.cost;
            });

            // Group by operation
            const byOperation: Record<string, { tokens: number; cost: number }> = {};
            usage.forEach(u => {
                if (!byOperation[u.operation]) {
                    byOperation[u.operation] = { tokens: 0, cost: 0 };
                }
                byOperation[u.operation].tokens += u.tokens_used;
                byOperation[u.operation].cost += u.cost;
            });

            // Daily usage
            const dailyMap = new Map<string, { tokens: number; cost: number }>();
            usage.forEach(u => {
                const date = new Date(u.created_at).toISOString().split('T')[0];
                if (!dailyMap.has(date)) {
                    dailyMap.set(date, { tokens: 0, cost: 0 });
                }
                const day = dailyMap.get(date)!;
                day.tokens += u.tokens_used;
                day.cost += u.cost;
            });

            const dailyUsage = Array.from(dailyMap.entries()).map(([date, data]) => ({
                date,
                ...data,
            }));

            return {
                totalTokens,
                totalCost,
                byService,
                byOperation,
                dailyUsage,
            };
        } catch (error) {
            console.error('Error getting usage stats:', error);
            return {
                totalTokens: 0,
                totalCost: 0,
                byService: {},
                byOperation: {},
                dailyUsage: [],
            };
        }
    }

    /**
     * Update user quota limits
     */
    async updateQuotaLimits(
        userId: string,
        monthlyLimit?: number,
        costLimit?: number
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const updates: any = {};
            if (monthlyLimit !== undefined) updates.monthly_limit = monthlyLimit;
            if (costLimit !== undefined) updates.cost_limit = costLimit;

            const { error } = await supabase
                .from('ai_quotas')
                .update(updates)
                .eq('user_id', userId);

            if (error) {
                return { success: false, error: error.message };
            }

            await auditLoggingService.logAction(
                'ai_quota_updated',
                'ai_quota',
                userId,
                undefined,
                updates
            );

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get all users approaching limits
     */
    async getUsersApproachingLimits(): Promise<UsageQuota[]> {
        try {
            const { data: quotas } = await supabase
                .from('ai_quotas')
                .select('*')
                .or('current_usage.gte.monthly_limit*0.75,current_cost.gte.cost_limit*0.75');

            return quotas || [];
        } catch (error) {
            console.error('Error fetching users approaching limits:', error);
            return [];
        }
    }
}

export const aiUsageLimitService = new AIUsageLimitService();
