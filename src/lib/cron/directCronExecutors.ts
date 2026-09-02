/**
 * Direct cron executors — bypass @workflow/world-local in-process queue.
 * Cron-triggered work must not enqueue durable workflow runs inside the web process.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mapWithConcurrency, readConcurrencyEnv } from '@/lib/concurrency/mapWithConcurrency';
import { taskAutomationService } from '@/services/automation/taskAutomationService';

const AI_TASK_CONCURRENCY = () => readConcurrencyEnv('AI_TASK_CONCURRENCY', 3);
const TASK_REMINDER_CONCURRENCY = () => readConcurrencyEnv('EMAIL_CONCURRENCY', 5);

export async function executeRecurringInvoicesDirect(): Promise<{ processed: number; errors: string[] }> {
  const { processDueRecurringInvoices } = await import('@/services/finance/recurringInvoiceService');
  const result = await processDueRecurringInvoices();
  return { processed: result.processed, errors: result.errors };
}

export async function executeScheduledAiTasksDirect(): Promise<{
  claimed: number;
  succeeded: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('claim_due_scheduled_ai_tasks', {
    p_limit: Number(process.env.AI_TASK_BATCH_SIZE || 5),
  });
  if (error) throw error;

  const tasks = data || [];
  let succeeded = 0;
  let failed = 0;

  await mapWithConcurrency(tasks, AI_TASK_CONCURRENCY(), async (task: { id: string }) => {
    const result = await taskAutomationService.executeTask(task as any);
    if (result.success) succeeded += 1;
    else failed += 1;
  });

  return { claimed: tasks.length, succeeded, failed };
}

export async function executeTaskRemindersDirect(): Promise<{ dueSoon: number; overdue: number }> {
  const admin = createSupabaseAdminClient();
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const reminderCooldownIso = new Date(Date.now() - 3 * 86400000).toISOString();

  const [{ data: dueSoon }, { data: overdue }] = await Promise.all([
    admin
      .from('tasks')
      .select('id,tenant_id,assigned_to,title,due_date,priority,reminder_at')
      .eq('due_date', tomorrowStr)
      .neq('status', 'completed')
      .or(`reminder_at.is.null,reminder_at.lt.${reminderCooldownIso}`)
      .limit(50),
    admin
      .from('tasks')
      .select('id,tenant_id,assigned_to,title,due_date,priority,reminder_at')
      .lt('due_date', todayStr)
      .neq('status', 'completed')
      .or(`reminder_at.is.null,reminder_at.lt.${reminderCooldownIso}`)
      .limit(50),
  ]);

  const { sendTaskReminderDirect } = await import('@/lib/cron/taskReminderSender');

  const allTasks = [
    ...(dueSoon || []).map((t) => ({ task: t, type: 'dueSoon' as const })),
    ...(overdue || []).map((t) => ({ task: t, type: 'overdue' as const })),
  ];

  await mapWithConcurrency(allTasks, TASK_REMINDER_CONCURRENCY(), async ({ task, type }) => {
    await sendTaskReminderDirect(task, type);
  });

  return { dueSoon: dueSoon?.length || 0, overdue: overdue?.length || 0 };
}
