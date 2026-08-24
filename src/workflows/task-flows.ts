import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Task Created Workflow
 * Triggered when a new task is added to the workspace.
 */
export async function taskCreatedWorkflow({ tenantId, payload }: { tenantId: string; payload: any }) {
  "use workflow";
  await notifyTaskCreatedStep(tenantId, payload);
}

async function notifyTaskCreatedStep(tenantId: string, payload: any) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const taskId = payload?.taskId;
  if (!taskId) return;

  const { data: task } = await supabase
    .from('tasks')
    .select('title, assigned_to, due_date')
    .eq('id', taskId)
    .maybeSingle();

  if (task?.assigned_to) {
    await supabase.from('notifications').insert({
      user_id: task.assigned_to,
      tenant_id: tenantId,
      title: 'New task assigned',
      message: `You were assigned: "${task.title}"${task.due_date ? ` (due ${task.due_date})` : ''}.`,
      type: 'task',
      metadata: { taskId },
    });
  }
}

/**
 * Task Overdue Workflow
 * Triggered when a task status is not 'completed' and passes its due date.
 */
export async function taskOverdueWorkflow({ tenantId, payload }: { tenantId: string, payload: any }) {
  "use workflow";
  
  const { taskId } = payload;

  // 1. Send Internal Alert Message
  await sendInternalAlertStep(taskId, tenantId);

  // 2. Escalate Priority
  await escalatePriorityStep(taskId, tenantId);
}

async function sendInternalAlertStep(taskId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: task } = await supabase.from('tasks').select('*, users!assigned_to(*)').eq('id', taskId).single();
  
  if (task?.assigned_to) {
    await supabase.from('notifications').insert({
      user_id: task.assigned_to,
      tenant_id: tenantId,
      title: 'Task Overdue! ⚠️',
      message: `The task "${task.title}" is overdue. Please update its status.`,
      type: 'warning'
    });
  }
}

async function escalatePriorityStep(taskId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.from('tasks').update({ priority: 'high' }).eq('id', taskId);
}
