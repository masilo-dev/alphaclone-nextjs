import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { aiService } from '@/services/ai/aiService';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { absoluteUrl } from '@/lib/siteUrl';
import { nextCronRun, parseCron, validateTimezone } from '@/lib/scheduling/scheduleTime';
import { assertPermission } from '@/lib/mcp/connector/permissions';
import { executionOutcome, schedulePermission, isSchedulableTool } from '@/lib/scheduling/scheduledActions';

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

export function isValidCronSchedule(schedule: string): boolean {
    try { parseCron(schedule); return true; } catch { return false; }
}
export function getNextTaskRun(schedule: string, after = new Date(), timezone = 'UTC'): Date {
    return nextCronRun(schedule, timezone, after);
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
        action?: { tool_name: string; args: Record<string, unknown> };
    }) {
        const supabase = createSupabaseAdminClient();
        if (!params.prompt?.trim() && !params.action) throw new Error('Prompt or exact action is required');
        if (!params.timezone) throw new Error('User-selected timezone is required');
        const timezone = validateTimezone(params.timezone);
        if (params.action) {
            if (!params.userId || !isSchedulableTool(params.action.tool_name)) throw new Error('Invalid scheduled action');
            await assertPermission(params.tenantId, params.userId, schedulePermission(params.action.tool_name));
            const { getTool } = await import('@/lib/mcp/tool-registry');
            const tool = getTool(params.action.tool_name);
            if (!tool) throw new Error('Unknown scheduled action tool');
            tool.inputSchema.parse({ ...params.action.args, tenant_id: params.tenantId, user_id: params.userId });
        }
        const nextRunAt = getNextTaskRun(params.schedule, new Date(), timezone);

        const { data, error } = await supabase
            .from('scheduled_ai_tasks')
            .insert({
                tenant_id: params.tenantId,
                user_id: params.userId,
                name: params.name,
                prompt: params.prompt || '',
                schedule: params.schedule,
                timezone,
                metadata: params.action ? { action: params.action, action_approved_by: params.userId } : {},
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

        if (!isValidCronSchedule(task.schedule)) {
            const message = `Invalid cron schedule "${task.schedule}" — task paused until schedule is fixed`;
            console.error(`[scheduled-ai-task] ${task.id}: ${message}`);
            await supabase
                .from('scheduled_ai_tasks')
                .update({ status: 'paused', updated_at: new Date().toISOString() })
                .eq('id', task.id);
            await supabase.from('scheduled_ai_task_results').insert({
                task_id: task.id,
                tenant_id: task.tenant_id,
                status: 'failure',
                error: message,
                ran_at: new Date().toISOString(),
            });
            return { success: false, error: message };
        }

        try {
            let output: string;
            if (task.metadata?.action) {
                if (!task.user_id || task.metadata.action_approved_by !== task.user_id) throw new Error('Scheduled action authorization is missing');
                const membership = await supabase.from('tenant_users').select('user_id').eq('tenant_id', task.tenant_id).eq('user_id', task.user_id).maybeSingle();
                if (membership.error) throw membership.error;
                if (!membership.data) throw new Error('Scheduling user no longer has workspace access');
                const action = task.metadata.action;
                if (!isSchedulableTool(action.tool_name)) throw new Error('Invalid scheduled action tool');
                await assertPermission(task.tenant_id, task.user_id, schedulePermission(action.tool_name));
                const { executeTool } = await import('@/lib/mcp/tool-registry');
                const result = await executeTool(task.tenant_id, task.user_id, action.tool_name, {
                    ...action.args, idempotency_key: `scheduled-task:${task.tenant_id}:${task.id}:${task.next_run_at}`,
                }, { executionSource: 'cron', skipPolicyEvaluation: true });
                const outcome = executionOutcome(result);
                if (outcome.status === 'failed' || outcome.status === 'unknown') throw new Error(outcome.error || 'Scheduled action requires reconciliation');
                output = result.content?.[0]?.text || '';
            } else {
                const completion = await aiService.complete({
                    prompt: task.prompt,
                    systemPrompt: `Prepare the scheduled workspace report named "${task.name}". This is a text-generation task; do not claim to have sent messages or executed external tools.`,
                    provider: 'auto', temperature: 0.2,
                });
                output = String(completion.content || '').trim();
            }
            if (!output) throw new Error('Task returned an empty result');

            // 2. Store Result
            await supabase.from('scheduled_ai_task_results').insert({
                task_id: task.id,
                tenant_id: task.tenant_id,
                output,
                status: 'success',
                ran_at: new Date().toISOString()
            });

            // 3. Update Task Last Run and Next Run
            const nextRunAt = getNextTaskRun(task.schedule, new Date(), task.timezone || 'UTC');

            await supabase
                .from('scheduled_ai_tasks')
                .update({
                    last_run_at: new Date().toISOString(),
                    next_run_at: nextRunAt.toISOString()
                })
                .eq('id', task.id);

            await notifyScheduledTaskByEmail(task, output);

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

            const nextRunAt = isValidCronSchedule(task.schedule)
                ? getNextTaskRun(task.schedule, new Date(), task.timezone || 'UTC')
                : null;

            await supabase
                .from('scheduled_ai_tasks')
                .update({
                    last_run_at: new Date().toISOString(),
                    ...(nextRunAt && !task.metadata?.action ? { next_run_at: nextRunAt.toISOString() } : { status: 'paused' }),
                })
                .eq('id', task.id);

            return { success: false, error };
        }
    }
};

async function notifyScheduledTaskByEmail(task: ScheduledAiTask, output: string): Promise<void> {
    const prefs = (task.notification_preference || {}) as { email?: boolean };
    if (prefs.email === false) return;
    if (!task.user_id) return;

    const supabase = createSupabaseAdminClient();
    const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', task.user_id)
        .maybeSingle();
    if (!profile?.email) return;

    const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', task.tenant_id)
        .maybeSingle();

    const snippet = output.length > 1200 ? `${output.slice(0, 1200)}…` : output;
    const workspaceName = tenant?.name || 'Your Workspace';
    const actionUrl = absoluteUrl('/dashboard/automation');

    await sendEmailServer({
        tenantId: task.tenant_id,
        to: profile.email,
        subject: `Scheduled task complete: ${task.name}`,
        html: `
          <p>Hi ${profile.name || 'there'},</p>
          <p>Your scheduled workspace task <strong>${task.name}</strong> finished successfully in <strong>${workspaceName}</strong>.</p>
          <pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;background:var(--ws-canvas);color:var(--ws-border);padding:16px;border-radius:12px;">${snippet.replace(/</g, '&lt;')}</pre>
          <p><a href="${actionUrl}">Open automation dashboard</a></p>
        `,
        isPlatformNotification: true,
        templateName: 'scheduledAiTaskComplete',
    });
}
