import { supabase } from '../lib/supabase';
import { activityService } from './activityService';
import { tenantService } from './tenancy/TenantService';

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export type DealSource = 'referral' | 'website' | 'cold_outreach' | 'social_media' | 'event' | 'partner' | 'organic' | 'other';

export interface Deal {
    id: string;
    name: string;
    contactId?: string;
    projectId?: string;
    ownerId?: string;
    value?: number;
    currency: string;
    stage: DealStage;
    probability: number;
    expectedCloseDate?: string;
    actualCloseDate?: string;
    source?: DealSource;
    sourceDetails?: string;
    competitorInfo?: string;
    nextStep?: string;
    description?: string;
    tags?: string[];
    customFields?: any;
    lostReason?: string;
    wonDetails?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}

export interface DealActivity {
    id: string;
    dealId: string;
    userId: string;
    activityType: string;
    title: string;
    description?: string;
    durationMinutes?: number;
    outcome?: string;
    nextAction?: string;
    metadata?: any;
    createdAt: string;
    userName?: string;
    userAvatar?: string;
}

export interface DealProduct {
    id: string;
    dealId: string;
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxPercent: number;
    total: number;
    metadata?: any;
    createdAt: string;
}

export interface CreateDealInput {
    name: string;
    contactId?: string;
    projectId?: string;
    ownerId?: string;
    value?: number;
    currency?: string;
    stage?: DealStage;
    probability?: number;
    expectedCloseDate?: string;
    source?: DealSource;
    sourceDetails?: string;
    nextStep?: string;
    description?: string;
    tags?: string[];
    metadata?: any;
}

export interface PipelineStats {
    stage: DealStage;
    dealCount: number;
    totalValue: number;
}

export interface DealService {
    getTenantId(): string;
    getDeals(filters?: {
        ownerId?: string;
        stage?: DealStage;
        contactId?: string;
        limit?: number;
    }): Promise<{ deals: Deal[]; error: string | null }>;
    getDealById(dealId: string): Promise<{ deal: Deal | null; error: string | null }>;
    createDeal(userId: string, dealData: CreateDealInput): Promise<{ deal: Deal | null; error: string | null }>;
    updateDeal(dealId: string, updates: Partial<Deal>): Promise<{ deal: Deal | null; error: string | null }>;
    deleteDeal(dealId: string): Promise<{ success: boolean; error: string | null }>;
    getDealActivities(dealId: string): Promise<{ activities: DealActivity[]; error: string | null }>;
    addDealActivity(
        dealId: string,
        userId: string,
        activityType: string,
        title: string,
        options?: {
            description?: string;
            durationMinutes?: number;
            outcome?: string;
            nextAction?: string;
            metadata?: any;
        }
    ): Promise<{ activity: DealActivity | null; error: string | null }>;
    getDealProducts(dealId: string): Promise<{ products: DealProduct[]; error: string | null }>;
    addDealProduct(
        dealId: string,
        productData: {
            productName: string;
            description?: string;
            quantity: number;
            unitPrice: number;
            discountPercent?: number;
            taxPercent?: number;
        }
    ): Promise<{ product: DealProduct | null; error: string | null }>;
    deleteDealProduct(productId: string): Promise<{ success: boolean; error: string | null }>;
    getPipelineStats(ownerId?: string): Promise<{ stats: PipelineStats[]; error: string | null }>;
    getWeightedPipelineValue(ownerId?: string): Promise<{ value: number; error: string | null }>;
    getWinRate(
        startDate?: string,
        endDate?: string,
        ownerId?: string
    ): Promise<{ winRate: number; totalWon: number; totalLost: number; error: string | null }>;
    getSalesForecast(months?: number): Promise<{ forecast: any[]; error: string | null }>;
    getWinLossTrends(months?: number): Promise<{ trends: any[]; error: string | null }>;
}

export const dealService: DealService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get all deals with optional filters
     */
    async getDeals(filters?: {
        ownerId?: string;
        stage?: DealStage;
        contactId?: string;
        limit?: number;
    }): Promise<{ deals: Deal[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('deals')
                .select('*')
                .eq('tenant_id', tenantId); // ← TENANT FILTER

            if (filters?.ownerId) {
                query = query.eq('owner_id', filters.ownerId);
            }
            if (filters?.stage) {
                query = query.eq('stage', filters.stage);
            }
            if (filters?.contactId) {
                query = query.eq('contact_id', filters.contactId);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(filters?.limit || 100);

            if (error) throw error;

            const deals: Deal[] = (data || []).map((d: any) => ({
                id: d.id,
                name: d.name,
                contactId: d.contact_id,
                projectId: d.project_id,
                ownerId: d.owner_id,
                value: d.value,
                currency: d.currency,
                stage: d.stage,
                probability: d.probability,
                expectedCloseDate: d.expected_close_date,
                actualCloseDate: d.actual_close_date,
                source: d.source,
                sourceDetails: d.source_details,
                competitorInfo: d.competitor_info,
                nextStep: d.next_step,
                description: d.description,
                tags: d.tags || [],
                customFields: d.custom_fields || {},
                lostReason: d.lost_reason,
                wonDetails: d.won_details,
                metadata: d.metadata || {},
                createdAt: d.created_at,
                updatedAt: d.updated_at,
            }));

            return { deals, error: null };
        } catch (err) {
            return { deals: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get a single deal by ID
     */
    async getDealById(dealId: string): Promise<{ deal: Deal | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('deals')
                .select('*')
                .eq('id', dealId)
                .eq('tenant_id', tenantId) // ← VERIFY TENANT OWNERSHIP
                .single();

            if (error) throw error;

            const deal: Deal = {
                id: data.id,
                name: data.name,
                contactId: data.contact_id,
                projectId: data.project_id,
                ownerId: data.owner_id,
                value: data.value,
                currency: data.currency,
                stage: data.stage,
                probability: data.probability,
                expectedCloseDate: data.expected_close_date,
                actualCloseDate: data.actual_close_date,
                source: data.source,
                sourceDetails: data.source_details,
                competitorInfo: data.competitor_info,
                nextStep: data.next_step,
                description: data.description,
                tags: data.tags || [],
                customFields: data.custom_fields || {},
                lostReason: data.lost_reason,
                wonDetails: data.won_details,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { deal, error: null };
        } catch (err) {
            return { deal: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create a new deal
     */
    async createDeal(userId: string, dealData: CreateDealInput): Promise<{ deal: Deal | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('deals')
                .insert({
                    tenant_id: tenantId, // ← ASSIGN TO TENANT
                    name: dealData.name,
                    contact_id: dealData.contactId,
                    project_id: dealData.projectId,
                    owner_id: dealData.ownerId || userId,
                    value: dealData.value,
                    currency: dealData.currency || 'USD',
                    stage: dealData.stage || 'lead',
                    probability: dealData.probability || 0,
                    expected_close_date: dealData.expectedCloseDate,
                    source: dealData.source,
                    source_details: dealData.sourceDetails,
                    next_step: dealData.nextStep,
                    description: dealData.description,
                    tags: dealData.tags || [],
                    metadata: dealData.metadata || {},
                })
                .select()
                .single();

            if (error) throw error;

            // Log activity
            await activityService.logActivity(userId, 'Deal Created', {
                dealId: data.id,
                dealName: dealData.name,
                dealValue: dealData.value,
            });

            const deal: Deal = {
                id: data.id,
                name: data.name,
                contactId: data.contact_id,
                projectId: data.project_id,
                ownerId: data.owner_id,
                value: data.value,
                currency: data.currency,
                stage: data.stage,
                probability: data.probability,
                expectedCloseDate: data.expected_close_date,
                actualCloseDate: data.actual_close_date,
                source: data.source,
                sourceDetails: data.source_details,
                competitorInfo: data.competitor_info,
                nextStep: data.next_step,
                description: data.description,
                tags: data.tags || [],
                customFields: data.custom_fields || {},
                lostReason: data.lost_reason,
                wonDetails: data.won_details,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { deal, error: null };
        } catch (err) {
            return { deal: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update a deal
     */
    async updateDeal(dealId: string, updates: Partial<Deal>): Promise<{ deal: Deal | null; error: string | null }> {
        try {
            const updateData: any = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.contactId !== undefined) updateData.contact_id = updates.contactId;
            if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
            if (updates.ownerId !== undefined) updateData.owner_id = updates.ownerId;
            if (updates.value !== undefined) updateData.value = updates.value;
            if (updates.currency !== undefined) updateData.currency = updates.currency;
            if (updates.stage !== undefined) updateData.stage = updates.stage;
            if (updates.probability !== undefined) updateData.probability = updates.probability;
            if (updates.expectedCloseDate !== undefined) updateData.expected_close_date = updates.expectedCloseDate;
            if (updates.source !== undefined) updateData.source = updates.source;
            if (updates.sourceDetails !== undefined) updateData.source_details = updates.sourceDetails;
            if (updates.competitorInfo !== undefined) updateData.competitor_info = updates.competitorInfo;
            if (updates.nextStep !== undefined) updateData.next_step = updates.nextStep;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.tags !== undefined) updateData.tags = updates.tags;
            if (updates.customFields !== undefined) updateData.custom_fields = updates.customFields;
            if (updates.lostReason !== undefined) updateData.lost_reason = updates.lostReason;
            if (updates.wonDetails !== undefined) updateData.won_details = updates.wonDetails;
            if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

            // Auto-set actual_close_date when deal is won or lost
            if ((updates.stage === 'closed_won' || updates.stage === 'closed_lost') && !updates.actualCloseDate) {
                updateData.actual_close_date = new Date().toISOString().split('T')[0];
            }

            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('deals')
                .update(updateData)
                .eq('id', dealId)
                .eq('tenant_id', tenantId) // ← VERIFY OWNERSHIP
                .select()
                .single();

            if (error) throw error;

            const deal: Deal = {
                id: data.id,
                name: data.name,
                contactId: data.contact_id,
                projectId: data.project_id,
                ownerId: data.owner_id,
                value: data.value,
                currency: data.currency,
                stage: data.stage,
                probability: data.probability,
                expectedCloseDate: data.expected_close_date,
                actualCloseDate: data.actual_close_date,
                source: data.source,
                sourceDetails: data.source_details,
                competitorInfo: data.competitor_info,
                nextStep: data.next_step,
                description: data.description,
                tags: data.tags || [],
                customFields: data.custom_fields || {},
                lostReason: data.lost_reason,
                wonDetails: data.won_details,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { deal, error: null };
        } catch (err) {
            return { deal: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete a deal
     */
    async deleteDeal(dealId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { error } = await supabase
                .from('deals')
                .delete()
                .eq('id', dealId)
                .eq('tenant_id', tenantId); // ← VERIFY OWNERSHIP

            if (error) throw error;

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get deal activities
     */
    async getDealActivities(dealId: string): Promise<{ activities: DealActivity[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('deal_activities')
                .select(`
                    *,
                    profiles:user_id (
                        name,
                        avatar_url
                    )
                `)
                .eq('deal_id', dealId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const activities: DealActivity[] = (data || []).map((a: any) => ({
                id: a.id,
                dealId: a.deal_id,
                userId: a.user_id,
                activityType: a.activity_type,
                title: a.title,
                description: a.description,
                durationMinutes: a.duration_minutes,
                outcome: a.outcome,
                nextAction: a.next_action,
                metadata: a.metadata || {},
                createdAt: a.created_at,
                userName: a.profiles?.name,
                userAvatar: a.profiles?.avatar_url,
            }));

            return { activities, error: null };
        } catch (err) {
            return { activities: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Add activity to a deal
     */
    async addDealActivity(
        dealId: string,
        userId: string,
        activityType: string,
        title: string,
        options?: {
            description?: string;
            durationMinutes?: number;
            outcome?: string;
            nextAction?: string;
            metadata?: any;
        }
    ): Promise<{ activity: DealActivity | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('deal_activities')
                .insert({
                    deal_id: dealId,
                    user_id: userId,
                    activity_type: activityType,
                    title,
                    description: options?.description,
                    duration_minutes: options?.durationMinutes,
                    outcome: options?.outcome,
                    next_action: options?.nextAction,
                    metadata: options?.metadata || {},
                })
                .select()
                .single();

            if (error) throw error;

            const activity: DealActivity = {
                id: data.id,
                dealId: data.deal_id,
                userId: data.user_id,
                activityType: data.activity_type,
                title: data.title,
                description: data.description,
                durationMinutes: data.duration_minutes,
                outcome: data.outcome,
                nextAction: data.next_action,
                metadata: data.metadata || {},
                createdAt: data.created_at,
            };

            return { activity, error: null };
        } catch (err) {
            return { activity: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get deal products
     */
    async getDealProducts(dealId: string): Promise<{ products: DealProduct[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('deal_products')
                .select('*')
                .eq('deal_id', dealId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const products: DealProduct[] = (data || []).map((p: any) => ({
                id: p.id,
                dealId: p.deal_id,
                productName: p.product_name,
                description: p.description,
                quantity: p.quantity,
                unitPrice: p.unit_price,
                discountPercent: p.discount_percent,
                taxPercent: p.tax_percent,
                total: p.total,
                metadata: p.metadata || {},
                createdAt: p.created_at,
            }));

            return { products, error: null };
        } catch (err) {
            return { products: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Add product to deal
     */
    async addDealProduct(
        dealId: string,
        productData: {
            productName: string;
            description?: string;
            quantity: number;
            unitPrice: number;
            discountPercent?: number;
            taxPercent?: number;
        }
    ): Promise<{ product: DealProduct | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('deal_products')
                .insert({
                    deal_id: dealId,
                    product_name: productData.productName,
                    description: productData.description,
                    quantity: productData.quantity,
                    unit_price: productData.unitPrice,
                    discount_percent: productData.discountPercent || 0,
                    tax_percent: productData.taxPercent || 0,
                })
                .select()
                .single();

            if (error) throw error;

            const product: DealProduct = {
                id: data.id,
                dealId: data.deal_id,
                productName: data.product_name,
                description: data.description,
                quantity: data.quantity,
                unitPrice: data.unit_price,
                discountPercent: data.discount_percent,
                taxPercent: data.tax_percent,
                total: data.total,
                metadata: data.metadata || {},
                createdAt: data.created_at,
            };

            return { product, error: null };
        } catch (err) {
            return { product: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete deal product
     */
    async deleteDealProduct(productId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('deal_products').delete().eq('id', productId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get pipeline statistics
     */
    async getPipelineStats(ownerId?: string): Promise<{ stats: PipelineStats[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('deals')
                .select('stage, value')
                .eq('tenant_id', tenantId) // ← TENANT FILTER
                .not('stage', 'in', '(closed_won,closed_lost)');

            if (ownerId) {
                query = query.eq('owner_id', ownerId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Group by stage
            const statsMap = new Map<DealStage, { count: number; total: number }>();
            const stages: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation'];

            stages.forEach((stage) => {
                statsMap.set(stage, { count: 0, total: 0 });
            });

            (data || []).forEach((deal: any) => {
                const stage = deal.stage as DealStage;
                const current = statsMap.get(stage) || { count: 0, total: 0 };
                statsMap.set(stage, {
                    count: current.count + 1,
                    total: current.total + (deal.value || 0),
                });
            });

            const stats: PipelineStats[] = Array.from(statsMap.entries()).map(([stage, data]) => ({
                stage,
                dealCount: data.count,
                totalValue: data.total,
            }));

            return { stats, error: null };
        } catch (err) {
            return { stats: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get weighted pipeline value
     */
    async getWeightedPipelineValue(ownerId?: string): Promise<{ value: number; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('deals')
                .select('value, probability')
                .eq('tenant_id', tenantId) // ← TENANT FILTER
                .not('stage', 'in', '(closed_won,closed_lost)');

            if (ownerId) {
                query = query.eq('owner_id', ownerId);
            }

            const { data, error } = await query;

            if (error) throw error;

            const weightedValue = (data || []).reduce((sum: number, deal: any) => {
                return sum + ((deal.value || 0) * (deal.probability || 0)) / 100;
            }, 0);

            return { value: weightedValue, error: null };
        } catch (err) {
            return { value: 0, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get win rate
     */
    async getWinRate(
        startDate?: string,
        endDate?: string,
        ownerId?: string
    ): Promise<{ winRate: number; totalWon: number; totalLost: number; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('deals')
                .select('stage, actual_close_date')
                .eq('tenant_id', tenantId)
                .in('stage', ['closed_won', 'closed_lost']);

            if (startDate) {
                query = query.gte('actual_close_date', startDate);
            }
            if (endDate) {
                query = query.lte('actual_close_date', endDate);
            }
            if (ownerId) {
                query = query.eq('owner_id', ownerId);
            }

            const { data, error } = await query;

            if (error) throw error;

            const totalWon = (data || []).filter((d: any) => d.stage === 'closed_won').length;
            const totalLost = (data || []).filter((d: any) => d.stage === 'closed_lost').length;
            const total = totalWon + totalLost;

            const winRate = total > 0 ? (totalWon / total) * 100 : 0;

            return { winRate, totalWon, totalLost, error: null };
        } catch (err) {
            return { winRate: 0, totalWon: 0, totalLost: 0, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get sales forecast (weighted value by month)
     */
    async getSalesForecast(months: number = 6): Promise<{ forecast: any[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('deals')
                .select('value, probability, expected_close_date')
                .eq('tenant_id', tenantId)
                .not('stage', 'in', '(closed_won,closed_lost)')
                .not('expected_close_date', 'is', null);

            if (error) throw error;

            const forecastMap = new Map<string, number>();
            const now = new Date();

            (data || []).forEach((deal: any) => {
                const closeDate = new Date(deal.expected_close_date);
                const month = closeDate.toLocaleString('default', { month: 'short', year: 'numeric' });
                const weightedValue = ((deal.value || 0) * (deal.probability || 0)) / 100;

                forecastMap.set(month, (forecastMap.get(month) || 0) + weightedValue);
            });

            const forecast = Array.from(forecastMap.entries()).map(([month, value]) => ({
                month,
                value,
            }));

            return { forecast, error: null };
        } catch (err) {
            return { forecast: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get win/loss trends over time
     */
    async getWinLossTrends(months: number = 6): Promise<{ trends: any[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('deals')
                .select('stage, actual_close_date')
                .eq('tenant_id', tenantId)
                .in('stage', ['closed_won', 'closed_lost'])
                .not('actual_close_date', 'is', null);

            if (error) throw error;

            const trendsMap = new Map<string, { won: number; lost: number }>();

            (data || []).forEach((deal: any) => {
                const date = new Date(deal.actual_close_date);
                const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                const current = trendsMap.get(month) || { won: 0, lost: 0 };

                if (deal.stage === 'closed_won') {
                    current.won += 1;
                } else {
                    current.lost += 1;
                }
                trendsMap.set(month, current);
            });

            const trends = Array.from(trendsMap.entries()).map(([month, data]) => ({
                month,
                won: data.won,
                lost: data.lost,
            }));

            return { trends, error: null };
        } catch (err) {
            return { trends: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};
