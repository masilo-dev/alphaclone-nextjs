import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { notifyTenantOwner } from '@/lib/automation/platformHardening';

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  due_date: string | null;
  total_amount?: number | null;
  total?: number | null;
  status: string;
  client_id?: string | null;
  reminder_count?: number | null;
};

function daysOverdue(dueDate: string): number {
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
}

function bucket(days: number): 'gentle' | 'personal' | 'escalate' | 'none' {
  if (days <= 0) return 'none';
  if (days <= 7) return 'gentle';
  if (days <= 30) return 'personal';
  return 'escalate';
}

export async function runInvoiceChasingBranches(tenantId: string, userId?: string | null) {
  const admin = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: overdue } = await admin
    .from('business_invoices')
    .select('id, invoice_number, due_date, total_amount, status, client_id, reminder_count')
    .eq('tenant_id', tenantId)
    .in('status', ['sent', 'overdue'])
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(50);

  const actions: Array<{ invoice_id: string; bucket: string; action: string }> = [];

  for (const inv of (overdue || []) as InvoiceRow[]) {
    if (!inv.due_date) continue;
    const days = daysOverdue(inv.due_date);
    const tier = bucket(days);
    if (tier === 'none') continue;

    const sourceKey = `invoice_chase:${inv.id}:${tier}`;
    const { data: existingTask } = await admin
      .from('tasks')
      .select('id')
      .eq('tenant_id', tenantId)
      .contains('metadata', { autoSourceKey: sourceKey })
      .limit(1);

    if (tier === 'gentle') {
      await admin.from('invoice_reminders').insert({
        tenant_id: tenantId,
        invoice_id: inv.id,
        reminder_type: 'gentle_nudge',
        status: 'pending',
        metadata: { days_overdue: days, generatedBy: 'invoice_chasing_branch' },
      });
      actions.push({ invoice_id: inv.id, bucket: tier, action: 'gentle_reminder_queued' });
      continue;
    }

    if (tier === 'personal' && !(existingTask?.length)) {
      await admin.from('tasks').insert({
        tenant_id: tenantId,
        title: `[Invoice] Personal follow-up: ${inv.invoice_number || inv.id} (${days}d overdue)`,
        description: `Invoice is ${days} days overdue. Send a personal follow-up or call the client.`,
        priority: 'high',
        status: 'todo',
        metadata: { autoSourceKey: sourceKey, invoice_id: inv.id, days_overdue: days },
      });
      actions.push({ invoice_id: inv.id, bucket: tier, action: 'personal_task_created' });
      continue;
    }

    if (tier === 'escalate' && !(existingTask?.length)) {
      await admin.from('tasks').insert({
        tenant_id: tenantId,
        title: `[ESCALATION] Invoice ${inv.invoice_number || inv.id} — ${days}d overdue`,
        description:
          'Automated nudges stopped. Decide: write-off, payment plan, collections, or manual call.',
        priority: 'urgent',
        status: 'todo',
        metadata: { autoSourceKey: sourceKey, invoice_id: inv.id, days_overdue: days },
      });
      await notifyTenantOwner(tenantId, {
        title: `Invoice escalation: ${inv.invoice_number || inv.id}`,
        message: `Invoice is ${days} days overdue and needs a manual decision.`,
        link: '/dashboard/business/billing',
      });
      actions.push({ invoice_id: inv.id, bucket: tier, action: 'escalation_task_and_alert' });
    }
  }

  return { overdue_count: (overdue || []).length, actions };
}

export async function runLeadFollowUpBranches(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

  const { data: leads } = await admin
    .from('leads')
    .select('id, business_name, email, stage, outreach_status, updated_at, metadata')
    .eq('tenant_id', tenantId)
    .not('stage', 'in', '("converted","closed_lost")')
    .eq('outreach_status', 'sent')
    .lt('updated_at', threeDaysAgo)
    .limit(30);

  const actions: Array<{ lead_id: string; action: string }> = [];

  let whatsappHealthy = false;
  try {
    const { data: owner } = await admin
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .in('role', ['owner', 'admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const { createMCPServer } = await import('@/services/mcp/MCPServer');
    const server = createMCPServer({ tenantId, userId: owner?.user_id || tenantId });
    const status = await server.runTool('get_whatsapp_status', { tenant_id: tenantId });
    const text = status.content?.[0]?.text || '';
    whatsappHealthy = !status.isError && !text.toLowerCase().includes('error');
  } catch {
    whatsappHealthy = false;
  }

  for (const lead of leads || []) {
    const sourceKey = `lead_followup:${lead.id}`;
    const { data: existing } = await admin
      .from('tasks')
      .select('id')
      .eq('tenant_id', tenantId)
      .contains('metadata', { autoSourceKey: sourceKey })
      .limit(1);
    if (existing?.length) continue;

    const channelAttempts = Number(lead.metadata?.followup_channels_tried || 0);
    if (channelAttempts === 0 && whatsappHealthy && lead.email) {
      await admin
        .from('leads')
        .update({
          metadata: {
            ...(lead.metadata || {}),
            followup_channels_tried: 1,
            next_channel: 'whatsapp',
            followup_branched_at: new Date().toISOString(),
          },
        })
        .eq('id', lead.id);
      actions.push({ lead_id: lead.id, action: 'whatsapp_branch_flagged' });
      continue;
    }

    await admin.from('tasks').insert({
      tenant_id: tenantId,
      title: `[Lead] No response — ${lead.business_name || lead.id}`,
      description: whatsappHealthy
        ? 'Email sent 3+ days ago with no response. Try LinkedIn or manual outreach.'
        : 'Email sent 3+ days ago; WhatsApp unavailable. Try LinkedIn or manual outreach.',
      priority: 'medium',
      status: 'todo',
      metadata: {
        autoSourceKey: sourceKey,
        lead_id: lead.id,
        whatsapp_skipped: !whatsappHealthy,
      },
    });
    actions.push({ lead_id: lead.id, action: 'manual_followup_task' });
  }

  return { candidates: (leads || []).length, actions };
}
