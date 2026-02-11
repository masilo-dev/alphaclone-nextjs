import { supabase } from '../lib/supabase';

export interface ClientLifecycleSummary {
    clientId: string;
    activeProjects: number;
    totalProjects: number;
    activeDeals: number;
    totalInvoices: number;
    paidInvoices: number;
    totalRevenue: number;
    hasSignedContract: boolean;
    lastActivity: string | null;
}

class ClientLifecycleService {
    /**
     * Get a consolidated lifecycle summary for a specific client within a tenant
     */
    async getClientLifecycleSummary(clientId: string, tenantId: string): Promise<{ summary: ClientLifecycleSummary | null; error: string | null }> {
        try {
            const [projectsRes, invoicesRes, contractsRes, activityRes] = await Promise.all([
                supabase
                    .from('projects')
                    .select('id, status, budget')
                    .eq('client_id', clientId)
                    .eq('tenant_id', tenantId),
                supabase
                    .from('business_invoices')
                    .select('id, status, total')
                    .eq('client_id', clientId)
                    .eq('tenant_id', tenantId),
                supabase
                    .from('contracts')
                    .select('id, status')
                    .eq('client_id', clientId)
                    .eq('tenant_id', tenantId)
                    .eq('status', 'signed')
                    .limit(1),
                supabase
                    .from('activity_log')
                    .select('created_at')
                    .eq('user_id', clientId)
                    .order('created_at', { ascending: false })
                    .limit(1)
            ]);

            const projects = projectsRes.data || [];
            const invoices = invoicesRes.data || [];

            const summary: ClientLifecycleSummary = {
                clientId,
                activeProjects: projects.filter((p: any) => ['Active', 'in_progress', 'todo', 'review'].includes(p.status)).length,
                totalProjects: projects.length,
                activeDeals: 0, // Would link to deals table if needed
                totalInvoices: invoices.length,
                paidInvoices: invoices.filter((inv: any) => inv.status === 'paid').length,
                totalRevenue: invoices.filter((inv: any) => inv.status === 'paid').reduce((sum: number, inv: any) => sum + (inv.total || 0), 0),
                hasSignedContract: (contractsRes.data || []).length > 0,
                lastActivity: activityRes.data?.[0]?.created_at || null
            };

            return { summary, error: null };
        } catch (err: any) {
            console.error('Error in getClientLifecycleSummary:', err);
            return { summary: null, error: err.message };
        }
    }

    /**
     * Bulk fetch summaries for multiple clients to avoid N+1 issues in directory views
     */
    async bulkGetClientLifecycleSummaries(clientIds: string[], tenantId: string): Promise<Record<string, ClientLifecycleSummary>> {
        const results: Record<string, ClientLifecycleSummary> = {};

        // For directory performance, we fetch all relevant data in chunks and aggregate in memory
        const [projectsRes, invoicesRes] = await Promise.all([
            supabase
                .from('projects')
                .select('id, client_id, status, budget')
                .in('client_id', clientIds)
                .eq('tenant_id', tenantId),
            supabase
                .from('business_invoices')
                .select('id, client_id, status, total')
                .in('client_id', clientIds)
                .eq('tenant_id', tenantId)
        ]);

        const allProjects = projectsRes.data || [];
        const allInvoices = invoicesRes.data || [];

        clientIds.forEach(clientId => {
            const clientProjects = allProjects.filter((p: any) => p.client_id === clientId);
            const clientInvoices = allInvoices.filter((inv: any) => inv.client_id === clientId);

            results[clientId] = {
                clientId,
                activeProjects: clientProjects.filter((p: any) => ['Active', 'in_progress', 'todo', 'review'].includes(p.status)).length,
                totalProjects: clientProjects.length,
                activeDeals: 0,
                totalInvoices: clientInvoices.length,
                paidInvoices: clientInvoices.filter((inv: any) => inv.status === 'paid').length,
                totalRevenue: clientInvoices.filter((inv: any) => inv.status === 'paid').reduce((sum: number, inv: any) => sum + (inv.total || 0), 0),
                hasSignedContract: false, // Contract check is better handled individually or via a joined query
                lastActivity: null
            };
        });

        return results;
    }
}

export const clientLifecycleService = new ClientLifecycleService();
