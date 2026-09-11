import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { SITE_URL } from '@/lib/siteUrl';
import { addUtcDays, applyDueOnDay, utcToday } from '@/lib/workspace/dateColumnRange';
import { isFinishedProject } from '@/lib/projects/projectEnums';

async function resolveRecipient(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  userIds: Array<string | null | undefined>,
): Promise<{ email: string; name: string; phone: string | null; userId: string } | null> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, name, phone')
      .in('id', ids);
    const hit = (profiles || []).find((p) => p.email);
    if (hit?.email) {
      return {
        email: hit.email,
        name: hit.name || 'there',
        phone: hit.phone || null,
        userId: hit.id,
      };
    }
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('owner_id')
    .eq('id', tenantId)
    .maybeSingle();
  if (!tenant?.owner_id) return null;
  const { data: owner } = await admin
    .from('profiles')
    .select('id, email, name, phone')
    .eq('id', tenant.owner_id)
    .maybeSingle();
  if (!owner?.email) return null;
  return {
    email: owner.email,
    name: owner.name || 'there',
    phone: owner.phone || null,
    userId: owner.id,
  };
}

async function maybeWhatsApp(
  tenantId: string,
  phone: string | null,
  message: string,
): Promise<void> {
  if (!phone) return;
  try {
    const { sendWhatsAppMessage } = await import('@/lib/whatsapp/sendWhatsApp');
    await sendWhatsAppMessage({
      tenantId,
      phone,
      message,
      metadata: { source: 'auto_outreach', kind: 'workspace_due_alert' },
    });
  } catch (err) {
    console.warn('[workspace-due-alerts] WhatsApp skipped:', err);
  }
}

export async function runWorkspaceDueAlerts(options: { includeTasks?: boolean } = {}): Promise<{
  tasks: number;
  projects: number;
  leads: number;
  failed: number;
}> {
  const includeTasks = options.includeTasks !== false;
  const admin = createSupabaseAdminClient();
  const today = utcToday();
  const tomorrow = addUtcDays(today, 1);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const cooldown = new Date(Date.now() - 3 * 86400000).toISOString();

  let tasks = 0;
  let projects = 0;
  let leads = 0;
  let failed = 0;

  if (includeTasks) {
    const dueSoonQuery = applyDueOnDay(
      admin
        .from('tasks')
        .select('id, tenant_id, assigned_to, created_by, title, due_date, priority, reminder_at, status')
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .or(`reminder_at.is.null,reminder_at.lt.${cooldown}`)
        .limit(50),
      'due_date',
      tomorrow,
    );
    const overdueQuery = admin
      .from('tasks')
      .select('id, tenant_id, assigned_to, created_by, title, due_date, priority, reminder_at, status')
      .lt('due_date', today)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .or(`reminder_at.is.null,reminder_at.lt.${cooldown}`)
      .limit(50);

    const [{ data: dueSoonTasks }, { data: overdueTasks }] = await Promise.all([dueSoonQuery, overdueQuery]);

    for (const task of [...(dueSoonTasks || []), ...(overdueTasks || [])]) {
      const type = String(task.due_date || '').slice(0, 10) < today ? 'overdue' : 'dueSoon';
      try {
        const { sendTaskReminderDirect } = await import('@/lib/cron/taskReminderSender');
        await sendTaskReminderDirect(
          {
            id: task.id,
            tenant_id: task.tenant_id,
            assigned_to: task.assigned_to,
            created_by: task.created_by,
            title: task.title,
            due_date: task.due_date,
            priority: task.priority,
          },
          type,
        );
        const recipient = await resolveRecipient(admin, task.tenant_id, [task.assigned_to, task.created_by]);
        if (recipient?.phone) {
          await maybeWhatsApp(
            task.tenant_id,
            recipient.phone,
            type === 'overdue'
              ? `Overdue task: "${task.title}" was due ${String(task.due_date).slice(0, 10)}.`
              : `Task due tomorrow: "${task.title}" (${String(task.due_date).slice(0, 10)}).`,
          );
        }
        tasks += 1;
      } catch (err) {
        failed += 1;
        console.error('[workspace-due-alerts] task failed:', err);
      }
    }
  }

  const dueSoonProjects = applyDueOnDay(
    admin
      .from('projects')
      .select('id, tenant_id, owner_id, name, due_date, status, current_stage, client_id')
      .not('due_date', 'is', null)
      .limit(50),
    'due_date',
    tomorrow,
  );
  const overdueProjects = admin
    .from('projects')
    .select('id, tenant_id, owner_id, name, due_date, status, current_stage, client_id')
    .not('due_date', 'is', null)
    .lt('due_date', today)
    .limit(50);

  const [{ data: soonProjects }, { data: lateProjects }] = await Promise.all([dueSoonProjects, overdueProjects]);

  for (const project of [...(soonProjects || []), ...(lateProjects || [])]) {
    if (isFinishedProject({ status: project.status, current_stage: project.current_stage })) continue;
    const type = String(project.due_date || '').slice(0, 10) < today ? 'overdue' : 'dueSoon';
    const period = `${type}:${today}`;
    try {
      const recipient = await resolveRecipient(admin, project.tenant_id, [project.owner_id]);
      if (!recipient) continue;
      const due = String(project.due_date).slice(0, 10);
      const subject =
        type === 'overdue'
          ? `Project overdue: "${project.name}" was due ${due}`
          : `Project due tomorrow: "${project.name}" (${due})`;
      const html = `<p>Hi ${recipient.name},</p>
<p>The project <strong>${project.name}</strong> ${type === 'overdue' ? 'is overdue' : 'is due tomorrow'}.</p>
<ul><li><strong>Due date:</strong> ${due}</li><li><strong>Stage:</strong> ${project.current_stage || '—'}</li></ul>
<p><a href="${SITE_URL}/dashboard/business/projects/manage?project=${project.id}">Open the project</a></p>`;
      const result = await sendEmailServer({
        tenantId: project.tenant_id,
        to: recipient.email,
        subject,
        html,
        isPlatformNotification: true,
        fromName: 'AlphaClone Projects',
        templateName: type === 'overdue' ? 'projectOverdue' : 'projectDueSoon',
        idempotencyKey: `due-alert:project:${project.id}:${period}`,
      });
      if (!result.success) {
        failed += 1;
        continue;
      }
      if (recipient.phone) {
        await maybeWhatsApp(project.tenant_id, recipient.phone, subject);
      }
      projects += 1;
    } catch (err) {
      failed += 1;
      console.error('[workspace-due-alerts] project failed:', err);
    }
  }

  const { data: staleLeads } = await admin
    .from('leads')
    .select('id, tenant_id, owner_id, business_name, contact_name, email, stage, status, updated_at')
    .in('stage', ['new', 'lead', 'qualified'])
    .lt('updated_at', threeDaysAgo)
    .limit(50);

  for (const lead of staleLeads || []) {
    const period = `stale:${today}`;
    try {
      const recipient = await resolveRecipient(admin, lead.tenant_id, [lead.owner_id]);
      if (!recipient) continue;
      const label = lead.business_name || lead.contact_name || lead.email || 'Untitled lead';
      const subject = `Lead sitting with no action: ${label}`;
      const html = `<p>Hi ${recipient.name},</p>
<p><strong>${label}</strong> has had no activity for 3+ days (stage: ${lead.stage || lead.status || 'new'}).</p>
<p>Reach out, book a next step, or mark it disqualified so it does not stay stuck.</p>
<p><a href="${SITE_URL}/dashboard/crm">Open leads</a></p>`;
      const result = await sendEmailServer({
        tenantId: lead.tenant_id,
        to: recipient.email,
        subject,
        html,
        isPlatformNotification: true,
        fromName: 'AlphaClone Leads',
        templateName: 'staleLeadSitting',
        idempotencyKey: `due-alert:lead:${lead.id}:${period}`,
      });
      if (!result.success) {
        failed += 1;
        continue;
      }
      if (recipient.phone) {
        await maybeWhatsApp(lead.tenant_id, recipient.phone, subject);
      }
      leads += 1;
    } catch (err) {
      failed += 1;
      console.error('[workspace-due-alerts] lead failed:', err);
    }
  }

  return { tasks, projects, leads, failed };
}
