import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Recurring Invoices Workflow
 */
export async function processRecurringInvoices() {
    "use workflow";

    await processRecurringStep();
}

async function processRecurringStep() {
    "use step";
    const { processDueRecurringInvoices } = await import('@/services/finance/recurringInvoiceService');
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
    const reminderCooldownIso = new Date(Date.now() - 3 * 86400000).toISOString();

    const { data: dueSoon } = await admin
        .from('tasks')
        .select('id,tenant_id,assigned_to,title,due_date,priority,reminder_at')
        .eq('due_date', tomorrowStr)
        .neq('status', 'completed')
        .or(`reminder_at.is.null,reminder_at.lt.${reminderCooldownIso}`);

    const { data: overdue } = await admin
        .from('tasks')
        .select('id,tenant_id,assigned_to,title,due_date,priority,reminder_at')
        .lt('due_date', todayStr)
        .neq('status', 'completed')
        .or(`reminder_at.is.null,reminder_at.lt.${reminderCooldownIso}`);

    return { dueSoon: dueSoon || [], overdue: overdue || [] };
}

async function sendTaskReminder(task: any, type: "dueSoon" | "overdue") {
    "use step";
    if (!task?.assigned_to || !task?.tenant_id) return;

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
        .from('profiles')
        .select('email, name')
        .eq('id', task.assigned_to)
        .maybeSingle();

    if (!profile?.email) {
        console.warn(`[task-reminders] no email for assignee ${task.assigned_to}`);
        return;
    }

    const { data: tenant } = await admin
        .from('tenants')
        .select('name')
        .eq('id', task.tenant_id)
        .maybeSingle();

    const { sendEmailServer } = await import('@/lib/email/sendEmailServer');
    const { taskEmailTemplates } = await import('@/lib/email/taskEmailTemplates');
    const { SITE_URL } = await import('@/lib/siteUrl');

    const workspaceName = tenant?.name || 'Your Workspace';
    const actionUrl = `${SITE_URL}/dashboard/tasks/${task.id}`;
    const priority =
        task.priority === 'urgent' ? 'high' : (task.priority as 'low' | 'medium' | 'high' | undefined);

    const emailData = {
        recipientName: profile.name || 'Team Member',
        taskTitle: task.title,
        dueDate: task.due_date,
        priority,
        actionUrl,
        workspaceName,
    };

    const html =
        type === 'dueSoon'
            ? taskEmailTemplates.taskDueSoon(emailData)
            : taskEmailTemplates.taskOverdue(emailData);

    const subject =
        type === 'dueSoon'
            ? `Reminder: "${task.title}" is due tomorrow`
            : `Overdue: "${task.title}"`;

    const result = await sendEmailServer({
        tenantId: task.tenant_id,
        to: profile.email,
        subject,
        html,
        isPlatformNotification: true,
        fromName: 'AlphaClone Tasks',
        templateName: type === 'dueSoon' ? 'taskDueSoon' : 'taskOverdue',
    });

    if (!result.success) {
        console.error(`[task-reminders] failed for task ${task.id}:`, result.error);
        return;
    }

    await admin
        .from('tasks')
        .update({
            reminder_sent: true,
            reminder_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

    console.log(`[task-reminders] sent ${type} reminder for task ${task.id}`);
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
    const { data, error } = await admin.rpc('claim_due_scheduled_ai_tasks', { p_limit: 20 });

    if (error) throw error;
    return { tasks: data || [] };
}

async function executeAiTaskStep(task: any) {
    "use step";
    const { taskAutomationService } = await import("@/services/automation/taskAutomationService");
    return taskAutomationService.executeTask(task);
}
