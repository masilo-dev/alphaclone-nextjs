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
        const slugBase = data.slug
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 72) || `org-${data.adminUserId.slice(0, 8)}`;

        const { data: tenantId, error } = await supabase.rpc('create_tenant', {
            p_name: data.name,
            p_slug: slugBase,
            p_admin_user_id: data.adminUserId,
            p_plan: data.plan || 'free'
        });

        if (error) {
            console.error('[TenantService] create_tenant RPC failed:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint,
            });
            throw error;
        }

        const tenant = await this.getTenant(tenantId);
        if (!tenant) throw new Error('Failed to retrieve tenant after creation');

        return tenant;
    }

    /**
     * Get tenant by ID
     */
    async getTenant(tenantId: string): Promise<Tenant | null> {
        // Try with deletion_pending_at filter first (post-migration)
        const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .is('deletion_pending_at', null)
            .single();

        if (!error) return data as Tenant;

        // If the column doesn't exist yet (migration not applied), fall back
        if (error.code === '42703' || error.message?.includes('deletion_pending_at')) {
            const { data: fallback } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', tenantId)
                .single();
            return fallback as Tenant | null;
        }

        return null;
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

        if (!error) return data as Tenant;

        // Column not yet migrated — fall back without the filter
        if (error.code === '42703' || error.message?.includes('deletion_pending_at')) {
            const { data: fallback } = await supabase
                .from('tenants')
                .select('*')
                .eq('slug', slug)
                .maybeSingle();
            return fallback as Tenant | null;
        }

        return null;
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
                const normalized = data
                    .map((row: any) => {
                        const id = row.id || row.tenant_id;
                        const name = row.name || row.tenant_name;
                        const slug = row.slug || row.tenant_slug;
                        const role = row.role || row.user_role;
                        if (!id || !name || !slug) return null;

                        return {
                            ...row,
                            id,
                            name,
                            slug,
                            role: role as TenantRole,
                            joined_at: row.joined_at,
                        };
                    })
                    .filter(Boolean) as Array<Tenant & { role: TenantRole }>;

                if (normalized.length > 0) return normalized;
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

    async getDashboardStats(tenantId: string, userId: string, forceRefresh = false): Promise<{ stats: any | null; error: string | null }> {
        if (!tenantId || !userId) {
            console.warn('getDashboardStats called with missing parameters', { tenantId, userId });
            return { stats: null, error: 'Missing tenant or user ID' };
        }

        // Version key — bump this whenever the RPC schema changes to bust stale caches
        const CACHE_VERSION = 'v4';
        const CACHE_KEY = `dashboard_stats_${tenantId}_${CACHE_VERSION}`;
        const CACHE_TTL = 60_000; // 60 seconds

        // Purge old versioned cache entries
        if (typeof window !== 'undefined') {
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith(`dashboard_stats_${tenantId}`) && key !== CACHE_KEY) {
                    localStorage.removeItem(key);
                }
            }
        }

        if (!forceRefresh) {
            try {
                if (typeof window !== 'undefined') {
                    const cached = localStorage.getItem(CACHE_KEY);
                    if (cached) {
                        const { ts, stats } = JSON.parse(cached);
                        const isAllZero = !stats || (
                            stats.totalRevenue === 0 &&
                            stats.totalLeads === 0 &&
                            stats.clientCount === 0 &&
                            stats.activeProjects === 0
                        );
                        if (Date.now() - ts < CACHE_TTL && !isAllZero) {
                            console.log('[TenantService] Returning cached dashboard stats');
                            // Refresh in background after returning
                            setTimeout(() => this.fetchAndCacheStats(tenantId, userId, CACHE_KEY), 0);
                            return { stats, error: null };
                        }
                    }
                }
            } catch (_) { /* ignore cache read errors */ }
        }

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
            // Prefer server-side API proxy to avoid browser-side CORS/edge issues on direct RPC.
            try {
                const res = await fetch(`/api/dashboard/stats?tenantId=${encodeURIComponent(tenantId)}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' },
                });
                if (res.ok) {
                    const payload = await res.json();
                    const stats = {
                        ...EMPTY_STATS,
                        ...(payload?.stats || {}),
                    };
                    // Only cache if we got meaningful data (not all zeros)
                    const hasData = stats.totalRevenue > 0 || stats.totalLeads > 0 ||
                        stats.clientCount > 0 || stats.activeProjects > 0 ||
                        stats.totalTasks > 0 || stats.unreadMessages > 0;
                    if (hasData) {
                        try {
                            if (typeof window !== 'undefined') {
                                localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), stats }));
                            }
                        } catch (_) { /* ignore cache write errors */ }
                    }
                    return { stats, error: null };
                }
                // Non-OK response (4xx/5xx) — do NOT write to cache, fall through to direct RPC
                console.warn('[TenantService] API stats returned', res.status, '— falling back to direct RPC');
            } catch (_) {
                // Fall back to direct RPC below.
            }

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
                ...EMPTY_STATS,
                ...rpcData,
                totalMessages: rpcData?.totalMessages ?? 0,
            };

            // Cache only non-zero results
            const hasData = stats.totalRevenue > 0 || stats.totalLeads > 0 ||
                stats.clientCount > 0 || stats.activeProjects > 0 ||
                stats.totalTasks > 0;
            if (hasData) {
                try {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), stats }));
                    }
                } catch (_) { /* ignore cache write errors */ }
            }

            return { stats, error: null };
        } catch (err: any) {
            console.error('[TenantService] Error fetching dashboard stats:', err?.message);
            // Return null stats on error — do NOT cache zeros
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
            localStorage.removeItem('currentTenant');
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
