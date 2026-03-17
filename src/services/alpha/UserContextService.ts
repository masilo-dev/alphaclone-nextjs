import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const userContextService = {
    /**
     * Aggregates a comprehensive view of the user's historical and future context
     * to enable predictive agent capabilities.
     */
    async getFullContext(userId: string, tenantId: string) {
        const supabase = createSupabaseAdminClient();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 1. Recent Completed Tasks (Last 30 days) - Patterns of work
        const { data: recentTasks } = await supabase
            .from('tasks')
            .select('title, status, completed_at, priority')
            .eq('tenant_id', tenantId)
            .eq('assigned_to', userId)
            .eq('status', 'completed')
            .gte('completed_at', thirtyDaysAgo.toISOString())
            .order('completed_at', { ascending: false })
            .limit(10);

        // 2. Completed Projects - Major achievements
        const { data: completedProjects } = await supabase
            .from('projects')
            .select('name, status, end_date')
            .eq('tenant_id', tenantId)
            .eq('status', 'completed')
            .order('end_date', { ascending: false })
            .limit(5);

        // 3. Upcoming Schedule (Next 7 days) - Immediate context
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const { data: upcomingTasks } = await supabase
            .from('tasks')
            .select('title, due_date, priority')
            .eq('tenant_id', tenantId)
            .eq('assigned_to', userId)
            .neq('status', 'completed')
            .lte('due_date', nextWeek.toISOString())
            .order('due_date', { ascending: true })
            .limit(10);

        // 4. Recent Deals (Sales Context)
        const { data: recentDeals } = await supabase
            .from('deals')
            .select('name, value, stage, created_at')
            .eq('tenant_id', tenantId)
            .eq('owner_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        return {
            recentWork: recentTasks || [],
            achievements: completedProjects || [],
            upcomingSchedule: upcomingTasks || [],
            recentDeals: recentDeals || [],
            summary: `User has completed ${(recentTasks || []).length} tasks recently. Focus is on ${(upcomingTasks || []).length} upcoming items.`
        };
    }
};
