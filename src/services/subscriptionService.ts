import { supabase } from '../lib/supabase';

/**
 * Subscription Management Service
 * Handles upgrades, downgrades, add-ons, and annual billing
 */

export interface UpgradePromptData {
    promptType: 'quota_exceeded' | 'feature_locked' | 'banner' | 'modal' | 'tooltip' | 'in_context';
    triggerFeature: string;
    currentTier: string;
    suggestedTier: string;
    promptLocation?: string;
    metadata?: Record<string, any>;
}

export interface AddonPurchase {
    addonType: 'storage' | 'ai_requests' | 'video_minutes' | 'team_members' | 'api_calls';
    addonName: string;
    quantity: number;
    priceCents: number;
    billingCycle?: 'one_time' | 'monthly' | 'annual';
}

export interface SubscriptionDetails {
    tierName: string;
    billingCycle: 'monthly' | 'annual';
    basePriceCents: number;
    discountPriceCents?: number;
    finalPriceCents: number;
    annualDiscountPercent?: number;
    annualSavingsCents?: number;
}

// Pricing configuration
export const TIER_PRICING = {
    free: {
        monthly: 0,
        annual: 0,
    },
    starter: {
        monthly: 2900, // $29
        annual: 27840, // $232/year (20% discount from $348)
    },
    pro: {
        monthly: 9900, // $99
        annual: 95040, // $792/year (20% discount from $1188)
    },
    enterprise: {
        monthly: 29900, // $299
        annual: 287040, // $2392/year (20% discount from $3588)
    },
};

export const ADDON_PRICING = {
    storage: {
        name: '10GB Extra Storage',
        quantity: 10240, // 10GB in MB
        priceCents: 500, // $5
    },
    ai_requests: {
        name: '100 AI Requests',
        quantity: 100,
        priceCents: 1000, // $10
    },
    video_minutes: {
        name: '500 Video Minutes',
        quantity: 500,
        priceCents: 1500, // $15
    },
    team_members: {
        name: 'Additional Team Member',
        quantity: 1,
        priceCents: 500, // $5/month
        billingCycle: 'monthly' as const,
    },
    api_calls: {
        name: '10,000 API Calls',
        quantity: 10000,
        priceCents: 2000, // $20
    },
};

export const subscriptionService = {
    /**
     * Track when an upgrade prompt is shown
     */
    async trackUpgradePrompt(
        tenantId: string,
        userId: string,
        data: UpgradePromptData
    ): Promise<{ success: boolean; promptId?: string; error?: string }> {
        try {
            const { data: result, error } = await supabase.rpc('track_upgrade_prompt', {
                p_tenant_id: tenantId,
                p_user_id: userId,
                p_prompt_type: data.promptType,
                p_trigger_feature: data.triggerFeature,
                p_current_tier: data.currentTier,
                p_suggested_tier: data.suggestedTier,
                p_prompt_location: data.promptLocation,
                p_metadata: data.metadata || {},
            });

            if (error) throw error;

            return { success: true, promptId: result };
        } catch (error) {
            console.error('Error tracking upgrade prompt:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to track prompt',
            };
        }
    },

    /**
     * Record when user clicks on upgrade prompt
     */
    async recordPromptClick(promptId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase.rpc('record_prompt_click', {
                p_prompt_id: promptId,
            });

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error recording prompt click:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to record click',
            };
        }
    },

    /**
     * Record successful conversion
     */
    async recordConversion(
        promptId: string,
        tenantId: string,
        userId: string,
        fromTier: string,
        toTier: string,
        revenueChangeCents: number
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase.rpc('record_conversion', {
                p_prompt_id: promptId,
                p_tenant_id: tenantId,
                p_user_id: userId,
                p_from_tier: fromTier,
                p_to_tier: toTier,
                p_revenue_change_cents: revenueChangeCents,
            });

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error recording conversion:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to record conversion',
            };
        }
    },

    /**
     * Get pricing for a tier and billing cycle
     */
    getPricing(tier: string, billingCycle: 'monthly' | 'annual'): SubscriptionDetails {
        const tierKey = tier as keyof typeof TIER_PRICING;
        const pricing = TIER_PRICING[tierKey] || TIER_PRICING.starter;

        const basePriceCents = billingCycle === 'monthly' ? pricing.monthly : pricing.monthly * 12;
        const finalPriceCents = billingCycle === 'annual' ? pricing.annual : pricing.monthly;

        const annualDiscountPercent = billingCycle === 'annual' ? 20 : 0;
        const annualSavingsCents = billingCycle === 'annual' ? (basePriceCents - pricing.annual) : 0;

        return {
            tierName: tier,
            billingCycle,
            basePriceCents,
            discountPriceCents: billingCycle === 'annual' ? pricing.annual : undefined,
            finalPriceCents,
            annualDiscountPercent,
            annualSavingsCents,
        };
    },

    /**
     * Calculate savings with annual billing
     */
    calculateAnnualSavings(tier: string): { savingsCents: number; savingsPercent: number } {
        const tierKey = tier as keyof typeof TIER_PRICING;
        const pricing = TIER_PRICING[tierKey] || TIER_PRICING.starter;

        const monthlyTotal = pricing.monthly * 12;
        const annualTotal = pricing.annual;
        const savingsCents = monthlyTotal - annualTotal;
        const savingsPercent = Math.round((savingsCents / monthlyTotal) * 100);

        return { savingsCents, savingsPercent };
    },

    /**
     * Purchase an add-on
     */
    async purchaseAddon(
        tenantId: string,
        addon: AddonPurchase,
        stripeProductId?: string,
        stripePriceId?: string
    ): Promise<{ success: boolean; addonId?: string; error?: string }> {
        try {
            const { data, error } = await supabase.rpc('purchase_addon', {
                p_tenant_id: tenantId,
                p_addon_type: addon.addonType,
                p_addon_name: addon.addonName,
                p_quantity: addon.quantity,
                p_price_cents: addon.priceCents,
                p_billing_cycle: addon.billingCycle || 'one_time',
                p_stripe_product_id: stripeProductId,
                p_stripe_price_id: stripePriceId,
            });

            if (error) throw error;

            return { success: true, addonId: data };
        } catch (error) {
            console.error('Error purchasing addon:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to purchase addon',
            };
        }
    },

    /**
     * Get available add-ons for tenant
     */
    getAvailableAddons() {
        return Object.entries(ADDON_PRICING).map(([type, config]) => ({
            type,
            ...config,
        }));
    },

    /**
     * Get tenant's active add-ons
     */
    async getActiveAddons(tenantId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('subscription_addons')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching active addons:', error);
            return [];
        }
    },

    /**
     * Get conversion metrics
     */
    async getConversionMetrics(startDate?: Date, endDate?: Date) {
        try {
            const { data, error } = await supabase.rpc('get_conversion_metrics', {
                p_start_date: startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                p_end_date: endDate?.toISOString() || new Date().toISOString(),
            });

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error fetching conversion metrics:', error);
            return null;
        }
    },

    /**
     * Get tenant's subscription details
     */
    async getSubscription(tenantId: string) {
        try {
            const { data, error } = await supabase
                .from('tenant_subscriptions')
                .select('*')
                .eq('tenant_id', tenantId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return data;
        } catch (error) {
            console.error('Error fetching subscription:', error);
            return null;
        }
    },

    /**
     * Update subscription to annual billing
     */
    async switchToAnnual(
        tenantId: string,
        tier: string
    ): Promise<{ success: boolean; savingsCents?: number; error?: string }> {
        try {
            const pricing = this.getPricing(tier, 'annual');
            const savings = this.calculateAnnualSavings(tier);

            const { error } = await supabase
                .from('tenant_subscriptions')
                .upsert({
                    tenant_id: tenantId,
                    tier_name: tier,
                    billing_cycle: 'annual',
                    base_price_cents: pricing.basePriceCents,
                    discount_price_cents: pricing.discountPriceCents,
                    final_price_cents: pricing.finalPriceCents,
                    annual_discount_percent: 20,
                    annual_savings_cents: savings.savingsCents,
                    status: 'active',
                });

            if (error) throw error;

            // Record conversion event
            await supabase
                .from('conversion_events')
                .insert({
                    tenant_id: tenantId,
                    user_id: (await supabase.auth.getUser()).data.user?.id,
                    event_type: 'annual_switch',
                    from_tier: tier,
                    to_tier: tier,
                    revenue_change_cents: 0, // No immediate change, but better LTV
                    source: 'settings',
                });

            return { success: true, savingsCents: savings.savingsCents };
        } catch (error) {
            console.error('Error switching to annual:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to switch to annual',
            };
        }
    },

    /**
     * Format price for display
     */
    formatPrice(cents: number, currency: string = 'USD'): string {
        const dollars = cents / 100;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
        }).format(dollars);
    },

    /**
     * Get recommended upgrade tier based on usage
     */
    getRecommendedTier(currentTier: string, usagePercent: number): string | null {
        if (usagePercent < 80) return null; // Not approaching limit

        const tiers = ['free', 'starter', 'pro', 'enterprise'];
        const currentIndex = tiers.indexOf(currentTier);

        if (currentIndex === -1 || currentIndex === tiers.length - 1) {
            return null; // Already on highest tier
        }

        return tiers[currentIndex + 1];
    },
};
