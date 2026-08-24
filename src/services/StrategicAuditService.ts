import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { subDays, format } from 'date-fns';

export interface BusinessSnapshot {
    summary: {
        leads_total: number;
        deals_total: number;
        invoices_total: number;
        tasks_total: number;
        posts_total: number;
        revenue_monthly_actual: number;
        weighted_pipeline_value: number;
    };
    deals: Array<{
        id: string;
        name: string;
        amount: number;
        lastActivityDate: string | null;
        stage: string;
        probability: number;
    }>;
    invoices: Array<{
        id: string;
        invoiceNumber: string;
        total: number;
        dueDate: string;
        status: string;
    }>;
    leads: Array<{
        id: string;
        name: string;
        status: string;
        value: number;
        lastActivityDate: string | null;
        daysStale: number;
    }>;
    tasks: Array<{
        id: string;
        title: string;
        dueDate: string;
        status: string;
        priority: string;
    }>;
    posts: Array<{
        id: string;
        content_preview: string;
        platform: string;
        status: string;
        published_at: string | null;
    }>;
    goals: any;
    progress: number;
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
            const nowIso = now.toISOString();

            // Fetch data in parallel
            const [
                dealsRes,
                invoicesRes,
                leadsRes,
                postsRes,
                tasksRes,
                tenantRes,
                countsRes
            ] = await Promise.all([
                // 1. Top deals by value
                db
                    .from('deals')
                    .select('id, name, value, updated_at, stage, probability, contact_id')
                    .eq('tenant_id', tid)
                    .not('stage', 'in', '("closed_won","closed_lost","lost")')
                    .order('value', { ascending: false })
                    .limit(10),

                // 2. Critical invoices
                db
                    .from('business_invoices')
                    .select('id, invoice_number, total, due_date, status')
                    .eq('tenant_id', tid)
                    .eq('is_test_data', false)
                    .not('status', 'eq', 'paid')
                    .order('due_date', { ascending: true })
                    .limit(10),

                // 3. Recent leads
                db
                    .from('leads')
                    .select('id, business_name, created_at, status, value, last_activity_at')
                    .eq('tenant_id', tid)
                    .eq('is_test_data', false)
                    .order('created_at', { ascending: false })
                    .limit(10),

                // 4. Recent social posts
                db
                    .from('social_posts')
                    .select('id, content, platform, status, published_at')
                    .eq('tenant_id', tid)
                    .order('updated_at', { ascending: false })
                    .limit(5),

                // 5. Active tasks
                db
                    .from('tasks')
                    .select('id, title, due_date, status, priority')
                    .eq('tenant_id', tid)
                    .eq('is_test_data', false)
                    .not('status', 'eq', 'completed')
                    .order('due_date', { ascending: true })
                    .limit(10),

                // 6. Goals
                db
                    .from('tenants')
                    .select('business_goals')
                    .eq('id', tid)
                    .single(),

                // 7. Aggregate counts (using RPC or separate queries - using separate for simplicity if RPC not available)
                // In a real scenario, an RPC like get_tenant_stats would be better.
                Promise.all([
                    db.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', tid).eq('is_test_data', false),
                    db.from('deals').select('*', { count: 'exact', head: true }).eq('tenant_id', tid),
                    db.from('business_invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tid).eq('is_test_data', false).not('status', 'eq', 'paid'),
                    db.from('tasks').select('*', { count: 'exact', head: true }).eq('tenant_id', tid).eq('is_test_data', false).not('status', 'eq', 'completed'),
                    db.from('social_posts').select('*', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'published')
                ])
            ]);

            const [leadsCount, dealsCount, invoicesCount, tasksCount, postsCount] = countsRes;

            const snapshot: BusinessSnapshot = {
                summary: {
                    leads_total: leadsCount.count || 0,
                    deals_total: dealsCount.count || (dealsRes.data || []).length,
                    invoices_total: invoicesCount.count || 0,
                    tasks_total: tasksCount.count || 0,
                    posts_total: postsCount.count || 0,
                    revenue_monthly_actual: 0,
                    weighted_pipeline_value: (dealsRes.data || []).reduce((sum: number, d: any) => sum + ((d.value || 0) * (d.probability || 0) / 100), 0)
                },
                deals: (dealsRes.data || []).map((d: any) => ({
                    id: d.id,
                    name: d.name || d.business_name,
                    amount: d.value,
                    lastActivityDate: d.updated_at || d.last_activity_at,
                    stage: d.stage,
                    probability: d.probability || 0
                })),
                invoices: (invoicesRes.data || []).map((i: any) => ({
                    id: i.id,
                    invoiceNumber: i.invoice_number,
                    total: i.total,
                    dueDate: i.due_date,
                    status: i.status
                })),
                leads: (leadsRes.data || []).map((l: any) => {
                    const created = new Date(l.created_at);
                    const daysStale = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                    return {
                        id: l.id,
                        name: l.business_name,
                        status: l.status,
                        value: l.value || 0,
                        lastActivityDate: l.last_activity_at || l.created_at,
                        daysStale
                    };
                }),
                tasks: (tasksRes.data || []).map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    dueDate: t.due_date,
                    status: t.status,
                    priority: t.priority
                })),
                posts: (postsRes.data || []).map((p: any) => ({
                    id: p.id,
                    content_preview: typeof p.content === 'string' ? p.content.substring(0, 100) + '...' : '',
                    platform: p.platform,
                    status: p.status,
                    published_at: p.published_at
                })),
                goals: tenantRes.data?.business_goals || {},
                progress: 0
            };

            // Calculate monthly revenue
            const firstOfMonth = format(new Date(), 'yyyy-MM-01');
            const { data: revenue } = await db
                .from('business_invoices')
                .select('total')
                .eq('tenant_id', tid)
                .eq('is_test_data', false)
                .eq('status', 'paid')
                .gte('created_at', firstOfMonth);
            
            const totalPaid = (revenue || []).reduce((sum: number, r: any) => sum + r.total, 0);
            snapshot.summary.revenue_monthly_actual = totalPaid;

            // Calculate progress if goals exist
            if (snapshot.goals && snapshot.goals.monthly_revenue_goal) {
                const goal = snapshot.goals.monthly_revenue_goal;
                snapshot.progress = Math.min(100, Math.round((totalPaid / goal) * 100));
            }

            return { snapshot, error: null };
        } catch (error) {
            console.error('Error fetching business snapshot:', error);
            return { snapshot: null, error: error instanceof Error ? error.message : 'Failed to fetch snapshot' };
        }
    }
};

