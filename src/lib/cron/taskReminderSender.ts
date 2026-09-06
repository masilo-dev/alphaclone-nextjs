import { createSupabaseAdminClient } from '@/lib/supabase-admin';

type ReminderTask = {
  id: string;
  tenant_id: string;
  assigned_to: string | null;
  created_by?: string | null;
  title: string;
  due_date: string;
  priority?: string | null;
};

export async function sendTaskReminderDirect(
  task: ReminderTask,
  type: 'dueSoon' | 'overdue'
): Promise<void> {
  if (!task?.tenant_id) return;

  const admin = createSupabaseAdminClient();
  const candidateIds = [task.assigned_to, task.created_by].filter(Boolean) as string[];
  let profile: { email: string; name: string | null } | null = null;
  if (candidateIds.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('email, name')
      .in('id', candidateIds);
    profile = (profiles || []).find((p) => p.email) || null;
  }
  if (!profile?.email) {
    const { data: tenant } = await admin
      .from('tenants')
      .select('owner_id')
      .eq('id', task.tenant_id)
      .maybeSingle();
    if (tenant?.owner_id) {
      const { data: owner } = await admin
        .from('profiles')
        .select('email, name')
        .eq('id', tenant.owner_id)
        .maybeSingle();
      profile = owner?.email ? owner : null;
    }
  }

  if (!profile?.email) {
    console.warn(`[task-reminders] no email for task ${task.id}`);
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
    idempotencyKey: `due-alert:task:${task.id}:${type}:${new Date().toISOString().slice(0, 10)}`,
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
}
