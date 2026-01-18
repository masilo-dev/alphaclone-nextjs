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
            .single();

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
        const { error } = await supabase
            .from('tenants')
            .delete()
            .eq('id', tenantId);

        if (error) throw error;
    }

    /**
     * Get user's tenants
     */
    async getUserTenants(userId: string): Promise<Array<Tenant & { role: TenantRole }>> {
        const { data, error } = await supabase.rpc('get_user_tenants', {
            p_user_id: userId
        });

        if (error) throw error;
        return data || [];
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
            .select('*, users(*)')
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
    setCurrentTenant(tenantId: string): void {
        this.currentTenantId = tenantId;
        // Store in localStorage for persistence
        if (typeof window !== 'undefined') {
            localStorage.setItem('currentTenantId', tenantId);
        }
    }

    /**
     * Get current tenant
     */
    getCurrentTenantId(): string | null {
        if (this.currentTenantId) return this.currentTenantId;

        // Try to load from localStorage
        if (typeof window !== 'undefined') {
            return localStorage.getItem('currentTenantId');
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
}

export const tenantService = new TenantService();
