/**
 * Tenant Service - Core API
 * Manages multi-tenant operations
 */

import { supabase } from '../../lib/supabase';
import type {
    Tenant,
    TenantUser,
    TenantInvitation,
    TenantRole,
    SubscriptionPlan
} from './types';

class TenantService {
    private currentTenantId: string | null = null;

    /**
     * Create a new tenant
     */
    async createTenant(data: {
        name: string;
        slug: string;
        adminUserId: string;
        plan?: SubscriptionPlan;
    }): Promise<Tenant> {
        const { data: tenantId, error } = await supabase.rpc('create_tenant', {
            p_name: data.name,
            p_slug: data.slug,
            p_admin_user_id: data.adminUserId,
            p_plan: data.plan || 'free'
        });

        if (error) throw error;

        const tenant = await this.getTenant(tenantId);
        if (!tenant) throw new Error('Failed to create tenant');

        return tenant;
    }

    /**
     * Get tenant by ID
     */
    async getTenant(tenantId: string): Promise<Tenant | null> {
        const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .is('deletion_pending_at', null)
            .single();

        if (error) return null;
        return data as Tenant;
    }

    /**
     * Get tenant by slug
     */
    async getTenantBySlug(slug: string): Promise<Tenant | null> {
        const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('slug', slug)
            .is('deletion_pending_at', null)
            .maybeSingle();

        if (error) return null;
        return data as Tenant;
    }

    /**
     * Update tenant
     */
    async updateTenant(
        tenantId: string,
        updates: Partial<Tenant>
    ): Promise<Tenant> {
        const { data, error } = await supabase
            .from('tenants')
            .update(updates)
            .eq('id', tenantId)
            .select()
            .single();

        if (error) throw error;
        return data as Tenant;
    }

    /**
     * Delete tenant
     */
    async deleteTenant(tenantId: string): Promise<void> {
        // Implement 90-day retention policy (Soft Delete)
        const { error } = await supabase
            .from('tenants')
            .update({
                deletion_pending_at: new Date().toISOString(),
                subscription_status: 'suspended'
            })
            .eq('id', tenantId);

        if (error) throw error;
    }

    /**
     * Get user's tenants
     */
    async getUserTenants(userId: string): Promise<Array<Tenant & { role: TenantRole }>> {
        // Try RPC first
        try {
            const { data, error } = await supabase.rpc('get_user_tenants', {
                p_user_id: userId
            });

            if (!error && data && data.length > 0) {
                return data;
            }

            if (error) {
                console.warn('[TenantService] get_user_tenants RPC failed, falling back to direct query:', error.message);
            }
        } catch (rpcErr: any) {
            console.warn('[TenantService] get_user_tenants RPC threw, falling back:', rpcErr?.message);
        }

        // Fallback: query tenant_users + tenants directly
        try {
            const { data: tuData, error: tuError } = await supabase
                .from('tenant_users')
                .select(`
                    role,
                    joined_at,
                    tenant:tenant_id (
                        id, name, slug, domain, logo_url, settings,
                        subscription_plan, subscription_status, trial_ends_at,
                        created_at, updated_at
                    )
                `)
                .eq('user_id', userId)
                .order('joined_at', { ascending: false });

            if (tuError) {
                console.error('[TenantService] Direct tenant lookup also failed:', tuError.message);
                return [];
            }

            return (tuData || [])
                .filter((row: any) => row.tenant)
                .map((row: any) => ({
                    ...row.tenant,
                    role: row.role as TenantRole,
                    joined_at: row.joined_at
                }));
        } catch (fallbackErr: any) {
            console.error('[TenantService] All tenant lookups failed:', fallbackErr?.message);
            return [];
        }
    }

    /**
     * Add user to tenant
     */
    async addUserToTenant(
        tenantId: string,
        userId: string,
        role: TenantRole = 'member'
    ): Promise<void> {
        await supabase.rpc('add_user_to_tenant', {
            p_tenant_id: tenantId,
            p_user_id: userId,
            p_role: role
        });
    }

    /**
     * Remove user from tenant
     */
    async removeUserFromTenant(tenantId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('tenant_users')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('user_id', userId);

        if (error) throw error;
    }

    /**
     * Update user role in tenant
     */
    async updateUserRole(
        tenantId: string,
        userId: string,
        role: TenantRole
    ): Promise<void> {
        const { error } = await supabase
            .from('tenant_users')
            .update({ role })
            .eq('tenant_id', tenantId)
            .eq('user_id', userId);

        if (error) throw error;
    }

    /**
     * Get tenant users
     */
    async getTenantUsers(tenantId: string): Promise<TenantUser[]> {
        const { data, error } = await supabase
            .from('tenant_users')
            .select('*, profiles(*)')
            .eq('tenant_id', tenantId);

        if (error) throw error;
        return (data || []) as TenantUser[];
    }

    /**
     * Check if user has access to tenant
     */
    async userHasAccess(userId: string, tenantId: string): Promise<boolean> {
        const { data } = await supabase.rpc('user_has_tenant_access', {
            p_user_id: userId,
            p_tenant_id: tenantId
        });

        return data || false;
    }

    /**
     * Create tenant invitation
     */
    async createInvitation(
        tenantId: string,
        email: string,
        role: TenantRole,
        invitedBy: string
    ): Promise<TenantInvitation> {
        const { data: invitationId, error } = await supabase.rpc('create_tenant_invitation', {
            p_tenant_id: tenantId,
            p_email: email,
            p_role: role,
            p_invited_by: invitedBy
        });

        if (error) throw error;

        const { data: invitation } = await supabase
            .from('tenant_invitations')
            .select('*')
            .eq('id', invitationId)
            .single();

        return invitation as TenantInvitation;
    }

    /**
     * Accept tenant invitation
     */
    async acceptInvitation(token: string, userId: string): Promise<void> {
        // Get invitation
        const { data: invitation } = await supabase
            .from('tenant_invitations')
            .select('*')
            .eq('token', token)
            .single();

        if (!invitation) throw new Error('Invalid invitation');
        if (invitation.accepted_at) throw new Error('Invitation already accepted');
        if (new Date(invitation.expires_at) < new Date()) {
            throw new Error('Invitation expired');
        }

        // Add user to tenant
        await this.addUserToTenant(invitation.tenant_id, userId, invitation.role);

        // Mark invitation as accepted
        await supabase
            .from('tenant_invitations')
            .update({ accepted_at: new Date().toISOString() })
            .eq('id', invitation.id);
    }

    /**
     * Track usage metric
     */
    async trackUsage(
        tenantId: string,
        metricName: string,
        increment: number = 1
    ): Promise<void> {
        await supabase.rpc('track_tenant_usage', {
            p_tenant_id: tenantId,
            p_metric_name: metricName,
            p_increment: increment
        });
    }

    /**
     * Get tenant usage
     */
    async getUsage(tenantId: string, metricName?: string): Promise<any[]> {
        let query = supabase
            .from('tenant_usage')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('period_start', { ascending: false });

        if (metricName) {
            query = query.eq('metric_name', metricName);
        }

        const { data } = await query;
        return data || [];
    }

    /**
     * Set current tenant context
     */
    setCurrentTenant(tenant: Tenant | string): void {
        if (typeof tenant === 'string') {
            this.currentTenantId = tenant;
            if (typeof window !== 'undefined') {
                localStorage.setItem('currentTenantId', tenant);
            }
        } else {
            this.currentTenantId = tenant.id;
            if (typeof window !== 'undefined') {
                localStorage.setItem('currentTenantId', tenant.id);
                localStorage.setItem('currentTenant', JSON.stringify(tenant));
            }
        }
    }

    /**
     * Get cached tenant object
     */
    getCachedCurrentTenant(): Tenant | null {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('currentTenant');
            if (stored) {
                try {
                    return JSON.parse(stored);
                } catch (e) {
                    console.error('Failed to parse cached tenant', e);
                }
            }
        }
        return null;
    }

    async getDashboardStats(tenantId: string, userId: string): Promise<{ stats: any | null; error: string | null }> {
        if (!tenantId || !userId) {
            console.warn('getDashboardStats called with missing parameters', { tenantId, userId });
            return { stats: null, error: 'Missing tenant or user ID' };
        }

        // --- Return cached stats immediately if fresh (< 60s old) ---
        const CACHE_KEY = `dashboard_stats_${tenantId}`;
        const CACHE_TTL = 60_000; // 60 seconds
        try {
            if (typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { ts, stats } = JSON.parse(cached);
                    if (Date.now() - ts < CACHE_TTL) {
                        console.log('[TenantService] Returning cached dashboard stats');
                        // Refresh in background after returning
                        setTimeout(() => this.fetchAndCacheStats(tenantId, userId, CACHE_KEY), 0);
                        return { stats, error: null };
                    }
                }
            }
        } catch (_) { /* ignore cache read errors */ }

        return this.fetchAndCacheStats(tenantId, userId, CACHE_KEY);
    }

    private async fetchAndCacheStats(tenantId: string, userId: string, cacheKey: string): Promise<{ stats: any | null; error: string | null }> {
        const EMPTY_STATS = {
            totalRevenue: 0, clientCount: 0, activeProjects: 0,
            pendingInvoices: 0, overdueInvoices: 0, totalMessages: 0, pendingRevenue: 0,
            totalLeads: 0, totalDeals: 0, weightedPipeline: 0, salesForecast: 0,
            recentActivity: [], monthlyRevenue: [], pipeline: {}
        };

        try {
            // Race the optimized RPC against a 20-second timeout
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Stats query timeout')), 20000)
            );

            // Execute the CONSOLIDATED RPC call - fetches everything in one pass
            const { data: rpcData, error: rpcError } = await Promise.race([
                supabase.rpc('get_consolidated_dashboard_stats', { 
                    p_tenant_id: tenantId,
                    p_user_id: userId
                }),
                timeout
            ]) as any;

            if (rpcError) throw rpcError;

            // Map and Enrich the stats from the RPC response
            const stats = {
                ...rpcData,
                totalMessages: 0, // Not yet in RPC
            };

            // Cache the fresh stats
            try {
                if (typeof window !== 'undefined') {
                    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), stats }));
                }
            } catch (_) { /* ignore cache write errors */ }

            return { stats, error: null };
        } catch (err: any) {
            console.error('Error fetching dashboard stats:', err?.message);
            return { stats: EMPTY_STATS, error: err?.message || 'Failed to load stats' };
        }
    }

    /**
     * Get current tenant
     */
    getCurrentTenantId(): string | null {
        if (this.currentTenantId) return this.currentTenantId;

        // Try to load from localStorage
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('currentTenantId');
            if (stored && stored.trim() !== '') return stored;
        }

        return null;
    }

    /**
     * Clear current tenant
     */
    clearCurrentTenant(): void {
        this.currentTenantId = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('currentTenantId');
        }
    }

    /**
     * Update subscription plan
     */
    async updateSubscription(
        tenantId: string,
        plan: SubscriptionPlan,
        status: string = 'active'
    ): Promise<Tenant> {
        const { data, error } = await supabase
            .from('tenants')
            .update({
                subscription_plan: plan,
                subscription_status: status,
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                cancel_at_period_end: false
            })
            .eq('id', tenantId)
            .select()
            .single();

        if (error) throw error;
        return data as Tenant;
    }

    /**
     * Toggle cancel at period end
     */
    async toggleCancelAtPeriodEnd(
        tenantId: string,
        cancelAtPeriodEnd: boolean
    ): Promise<Tenant> {
        const { data, error } = await supabase
            .from('tenants')
            .update({ cancel_at_period_end: cancelAtPeriodEnd })
            .eq('id', tenantId)
            .select()
            .single();

        if (error) throw error;
        return data as Tenant;
    }
}

export const tenantService = new TenantService();
