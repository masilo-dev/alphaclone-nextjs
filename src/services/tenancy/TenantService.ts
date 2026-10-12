/**
 * Tenant Service - Core API
 * Manages multi-tenant operations
 */

import { supabase } from '../../lib/supabase';
import { bootstrapTenantViaApi } from '@/lib/tenant/bootstrapTenantClient';
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

        try {
            const { tenant, error: bootstrapError } = await bootstrapTenantViaApi({
                name: data.name,
                slug: slugBase,
                plan: data.plan || 'free',
                mode: 'create',
                idempotencyKey: crypto.randomUUID(),
            });
            if (tenant?.id) {
                return tenant;
            }
            throw new Error(bootstrapError || 'Workspace creation failed');
        } catch (apiErr) {
            throw apiErr instanceof Error ? apiErr : new Error('Workspace creation failed');
        }
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
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Workspace update failed');
        return payload.tenant as Tenant;
    }

    /**
     * Delete tenant
     */
    async deleteTenant(tenantId: string): Promise<void> {
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}`, { method: 'DELETE' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Workspace deletion could not be scheduled');
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

            if (tuError) throw tuError;

            return (tuData || [])
                .filter((row: any) => row.tenant)
                .map((row: any) => ({
                    ...row.tenant,
                    role: row.role as TenantRole,
                    joined_at: row.joined_at
                }));
        } catch (fallbackErr: any) {
            console.error('[TenantService] All tenant lookups failed:', fallbackErr?.message);
            throw fallbackErr;
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
     * Remove user from tenant. Pass purge=true to permanently delete the account
     * when they only belong to this workspace.
     */
    async removeUserFromTenant(
        tenantId: string,
        userId: string,
        options?: { purge?: boolean }
    ): Promise<{ purged: boolean; message?: string }> {
        const purge = options?.purge ? '&purge=true' : '';
        const response = await fetch(
            `/api/tenant/${encodeURIComponent(tenantId)}/members?userId=${encodeURIComponent(userId)}${purge}`,
            { method: 'DELETE' }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Team member could not be removed');
        return {
            purged: Boolean(payload.purged),
            message: typeof payload.message === 'string' ? payload.message : undefined,
        };
    }

    /**
     * Update user role in tenant
     */
    async updateUserRole(
        tenantId: string,
        userId: string,
        role: TenantRole
    ): Promise<void> {
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/members`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, role }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Team role could not be updated');
    }

    /**
     * Get tenant users
     */
    async getTenantUsers(tenantId: string): Promise<TenantUser[]> {
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/members`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Team members could not be loaded');
        return (payload.members || []) as TenantUser[];
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
        _invitedBy: string
    ): Promise<TenantInvitation> {
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/invitations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Invitation could not be sent');
        return payload.invitation as TenantInvitation;
    }

    /**
     * Accept tenant invitation
     */
    async acceptInvitation(token: string, _userId: string): Promise<void> {
        const response = await fetch('/api/tenant/invitations/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Invitation could not be accepted');
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
        const CACHE_VERSION = 'v5';
        const CACHE_KEY = `dashboard_stats_${tenantId}_${userId}_${CACHE_VERSION}`;
        const CACHE_TTL = 60_000; // 60 seconds

        // Purge old versioned cache entries
        if (typeof window !== 'undefined') {
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith(`dashboard_stats_${tenantId}_${userId}_`) && key !== CACHE_KEY) {
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
                        if (Date.now() - ts < 24 * 60 * 60 * 1000 && !isAllZero) {
                            // Visible immediately; synchronize without blocking the shell.
                            if (Date.now() - ts >= CACHE_TTL) {
                                void this.fetchAndCacheStats(tenantId, userId, CACHE_KEY);
                            }
                            return { stats, error: null };
                        }
                    }
                }
            } catch (_) { /* ignore cache read errors */ }
        }

        return this.fetchAndCacheStats(tenantId, userId, CACHE_KEY);
    }

    private inFlightStatsRequests = new Map<string, Promise<{ stats: any | null; error: string | null }>>();

    private fetchAndCacheStats(tenantId: string, userId: string, cacheKey: string): Promise<{ stats: any | null; error: string | null }> {
        const inFlightKey = `${tenantId}:${userId}`;
        const existing = this.inFlightStatsRequests.get(inFlightKey);
        if (existing) return existing;

        const promise = this.executeFetchAndCacheStats(tenantId, userId, cacheKey).finally(() => {
            this.inFlightStatsRequests.delete(inFlightKey);
        });

        this.inFlightStatsRequests.set(inFlightKey, promise);
        return promise;
    }

    private async executeFetchAndCacheStats(tenantId: string, userId: string, cacheKey: string): Promise<{ stats: any | null; error: string | null }> {
        try {
            const res = await fetch(`/api/dashboard/stats?tenantId=${encodeURIComponent(tenantId)}`, {
                credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store',
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload.stats) {
                return { stats: null, error: payload.error || 'Dashboard data is temporarily unavailable.' };
            }
            const stats = payload.stats;
            try {
                if (typeof window !== 'undefined') localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), stats }));
            } catch { /* Storage restrictions must not discard successful network data. */ }
            return { stats, error: null };
        } catch {
            return { stats: null, error: 'Dashboard data could not be loaded. Check your connection and retry.' };
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
