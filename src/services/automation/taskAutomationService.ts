import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { aiService } from '@/services/ai/aiService';

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

function cronFieldMatches(field: string, value: number): boolean {
    if (field === '*') return true;
    return field.split(',').some((part) => Number(part) === value);
}

export function getNextTaskRun(schedule: string, after = new Date()): Date {
    const parts = schedule.trim().split(/\s+/);
    if (parts.length !== 5 || !parts.every((part) => /^(?:\*|\d{1,2}(?:,\d{1,2})*)$/.test(part))) throw new Error('Schedule must be a supported five-field cron expression');
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const candidate = new Date(after.getTime());
    candidate.setUTCSeconds(0, 0);
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
    const maximum = 366 * 24 * 60;
    for (let attempt = 0; attempt < maximum; attempt += 1) {
        if (cronFieldMatches(minute, candidate.getUTCMinutes()) && cronFieldMatches(hour, candidate.getUTCHours()) && cronFieldMatches(dayOfMonth, candidate.getUTCDate()) && cronFieldMatches(month, candidate.getUTCMonth() + 1) && cronFieldMatches(dayOfWeek, candidate.getUTCDay())) return candidate;
        candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
    }
    throw new Error('Schedule has no run time within the next year');
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
        
        const nextRunAt = getNextTaskRun(params.schedule);

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
            const completion = await aiService.complete({
                prompt: task.prompt,
                systemPrompt: `Execute the scheduled workspace task named "${task.name}". Return a concise, actionable result.`,
                provider: 'auto',
                temperature: 0.2,
            });
            const output = String(completion.content || '').trim();
            if (!output) throw new Error('AI provider returned an empty result');

            // 2. Store Result
            await supabase.from('scheduled_ai_task_results').insert({
                task_id: task.id,
                tenant_id: task.tenant_id,
                output,
                status: 'success',
                ran_at: new Date().toISOString()
            });

            // 3. Update Task Last Run and Next Run
            const nextRunAt = getNextTaskRun(task.schedule);

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
