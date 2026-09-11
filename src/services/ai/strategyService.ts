import { createSupabaseAdminClient } from '../../lib/supabase-admin';

export interface BusinessStrategy {
    id: string;
    tenant_id: string;
    month: number;
    year: number;
    theme_title: string;
    focus_topics: string[];
    brand_voice: string;
    prohibited_elements: string[];
}

/**
 * Strategy Service
 * 
 * Manages and retrieves the "Monthly Focus" for autonomous AI workers.
 */
class StrategyService {
    /**
     * Get the active strategy for a tenant for the current month/year.
     * Fallback to a default if none exists.
     */
    async getActiveStrategy(tenantId: string): Promise<BusinessStrategy> {
        const admin = createSupabaseAdminClient();
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const { data, error } = await admin
            .from('business_strategy')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('month', month)
            .eq('year', year)
            .maybeSingle();

        if (error || !data) {
            // Return Default Strategy if none defined
            return {
                id: 'default',
                tenant_id: tenantId,
                month,
                year,
                theme_title: 'Scale & Authority',
                focus_topics: ['Market Leadership', 'Operational Excellence', 'Innovation'],
                brand_voice: 'Professional, authoritative, article-style',
                prohibited_elements: ['emojis', 'informal jargon']
            };
        }

        return data as BusinessStrategy;
    }

    /**
     * Create or update strategy for a month
     */
    async upsertStrategy(tenantId: string, strategy: Partial<BusinessStrategy>) {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin
            .from('business_strategy')
            .upsert({
                tenant_id: tenantId,
                month: strategy.month || new Date().getMonth() + 1,
                year: strategy.year || new Date().getFullYear(),
                theme_title: strategy.theme_title || 'Autonomous Growth',
                focus_topics: strategy.focus_topics || [],
                brand_voice: strategy.brand_voice || 'Professional',
                prohibited_elements: strategy.prohibited_elements || []
            }, { onConflict: 'tenant_id, month, year' })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

export const strategyService = new StrategyService();
