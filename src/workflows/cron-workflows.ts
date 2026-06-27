import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { processDueRecurringInvoices } from "@/services/finance/recurringInvoiceService";

/**
 * Recurring Invoices Workflow
 */
export async function processRecurringInvoices() {
    "use workflow";

    await processRecurringStep();
}

async function processRecurringStep() {
    "use step";
    const result = await processDueRecurringInvoices();
    console.log(`[recurring-invoices] processed=${result.processed} errors=${result.errors.length}`);
    if (result.errors.length) {
        console.error('[recurring-invoices]', result.errors.join('; '));
    }
    return result;
}

/**
 * Task Reminders Workflow
 */
export async function processTaskReminders() {
    "use workflow";

    const { dueSoon, overdue } = await fetchReminderTasks();

    // Parallel execution using Promise.all for steps
    await Promise.all([
        ...dueSoon.map((task: any) => sendTaskReminder(task, "dueSoon")),
        ...overdue.map((task: any) => sendTaskReminder(task, "overdue"))
    ]);
}

async function fetchReminderTasks() {
    "use step";
    const admin = createSupabaseAdminClient();
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: dueSoon } = await admin
        .from('tasks')
        .select('id,tenant_id,assigned_to,title,due_date,priority')
        .eq('due_date', tomorrowStr)
        .neq('status', 'completed');

    const { data: overdue } = await admin
        .from('tasks')
        .select('id,tenant_id,assigned_to,title,due_date,priority')
        .lt('due_date', todayStr)
        .neq('status', 'completed')
        .eq('reminder_sent', false);

    return { dueSoon: dueSoon || [], overdue: overdue || [] };
}

async function sendTaskReminder(task: any, type: "dueSoon" | "overdue") {
    "use step";
    // Simplified notification logic
    console.log(`Sending ${type} reminder for task ${task.id}`);
}

/**
 * Social Publishing Workflow
 */
export async function socialPublishing() {
    "use workflow";

    const { duePosts } = await fetchDuePosts();

    for (const post of duePosts) {
        await publishSocialPostStep(post.id);
    }
}

async function fetchDuePosts() {
    "use step";
    const admin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    
    const { data, error } = await admin
        .from('social_posts')
        .select('id')
        .eq('status', 'scheduled')
        .lte('scheduled_at', nowIso)
        .order('scheduled_at', { ascending: true })
        .limit(25);
    
    if (error) throw error;
    return { duePosts: data || [] };
}

async function publishSocialPostStep(postId: string) {
    "use step";
    console.log(`Publishing social post ${postId}`);
    // Logic from original cron...
}

/**
 * Autonomous Runner Workflow
 */
export async function autonomousRunner() {
    "use workflow";
    await runAgentsStep();
}

async function runAgentsStep() {
    "use step";
    const admin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    // 1. Run scheduled AI tasks
    const { data: tasks } = await admin
        .from('scheduled_ai_tasks')
        .select('*')
        .eq('status', 'active')
        .lte('next_run_at', nowIso)
        .order('next_run_at', { ascending: true })
        .limit(10);

    for (const task of tasks || []) {
        try {
            const { taskAutomationService } = await import("@/services/automation/taskAutomationService");
            await taskAutomationService.executeTask(task);
            console.log(`[AutonomousRunner] Executed task: ${task.id} (${task.name || task.type})`);
        } catch (e) {
            console.error(`[AutonomousRunner] Task ${task.id} failed:`, e);
        }
    }

    // 2. Run autonomous rules (AI-triggered actions)
    const { data: rules } = await admin
        .from('autonomous_rules')
        .select('*')
        .eq('is_active', true)
        .limit(20);

    for (const rule of rules || []) {
        try {
            await admin.from('autonomous_rule_runs').insert({
                rule_id: rule.id,
                tenant_id: rule.tenant_id,
                status: 'triggered',
                triggered_at: nowIso
            });
        } catch (e) {
            console.error(`[AutonomousRunner] Rule ${rule.id} logging failed:`, e);
        }
    }

    console.log(`[AutonomousRunner] Cycle complete. Tasks: ${(tasks || []).length}, Rules checked: ${(rules || []).length}`);
}

/**
 * AI Task Automation Runner
 */
export async function processScheduledAiTasks() {
    "use workflow";

    const { tasks } = await fetchDueAiTasks();

    for (const task of tasks) {
        await executeAiTaskStep(task);
    }
}

async function fetchDueAiTasks() {
    "use step";
    const admin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await admin
        .from('scheduled_ai_tasks')
        .select('*')
        .eq('status', 'active')
        .lte('next_run_at', nowIso)
        .order('next_run_at', { ascending: true })
        .limit(20);

    if (error) throw error;
    return { tasks: data || [] };
}

async function executeAiTaskStep(task: any) {
    "use step";
    const { taskAutomationService } = await import("@/services/automation/taskAutomationService");
    return taskAutomationService.executeTask(task);
}
