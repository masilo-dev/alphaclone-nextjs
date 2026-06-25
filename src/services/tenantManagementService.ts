import { supabase } from '../lib/supabase';

export interface TenantInfo {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    userCount: number;
    lastActivity?: string;
    subscription?: string;
    settings?: any; // Added to expose calendly status
}

export const tenantManagementService = {
    /**
     * Get all tenants (platform super admin — server-side)
     */
    async getAllTenants(): Promise<{ tenants: TenantInfo[]; error: string | null }> {
        try {
            const res = await fetch('/api/admin/tenants');
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { tenants: [], error: data.error || 'Failed to fetch tenants' };
            }
            return { tenants: data.tenants || [], error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch tenants';
            console.error('Error fetching tenants:', err);
            return { tenants: [], error: message };
        }
    },

    /**
     * Get tenant details with user list
     */
    async getTenantDetails(tenantId: string): Promise<{ tenant: any; error: string | null }> {
        try {
            const { data: tenant, error: tenantError } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', tenantId)
                .single();

            if (tenantError) throw tenantError;

            const { data: users, error: usersError } = await supabase
                .from('tenant_users')
                .select(`
                    *,
                    user:user_id (
                        id,
                        email,
                        name,
                        avatar
                    )
                `)
                .eq('tenant_id', tenantId);

            if (usersError) throw usersError;

            return {
                tenant: {
                    ...tenant,
                    users: users || []
                },
                error: null
            };
        } catch (err: any) {
            console.error('Error fetching tenant details:', err);
            return { tenant: null, error: err.message };
        }
    },

    /**
     * Update tenant status
     */
    async updateTenantStatus(tenantId: string, status: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('tenants')
                .update({ status })
                .eq('id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error updating tenant status:', err);
            return { error: err.message };
        }
    },

    /**
     * Delete tenant (platform super admin — soft delete via server)
     */
    async deleteTenant(tenantId: string): Promise<{ error: string | null }> {
        try {
            const res = await fetch('/api/admin/tenants', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { error: data.error || 'Failed to delete tenant' };
            return { error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to delete tenant';
            console.error('Error deleting tenant:', err);
            return { error: message };
        }
    }
};
