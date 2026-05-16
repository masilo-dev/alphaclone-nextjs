import { supabase } from "@/lib/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { cronService } from "@/services/cronService";

/**
 * Recurring Invoices Workflow
 */
export async function processRecurringInvoices() {
    "use workflow";

    const { recurringConfigs } = await fetchConfigs();
    const today = new Date();

    for (const config of recurringConfigs) {
        await processSingleInvoice(config, today);
    }
}

async function fetchConfigs() {
    "use step";
    const { data, error } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('active', true);
    if (error) throw error;
    return { recurringConfigs: data || [] };
}

async function processSingleInvoice(config: any, today: Date) {
    "use step";
    const shouldGenerate = cronService.shouldGenerateInvoice(config, today);
    if (shouldGenerate) {
        await cronService.generateInvoice(config);
    }
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
    console.log("Running AI agents...");
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
