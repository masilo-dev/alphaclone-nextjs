import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { cronService } from '../cronService';

export interface ScheduledAiTask {
    id: string;
    tenant_id: string;
    user_id?: string;
    name: string;
    prompt: string;
    schedule: string;
    timezone: string;
    notification_preference: any;
    status: 'active' | 'paused';
    last_run_at?: string;
    next_run_at?: string;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export const taskAutomationService = {
    /**
     * Create a new scheduled AI task
     */
    async createTask(params: {
        tenantId: string;
        userId?: string;
        name: string;
        prompt: string;
        schedule: string;
        timezone?: string;
        notificationPreference?: any;
    }) {
        const supabase = createSupabaseAdminClient();
        
        // Calculate initial next_run_at (Simplified for now, in prod we'd use cron-parser)
        const nextRunAt = new Date();
        nextRunAt.setHours(nextRunAt.getHours() + 24); // Default to tomorrow same time if not parsed

        const { data, error } = await supabase
            .from('scheduled_ai_tasks')
            .insert({
                tenant_id: params.tenantId,
                user_id: params.userId,
                name: params.name,
                prompt: params.prompt,
                schedule: params.schedule,
                timezone: params.timezone || 'UTC',
                notification_preference: params.notificationPreference || { email: true },
                status: 'active',
                next_run_at: nextRunAt.toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * List scheduled tasks for a tenant
     */
    async listTasks(tenantId: string) {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('scheduled_ai_tasks')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Get recent results for a specific task
     */
    async getTaskResults(tenantId: string, taskId: string, limit = 10) {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('scheduled_ai_task_results')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('task_id', taskId)
            .order('ran_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },

    /**
     * Toggle task status
     */
    async updateTaskStatus(tenantId: string, taskId: string, status: 'active' | 'paused') {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
            .from('scheduled_ai_tasks')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId)
            .eq('id', taskId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a task
     */
    async deleteTask(tenantId: string, taskId: string) {
        const supabase = createSupabaseAdminClient();
        const { error } = await supabase
            .from('scheduled_ai_tasks')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('id', taskId);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Execute a task (Run the prompt)
     */
    async executeTask(task: ScheduledAiTask) {
        const supabase = createSupabaseAdminClient();
        
        try {
            // 1. Call AI to run the prompt
            // In a real implementation, we'd use the aiRouter or a specific agent
            console.log(`Executing AI Task: ${task.name} with prompt: ${task.prompt}`);
            
            const output = `AI Result for "${task.name}": This is a simulated result based on your prompt: ${task.prompt}`;

            // 2. Store Result
            await supabase.from('scheduled_ai_task_results').insert({
                task_id: task.id,
                tenant_id: task.tenant_id,
                output,
                status: 'success',
                ran_at: new Date().toISOString()
            });

            // 3. Update Task Last Run and Next Run
            const nextRunAt = new Date();
            nextRunAt.setHours(nextRunAt.getHours() + 24); // Simple +24h for now

            await supabase
                .from('scheduled_ai_tasks')
                .update({
                    last_run_at: new Date().toISOString(),
                    next_run_at: nextRunAt.toISOString()
                })
                .eq('id', task.id);

            return { success: true, output };
        } catch (error) {
            console.error(`Task ${task.id} failed:`, error);
            
            await supabase.from('scheduled_ai_task_results').insert({
                task_id: task.id,
                tenant_id: task.tenant_id,
                status: 'failure',
                error: error instanceof Error ? error.message : String(error),
                ran_at: new Date().toISOString()
            });

            return { success: false, error };
        }
    }
};
