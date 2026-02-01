import { supabase } from '../lib/supabase';

export interface TenantInfo {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    userCount: number;
    lastActivity?: string;
    subscription?: string;
}

export const tenantManagementService = {
    /**
     * Get all tenants (admin only)
     */
    async getAllTenants(): Promise<{ tenants: TenantInfo[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select(`
                    *,
                    tenant_users (count)
                `)
                .is('deletion_pending_at', null)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const tenants = (data || []).map((tenant: any) => ({
                id: tenant.id,
                name: tenant.name,
                status: tenant.status || 'active',
                createdAt: tenant.created_at,
                userCount: tenant.tenant_users?.[0]?.count || 0,
                subscription: tenant.subscription_tier || 'free'
            }));

            return { tenants, error: null };
        } catch (err: any) {
            console.error('Error fetching tenants:', err);
            return { tenants: [], error: err.message };
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
     * Delete tenant (admin only)
     */
    async deleteTenant(tenantId: string): Promise<{ error: string | null }> {
        try {
            // Soft delete for admin as well
            const { error } = await supabase
                .from('tenants')
                .update({
                    deletion_pending_at: new Date().toISOString(),
                    subscription_status: 'suspended'
                })
                .eq('id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error deleting tenant:', err);
            return { error: err.message };
        }
    }
};
