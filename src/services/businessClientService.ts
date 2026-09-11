import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { requestCrmBridgeSync } from '../lib/crm/crmBridgeClient';

export interface BusinessClient {
    id: string;
    tenantId: string;
    name: string;
    email?: string;
    phone?: string;
    salesStage: 'lead' | 'prospect' | 'customer' | 'lost';
    value: number;
    description?: string;
    location?: string;
    customFields?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    industry?: string;
    website?: string;
    metadata?: Record<string, any>;
    crmContactId?: string | null;
}

export interface ClientsResponse { clients: BusinessClient[]; count: number; error: string | null }
export interface DashboardStats {
    totalRevenue: number;
    clientCount: number;
    activeProjects: number;
    pendingInvoices: number;
    recentActivity: Array<{ type: string; title: string; date: string }>;
    monthlyRevenue: Array<{ month: string; amount: number }>;
    pipeline: Record<string, number>;
}

function mapClient(row: any): BusinessClient {
    return {
        id: row.id, tenantId: row.tenant_id, name: row.name, email: row.email, phone: row.phone,
        salesStage: row.sales_stage, value: Number(row.value || 0), description: row.description,
        location: row.location, customFields: row.custom_fields || {}, createdAt: row.created_at,
        updatedAt: row.updated_at, isActive: row.is_active, industry: row.industry,
        website: row.website, metadata: row.metadata, crmContactId: row.crm_contact_id || null,
    };
}

export const businessClientService = {
    async getClients(tenantId: string, page = 1, limit = 50, showArchived = false, searchTerm = ''): Promise<ClientsResponse> {
        try {
            const offset = (page - 1) * limit;
            let query = supabase.from('business_clients').select('*', { count: 'exact' }).eq('tenant_id', tenantId);
            if (!showArchived) query = query.eq('is_active', true);
            if (searchTerm.trim()) query = query.or(`name.ilike.%${searchTerm.trim()}%,email.ilike.%${searchTerm.trim()}%`);
            const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
            if (error) throw error;
            return { clients: (data || []).map(mapClient), count: count || 0, error: null };
        } catch (error) {
            return { clients: [], count: 0, error: error instanceof Error ? error.message : 'Clients could not be loaded' };
        }
    },

    async getClient(clientId: string): Promise<{ client: BusinessClient | null; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before loading a client');
            const { data, error } = await supabase.from('business_clients').select('*').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle();
            if (error) throw error;
            if (!data) throw new Error('Client not found');
            return { client: mapClient(data), error: null };
        } catch (error) {
            return { client: null, error: error instanceof Error ? error.message : 'Client could not be loaded' };
        }
    },

    async getClientByCrmContactId(crmContactId: string): Promise<{ client: BusinessClient | null; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before loading a client');
            const { data, error } = await supabase
                .from('business_clients')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('crm_contact_id', crmContactId)
                .maybeSingle();
            if (error) throw error;
            if (!data) return { client: null, error: null };
            return { client: mapClient(data), error: null };
        } catch (error) {
            return { client: null, error: error instanceof Error ? error.message : 'Client could not be loaded' };
        }
    },

    async createClient(tenantId: string, client: Partial<BusinessClient>): Promise<{ client: BusinessClient | null; error: string | null }> {
        try {
            const response = await fetch(`/api/tenant/${tenantId}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(client) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.client) throw new Error(payload.error || 'Client could not be created');
            void requestCrmBridgeSync(tenantId, 'client', payload.client.id);
            return { client: mapClient(payload.client), error: null };
        } catch (error) {
            return { client: null, error: error instanceof Error ? error.message : 'Client could not be created' };
        }
    },

    async updateClient(clientId: string, updates: Partial<BusinessClient>): Promise<{ error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before updating a client');
            const response = await fetch(`/api/tenant/${tenantId}/clients`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, ...updates }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Client could not be updated');
            void requestCrmBridgeSync(tenantId, 'client', clientId);
            return { error: null };
        } catch (error) { return { error: error instanceof Error ? error.message : 'Client could not be updated' }; }
    },

    async deleteClient(clientId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before archiving a client');
            const response = await fetch(`/api/tenant/${tenantId}/clients`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [clientId] }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Client could not be archived');
            return { error: null };
        } catch (error) { return { error: error instanceof Error ? error.message : 'Client could not be archived' }; }
    },

    async restoreClient(clientId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before restoring a client');
            const response = await fetch(`/api/tenant/${tenantId}/clients`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, isActive: true }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Client could not be restored');
            return { error: null };
        } catch (error) { return { error: error instanceof Error ? error.message : 'Client could not be restored' }; }
    },

    async getArchivedClients(): Promise<{ clients: BusinessClient[]; error: string | null }> {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return { clients: [], error: 'Select a workspace before loading archived clients' };
        const result = await this.getClients(tenantId, 1, 500, true);
        return { clients: result.clients.filter((item) => !item.isActive), error: result.error };
    },

    async bulkArchiveClients(clientIds: string[]): Promise<{ error: string | null; count: number }> {
        if (!clientIds.length) return { error: null, count: 0 };
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before archiving clients');
            const response = await fetch(`/api/tenant/${tenantId}/clients`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...new Set(clientIds)] }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Clients could not be archived');
            return { error: null, count: Number(payload.count || 0) };
        } catch (error) { return { error: error instanceof Error ? error.message : 'Clients could not be archived', count: 0 }; }
    },

    async importClients(tenantId: string, clients: any[], _quotaUserId?: string): Promise<{ count: number; error: string | null }> {
        if (!clients.length) return { count: 0, error: null };
        try {
            const normalized = clients.map((client) => ({ name: client.name || client.businessName, email: client.email || null, phone: client.phone || null, industry: client.industry || null, location: client.location || null, salesStage: client.salesStage || 'lead', value: Number(client.value || 0), description: client.description || null, customFields: client.customFields || {}, website: client.website || null }));
            const response = await fetch(`/api/tenant/${tenantId}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clients: normalized }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Clients could not be imported');
            return { count: Number(payload.count || 0), error: payload.skipped ? `Imported ${payload.count} contacts. Skipped ${payload.skipped} duplicates.` : null };
        } catch (error) { return { count: 0, error: error instanceof Error ? error.message : 'Clients could not be imported' }; }
    },

    async getUserSignature(userId: string): Promise<string> {
        const { data } = await supabase.from('profiles').select('name, custom_fields').eq('id', userId).maybeSingle();
        return data?.custom_fields?.signature || `\n\nBest regards,\n${data?.name || 'Managing Director'}\nAlphaClone Business OS`;
    },

    async getDashboardStats(tenantId: string): Promise<{ stats: DashboardStats | null; error: string | null }> {
        try {
            const [{ count: totalProjects }, { count: totalClients }, { data: invoices, error }] = await Promise.all([
                supabase.from('projects').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
                supabase.from('business_clients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
                supabase.from('business_invoices').select('status,total').eq('tenant_id', tenantId),
            ]);
            if (error) throw error;
            const rows = invoices || [];
            return { stats: { totalRevenue: rows.filter((item: any) => item.status === 'paid').reduce((sum: number, item: any) => sum + Number(item.total || 0), 0), clientCount: totalClients || 0, activeProjects: totalProjects || 0, pendingInvoices: rows.filter((item: any) => ['sent', 'viewed', 'overdue'].includes(item.status)).length, recentActivity: [], monthlyRevenue: [], pipeline: {} }, error: null };
        } catch (error) { return { stats: null, error: error instanceof Error ? error.message : 'Dashboard statistics could not be loaded' }; }
    },

    /**
     * Client Retention Radar: Calculates client health score (0-100%) based on activity, sales stage, and value.
     */
    calculateClientHealthScore(client: BusinessClient): { score: number; status: 'healthy' | 'at_risk' | 'critical'; reason: string } {
        let score = 50;

        if (client.salesStage === 'customer') score += 30;
        else if (client.salesStage === 'prospect') score += 15;
        else if (client.salesStage === 'lost') score = 10;

        if (client.value > 10000) score += 15;
        else if (client.value > 1000) score += 5;

        if (client.email && client.phone) score += 5;

        const clamped = Math.max(0, Math.min(100, score));
        const status = clamped >= 75 ? 'healthy' : clamped >= 40 ? 'at_risk' : 'critical';
        const reason = status === 'healthy' ? 'Active client with strong value pipeline' : status === 'at_risk' ? 'Moderate activity — check payment or follow-up' : 'High churn risk — action recommended';

        return { score: clamped, status, reason };
    },
};
