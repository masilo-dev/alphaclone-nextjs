import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { subDays, startOfDay, endOfDay, format, parseISO } from 'date-fns';

export interface AnalyticsData {
    revenue: {
        total: number;
        thisMonth: number;
        lastMonth: number;
        trend: number; // percentage change
        byPeriod: Array<{ date: string; revenue: number; projects: number }>;
    };
    projects: {
        total: number;
        active: number;
        completed: number;
        pending: number;
        byStatus: Array<{ status: string; count: number }>;
        byPeriod: Array<{ date: string; count: number }>;
    };
    users: {
        total: number;
        clients: number;
        admins: number;
        newThisMonth: number;
        growth: number; // percentage
    };
    performance: {
        avgProjectDuration: number; // days
        onTimeDelivery: number; // percentage
        clientSatisfaction: number; // 1-5 scale
    };
    businessOS: {
        pipeline: {
            stats: any[];
            weightedValue: number;
        };
        automation: {
            totalRuns: number;
            successRate: number;
            statusCounts: Record<string, number>;
        };
    };
}

export const analyticsService = {
    /**
     * Get comprehensive analytics data
     */
    async getAnalytics(dateRange: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<{ data: AnalyticsData | null; error: string | null }> {
        try {
            const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
            const startDate = startOfDay(subDays(new Date(), days));
            const endDate = endOfDay(new Date());

            // Fetch all data in parallel
            const [revenueData, projectsData, usersData, performanceData, businessOSData] = await Promise.all([
                this.getRevenueData(startDate, endDate),
                this.getProjectsData(startDate, endDate),
                this.getUsersData(),
                this.getPerformanceData(),
                this.getBusinessOSData(),
            ]);

            return {
                data: {
                    revenue: revenueData,
                    projects: projectsData,
                    users: usersData,
                    performance: performanceData,
                    businessOS: businessOSData,
                },
                error: null,
            };
        } catch (error) {
            return {
                data: null,
                error: error instanceof Error ? error.message : 'Failed to fetch analytics',
            };
        }
    },

    /**
     * Get revenue analytics
     */
    async getRevenueData(startDate: Date, endDate: Date) {
        const tenantId = tenantService.getCurrentTenantId();
        
        // Fetch all financial activities for aggregation
        const [invoicesRes, expensesRes, payoutsRes] = await Promise.all([
            // 1. Paid Invoices (Revenue) — fetch all and filter in-memory for case-insensitive status match
            supabase
                .from('invoices')
                .select('amount, created_at, status')
                .eq('tenant_id', tenantId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString()),
            
            // 2. Expenses (Costs)
            supabase
                .from('expenses')
                .select('amount, created_at')
                .eq('tenant_id', tenantId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString()),

            // 3. Other Revenue (Direct payments/payouts)
            Promise.resolve(
                supabase
                    .from('revenue_records')
                    .select('amount, created_at')
                    .eq('tenant_id', tenantId)
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString())
            ).catch(() => ({ data: [] as { amount: number; created_at: string }[], error: null }))
        ]);

        const invoices = invoicesRes.data || [];
        const expenses = expensesRes.data || [];
        const otherRevenue = (payoutsRes as any)?.data || [];

        // Aggregate Revenue — case-insensitive status comparison
        const paidRevenue = invoices
            .filter((inv: any) => inv.status?.toLowerCase() === 'paid')
            .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
        
        const sentRevenue = invoices
            .filter((inv: any) => inv.status?.toLowerCase() === 'sent')
            .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
        
        const directRevenue = otherRevenue
            .reduce((sum: number, rec: any) => sum + (rec.amount || 0), 0);

        const totalRevenue = Math.round((paidRevenue + directRevenue) * 100) / 100;
        const totalPotentialRevenue = Math.round((totalRevenue + sentRevenue) * 100) / 100;

        // This month
        const thisMonthStart = startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        const thisMonthInvoices = invoices.filter(
            (inv: any) => new Date(inv.created_at) >= thisMonthStart && inv.status?.toLowerCase() === 'paid'
        );
        const thisMonthDirect = otherRevenue.filter(
            (rec: any) => new Date(rec.created_at) >= thisMonthStart
        );
        const thisMonth = Math.round(
            (thisMonthInvoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) +
             thisMonthDirect.reduce((sum: number, rec: any) => sum + (rec.amount || 0), 0)) * 100
        ) / 100;

        // Last month
        const lastMonthStart = startOfDay(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
        const lastMonthEnd = endOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 0));
        
        // We need to fetch last month data specifically if it's not covered by the current range
        // But for simplicity and performance, let's try to filter from existing data first
        // If the date range is '7d', existing data won't have last month.
        // So we should fetch last month data separately to be safe.
        
        const [lastMonthInvoicesRes, lastMonthRevenueRes] = await Promise.all([
            supabase
                .from('invoices')
                .select('amount')
                .ilike('status', 'paid')
                .eq('tenant_id', tenantId)
                .gte('created_at', lastMonthStart.toISOString())
                .lte('created_at', lastMonthEnd.toISOString()),
            Promise.resolve(
                supabase
                    .from('revenue_records')
                    .select('amount')
                    .eq('tenant_id', tenantId)
                    .gte('created_at', lastMonthStart.toISOString())
                    .lte('created_at', lastMonthEnd.toISOString())
            ).catch(() => ({ data: [] as { amount: number }[], error: null }))
        ]);

        const lastMonthRevenue = (lastMonthInvoicesRes.data || []).reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) +
                                 ((lastMonthRevenueRes as any)?.data || []).reduce((sum: number, rec: any) => sum + (rec.amount || 0), 0);
        
        const lastMonth = Math.round(lastMonthRevenue * 100) / 100;

        const trend = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

        // Group by period for chart
        const byPeriod: Record<string, { revenue: number; expenses: number; projects: number }> = {};
        
        invoices.forEach((inv: any) => {
            const date = format(parseISO(inv.created_at), 'yyyy-MM-dd');
            if (!byPeriod[date]) byPeriod[date] = { revenue: 0, expenses: 0, projects: 0 };
            if (inv.status?.toLowerCase() === 'paid') {
                byPeriod[date].revenue = Math.round((byPeriod[date].revenue + (inv.amount || 0)) * 100) / 100;
            }
        });

        expenses.forEach((exp: any) => {
            const date = format(parseISO(exp.created_at), 'yyyy-MM-dd');
            if (!byPeriod[date]) byPeriod[date] = { revenue: 0, expenses: 0, projects: 0 };
            byPeriod[date].expenses = Math.round((byPeriod[date].expenses + (exp.amount || 0)) * 100) / 100;
        });

        // Get projects for same period
        const { data: projects } = await supabase
            .from('projects')
            .select('created_at')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

        (projects || []).forEach((proj: { created_at: string }) => {
            const date = format(parseISO(proj.created_at), 'yyyy-MM-dd');
            if (byPeriod[date]) {
                byPeriod[date].projects += 1;
            }
        });

        return {
            total: totalRevenue,
            thisMonth,
            lastMonth,
            trend,
            byPeriod: Object.entries(byPeriod)
                .map(([date, data]) => ({ date, ...data }))
                .sort((a, b) => a.date.localeCompare(b.date)),
        };
    },

    /**
     * Get projects analytics
     */
    async getProjectsData(startDate: Date, endDate: Date) {
        const { data: projects, error } = await supabase
            .from('projects')
            .select('status, created_at')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

        if (error) throw error;

        const statusCounts: Record<string, number> = {};
        (projects || []).forEach((proj: { status: string }) => {
            statusCounts[proj.status] = (statusCounts[proj.status] || 0) + 1;
        });

        // Group by period
        const byPeriod: Record<string, number> = {};
        (projects || []).forEach((proj: { created_at: string }) => {
            const date = format(parseISO(proj.created_at), 'yyyy-MM-dd');
            byPeriod[date] = (byPeriod[date] || 0) + 1;
        });

        return {
            total: projects?.length || 0,
            active: statusCounts['Active'] || 0,
            completed: statusCounts['Completed'] || 0,
            pending: statusCounts['Pending'] || 0,
            byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
            byPeriod: Object.entries(byPeriod)
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date)),
        };
    },

    /**
     * Get users analytics
     */
    async getUsersData() {
        const { data: tenantUsers, error } = await supabase
            .from('tenant_users')
            .select('role, joined_at')
            .eq('tenant_id', tenantService.getCurrentTenantId());

        if (error) throw error;

        const total = tenantUsers?.length || 0;
        const clients = tenantUsers?.filter((p: { role: string }) => p.role === 'client').length || 0;
        const admins = tenantUsers?.filter((p: { role: string }) => p.role === 'admin' || p.role === 'owner').length || 0;

        // New this month
        const thisMonthStart = startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        const newThisMonth = tenantUsers?.filter(
            (p: { joined_at: string | number | Date }) => new Date(p.joined_at) >= thisMonthStart
        ).length || 0;

        // Last month for growth calculation
        const lastMonthStart = startOfDay(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
        const lastMonthEnd = endOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 0));
        const { count: lastMonthCount } = await supabase
            .from('tenant_users')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .gte('joined_at', lastMonthStart.toISOString())
            .lte('joined_at', lastMonthEnd.toISOString());

        const growth = lastMonthCount && lastMonthCount > 0
            ? ((newThisMonth - lastMonthCount) / lastMonthCount) * 100
            : newThisMonth > 0 ? 100 : 0;

        return {
            total,
            clients,
            admins,
            newThisMonth,
            growth,
        };
    },

    /**
     * Get performance metrics
     */
    async getPerformanceData() {
        // Get completed projects with dates
        const { data: projects } = await supabase
            .from('projects')
            .select('created_at, updated_at, status, due_date')
            .eq('status', 'Completed')
            .eq('tenant_id', tenantService.getCurrentTenantId());

        if (!projects || projects.length === 0) {
            return {
                avgProjectDuration: 0,
                onTimeDelivery: 100,
                clientSatisfaction: 4.5,
            };
        }

        // Calculate average duration
        const durations = projects
            .filter((p: { created_at: string | null; updated_at: string | null }) => p.created_at && p.updated_at)
            .map((p: { created_at: string; updated_at: string }) => {
                const start = new Date(p.created_at);
                const end = new Date(p.updated_at);
                return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)); // days
            });

        const averageProjectDuration = durations.length > 0
            ? durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length
            : 0;

        // Calculate on-time delivery
        const onTime = projects.filter((p: { due_date: string | null; updated_at: string }) => {
            if (!p.due_date) return true;
            const due = new Date(p.due_date);
            const completed = new Date(p.updated_at);
            return completed <= due;
        }).length;

        const onTimeDelivery = (onTime / projects.length) * 100;

        // Client satisfaction (dynamically derived from project performance)
        const clientSatisfaction = Math.min(5, Math.max(1, (onTimeDelivery / 20) * 0.9 + 0.5));

        return {
            avgProjectDuration: Math.round(averageProjectDuration),
            onTimeDelivery: Math.round(onTimeDelivery),
            clientSatisfaction: Number(clientSatisfaction.toFixed(1)),
        };
    },

    /**
     * Get Business OS specific metrics
     */
    async getBusinessOSData() {
        const { dealService } = await import('./dealService');
        const { getAutomationHealth } = await import('./automation/observabilityService');
        const tenantId = tenantService.getCurrentTenantId();

        const [pipelineStatsRes, weightedValueRes, automationHealth] = await Promise.all([
            dealService.getPipelineStats(),
            dealService.getWeightedPipelineValue(),
            getAutomationHealth(tenantId || ''),
        ]);

        const totalRuns = automationHealth.total_runs || 0;
        const completedRuns = (automationHealth as any).status_counts?.completed || 0;
        const successRate = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

        return {
            pipeline: {
                stats: pipelineStatsRes.stats || [],
                weightedValue: weightedValueRes.value || 0,
            },
            automation: {
                totalRuns,
                successRate,
                statusCounts: (automationHealth as any).status_counts || {},
            },
        };
    },
};

