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
                if (res.status === 403) {
                    return { tenants: [], error: 'Forbidden — platform super-admin access required' };
                }
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
     * Get tenant details with user list (platform super admin — server-side)
     */
    async getTenantDetails(tenantId: string): Promise<{ tenant: any; error: string | null }> {
        try {
            const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { tenant: null, error: data.error || 'Failed to fetch tenant details' };
            }
            return { tenant: data.tenant || null, error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch tenant details';
            console.error('Error fetching tenant details:', err);
            return { tenant: null, error: message };
        }
    },

    /**
     * Update tenant status (platform super admin — server-side)
     */
    async updateTenantStatus(tenantId: string, status: string): Promise<{ error: string | null }> {
        try {
            const res = await fetch('/api/admin/tenants', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, status }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { error: data.error || 'Failed to update tenant status' };
            return { error: null };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update tenant status';
            console.error('Error updating tenant status:', err);
            return { error: message };
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
