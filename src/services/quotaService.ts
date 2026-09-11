import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface QuotaLimits {
    leadsPerDay: number;
    contractsPerDay: number;
    invoicesPerDay: number;
    receiptsPerDay: number;
}

export interface QuotaUsage {
    leads: number;
    contracts: number;
    invoices: number;
    receipts: number;
    lastReset: string;
}

export interface QuotaCheckResult {
    allowed: boolean;
    currentUsage: number;
    limit: number;
    remaining: number;
    message: string;
}

export const QUOTA_DEFAULTS: QuotaLimits = {
    leadsPerDay: 40,
    contractsPerDay: 4,
    invoicesPerDay: 30,
    receiptsPerDay: 30
};

export const quotaService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string | null {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) {
            console.warn('No active tenant found. Operations may be restricted.');
            return null;
        }
        return tenantId;
    },

    /**
     * Check if user has exceeded daily quota for a specific resource
     */
    async checkQuota(resourceType: 'leads' | 'contracts' | 'invoices' | 'receipts', userId: string): Promise<QuotaCheckResult> {
        try {
            // Validate UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(userId)) {
                console.error('Invalid userId provided to checkQuota:', userId);
                return {
                    allowed: false,
                    currentUsage: 0,
                    limit: 0,
                    remaining: 0,
                    message: 'Authentication internal error'
                };
            }

            const tenantId = this.getTenantId();
            console.log(`Checking quota for ${resourceType}. Tenant: ${tenantId}, User: ${userId}`);
            if (!tenantId) {
                return {
                    allowed: true,
                    currentUsage: 0,
                    limit: 0,
                    remaining: 0,
                    message: 'No tenant configured - unlimited access'
                };
            }

            // Get current usage for today
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            const { data: usageData, error: usageError } = await supabase
                .from('quota_usage')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('user_id', userId)
                .eq('date', today)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (usageError && usageError.code !== 'PGRST116') { // PGRST116 = not found
                console.error('Error checking quota usage:', usageError);
                return {
                    allowed: false,
                    currentUsage: 0,
                    limit: 0,
                    remaining: 0,
                    message: 'Error checking quota'
                };
            }

            // Get tenant's quota limits
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .select('quota_limits')
                .eq('id', tenantId)
                .single();

            if (tenantError) {
                console.error('Error getting tenant quota limits:', tenantError);
                return {
                    allowed: true,
                    currentUsage: 0,
                    limit: QUOTA_DEFAULTS[`${resourceType}PerDay` as keyof QuotaLimits],
                    remaining: QUOTA_DEFAULTS[`${resourceType}PerDay` as keyof QuotaLimits],
                    message: 'Using default limits'
                };
            }

            const limits = tenantData?.quota_limits || QUOTA_DEFAULTS;
            const limit = limits[`${resourceType}PerDay` as keyof QuotaLimits];
            const currentUsage = usageData?.[resourceType] || 0;
            const remaining = Math.max(0, limit - currentUsage);
            const allowed = currentUsage < limit;

            return {
                allowed,
                currentUsage,
                limit,
                remaining,
                message: allowed
                    ? `You have ${remaining} ${resourceType} remaining today`
                    : `Daily limit reached. You can create ${limit} ${resourceType} per day.`
            };

        } catch (error) {
            console.error('Unexpected error in checkQuota:', error);
            return {
                allowed: false,
                currentUsage: 0,
                limit: 0,
                remaining: 0,
                message: 'System error checking quota'
            };
        }
    },

    /**
     * Increment quota usage for a specific resource
     */
    async incrementQuota(resourceType: 'leads' | 'contracts' | 'invoices' | 'receipts', userId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const tenantId = this.getTenantId();
            if (!tenantId) {
                return { success: true }; // No tenant = unlimited
            }

            const today = new Date().toISOString().split('T')[0];
            console.log(`Incrementing quota for ${resourceType}. Tenant: ${this.getTenantId()}, User: ${userId}`);

            // Check quota first
            const quotaCheck = await this.checkQuota(resourceType, userId);
            if (!quotaCheck.allowed) {
                return {
                    success: false,
                    error: quotaCheck.message
                };
            }

            // Increment usage
            const { data: existingUsage, error: fetchError } = await supabase
                .from('quota_usage')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('user_id', userId)
                .eq('date', today)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error fetching existing usage:', fetchError);
                return { success: false, error: 'Failed to update quota' };
            }

            if (existingUsage) {
                // Update existing record
                const newCount = (existingUsage[resourceType] || 0) + 1;
                const { error: updateError } = await supabase
                    .from('quota_usage')
                    .update({ [resourceType]: newCount })
                    .eq('id', existingUsage.id);

                if (updateError) {
                    console.error('Error updating quota usage:', updateError);
                    return { success: false, error: 'Failed to update quota' };
                }
            } else {
                // Create new record
                const { error: insertError } = await supabase
                    .from('quota_usage')
                    .insert({
                        tenant_id: tenantId,
                        user_id: userId,
                        date: today,
                        [resourceType]: 1,
                        leads: 0,
                        contracts: 0,
                        invoices: 0,
                        receipts: 0
                    });

                if (insertError) {
                    console.error('Error creating quota usage record:', insertError);
                    return { success: false, error: 'Failed to create quota record' };
                }
            }

            return { success: true };

        } catch (error) {
            console.error('Unexpected error in incrementQuota:', error);
            return { success: false, error: 'System error updating quota' };
        }
    },

    /**
     * Get current quota usage for all resources
     */
    async getQuotaUsage(userId: string): Promise<QuotaUsage> {
        try {
            const tenantId = this.getTenantId();
            if (!tenantId) {
                return {
                    leads: 0,
                    contracts: 0,
                    invoices: 0,
                    receipts: 0,
                    lastReset: new Date().toISOString()
                };
            }

            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('quota_usage')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('user_id', userId)
                .eq('date', today)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                console.error('Error getting quota usage:', error);
            }

            return {
                leads: data?.leads || 0,
                contracts: data?.contracts || 0,
                invoices: data?.invoices || 0,
                receipts: data?.receipts || 0,
                lastReset: data?.created_at || new Date().toISOString()
            };

        } catch (error) {
            console.error('Unexpected error in getQuotaUsage:', error);
            return {
                leads: 0,
                contracts: 0,
                invoices: 0,
                receipts: 0,
                lastReset: new Date().toISOString()
            };
        }
    },

    /**
     * Reset quota usage for a specific user (admin function)
     */
    async resetQuotaUsage(userId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const tenantId = this.getTenantId();
            if (!tenantId) {
                return { success: false, error: 'No tenant configured' };
            }

            const today = new Date().toISOString().split('T')[0];
            const { error } = await supabase
                .from('quota_usage')
                .delete()
                .eq('tenant_id', tenantId)
                .eq('user_id', userId)
                .eq('date', today);

            if (error) {
                console.error('Error resetting quota usage:', error);
                return { success: false, error: 'Failed to reset quota' };
            }

            return { success: true };

        } catch (error) {
            console.error('Unexpected error in resetQuotaUsage:', error);
            return { success: false, error: 'System error resetting quota' };
        }
    },

    /**
     * Update tenant quota limits (admin function)
     */
    async updateQuotaLimits(limits: Partial<QuotaLimits>): Promise<{ success: boolean; error?: string }> {
        try {
            const tenantId = this.getTenantId();
            if (!tenantId) {
                return { success: false, error: 'No tenant configured' };
            }

            // Get current limits
            const { data: currentData, error: fetchError } = await supabase
                .from('tenants')
                .select('quota_limits')
                .eq('id', tenantId)
                .single();

            if (fetchError) {
                console.error('Error fetching current quota limits:', fetchError);
                return { success: false, error: 'Failed to fetch current limits' };
            }

            const currentLimits = currentData?.quota_limits || QUOTA_DEFAULTS;
            const updatedLimits = { ...currentLimits, ...limits };

            const { error: updateError } = await supabase
                .from('tenants')
                .update({ quota_limits: updatedLimits })
                .eq('id', tenantId);

            if (updateError) {
                console.error('Error updating quota limits:', updateError);
                return { success: false, error: 'Failed to update quota limits' };
            }

            return { success: true };

        } catch (error) {
            console.error('Unexpected error in updateQuotaLimits:', error);
            return { success: false, error: 'System error updating quota limits' };
        }
    }
};