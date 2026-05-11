import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { subDays, format } from 'date-fns';

export interface BusinessSnapshot {
    deals: Array<{
        name: string;
        amount: number;
        lastActivityDate: string | null;
        stage: string;
    }>;
    invoices: Array<{
        invoiceNumber: string;
        total: number;
        dueDate: string;
        status: string;
    }>;
    staleLeads: Array<{
        name: string;
        lastActivityDate: string | null;
        status: string;
        daysStale: number;
    }>;
    lastSocialPostDate: string | null;
    overdueTasks: Array<{
        title: string;
        dueDate: string;
        status: string;
    }>;
    goals: any;
    progress: number; // % toward goal if applicable
}

export const strategicAuditService = {
    /**
     * Pulls the full business state snapshot for the current tenant.
     */
    async getSnapshot(tenantId?: string, client?: any): Promise<{ snapshot: BusinessSnapshot | null; error: string | null }> {
        try {
            const tid = tenantId || tenantService.getCurrentTenantId();
            if (!tid) throw new Error('No tenant ID provided or found in context');

            const db = client || supabase;
            const now = new Date();
            const sevenDaysAgo = subDays(now, 7).toISOString();

            // Fetch data in parallel
            const [
                dealsRes,
                invoicesRes,
                leadsRes,
                socialRes,
                tasksRes,
                tenantRes
            ] = await Promise.all([
                // 1. Open deals (Qualified, Negotiation, Proposal)
                db
                    .from('leads')
                    .select('business_name, value, last_activity_at, stage')
                    .eq('tenant_id', tid)
                    .in('stage', ['qualified', 'negotiation', 'proposition'])
                    .gt('value', 0)
                    .order('value', { ascending: false }),

                // 2. Unpaid and overdue invoices
                db
                    .from('business_invoices')
                    .select('invoice_number, total, due_date, status')
                    .eq('tenant_id', tid)
                    .not('status', 'eq', 'paid')
                    .order('due_date', { ascending: true }),

                // 3. Leads with no activity in 7+ days
                db
                    .from('leads')
                    .select('business_name, created_at, status')
                    .eq('tenant_id', tid)
                    .eq('status', 'new')
                    .lt('created_at', sevenDaysAgo),

                // 4. Last social post date
                db
                    .from('social_posts')
                    .select('published_at')
                    .eq('tenant_id', tid)
                    .eq('status', 'published')
                    .order('published_at', { ascending: false })
                    .limit(1),

                // 5. Pending tasks that are overdue
                db
                    .from('tasks')
                    .select('title, due_date, status')
                    .eq('tenant_id', tid)
                    .not('status', 'eq', 'completed')
                    .lt('due_date', now.toISOString()),

                // 6. Goals
                db
                    .from('tenants')
                    .select('business_goals')
                    .eq('id', tid)
                    .single()
            ]);

            const snapshot: BusinessSnapshot = {
                deals: (dealsRes.data || []).map((d: any) => ({
                    name: d.business_name,
                    amount: d.value,
                    lastActivityDate: d.last_activity_at,
                    stage: d.stage
                })),
                invoices: (invoicesRes.data || []).map((i: any) => ({
                    invoiceNumber: i.invoice_number,
                    total: i.total,
                    dueDate: i.due_date,
                    status: i.status
                })),
                staleLeads: (leadsRes.data || []).map((l: any) => {
                    const created = new Date(l.created_at);
                    const daysStale = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                    return {
                        name: l.business_name,
                        lastActivityDate: l.created_at,
                        status: l.status,
                        daysStale
                    };
                }),
                lastSocialPostDate: socialRes.data?.[0]?.published_at || null,
                overdueTasks: (tasksRes.data || []).map((t: any) => ({
                    title: t.title,
                    dueDate: t.due_date,
                    status: t.status
                })),
                goals: tenantRes.data?.business_goals || {},
                progress: 0 // Default progress
            };

            // Calculate progress if goals exist
            if (snapshot.goals && snapshot.goals.monthly_revenue_goal) {
                // Example: calculate revenue progress
                const goal = snapshot.goals.monthly_revenue_goal;
                const { data: revenue } = await db
                    .from('business_invoices')
                    .select('total')
                    .eq('tenant_id', tid)
                    .eq('status', 'paid')
                    .gte('created_at', format(new Date(), 'yyyy-MM-01'));
                
                const totalPaid = (revenue || []).reduce((sum: number, r: any) => sum + r.total, 0);
                snapshot.progress = Math.min(100, Math.round((totalPaid / goal) * 100));
            }

            return { snapshot, error: null };
        } catch (error) {
            console.error('Error fetching business snapshot:', error);
            return { snapshot: null, error: error instanceof Error ? error.message : 'Failed to fetch snapshot' };
        }
    }
};
