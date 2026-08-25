import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { emitTenantBusinessEvent } from '@/lib/notifications/emitTenantBusinessEvent';

const HOURS_REPLY_ESCALATION = 4;
const HOURS_FOLLOWUP_OVERDUE = 48;

export async function runFollowUpEscalationEngine(): Promise<{
  scanned: number;
  needs_attention: number;
  overdue: number;
  notifications: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = Date.now();
  let needsAttention = 0;
  let overdue = 0;
  let notifications = 0;

  const { data: replies } = await admin
    .from('lead_outreach_log')
    .select('id, tenant_id, lead_id, lead_email, campaign_name, created_at, status')
    .eq('status', 'replied')
    .order('created_at', { ascending: false })
    .limit(200);

  const scanned = replies?.length || 0;

  for (const row of replies || []) {
    const repliedAt = new Date(row.created_at).getTime();
    const hoursSince = (now - repliedAt) / (1000 * 60 * 60);
    if (hoursSince < HOURS_REPLY_ESCALATION) continue;

    const { data: followUp } = await admin
      .from('lead_outreach_log')
      .select('id')
      .eq('tenant_id', row.tenant_id)
      .eq('lead_id', row.lead_id)
      .gt('created_at', row.created_at)
      .limit(1);

    if (followUp?.length) continue;

    const { data: owner } = await admin
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', row.tenant_id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle();

    if (!owner?.user_id) continue;

    if (hoursSince >= HOURS_FOLLOWUP_OVERDUE) {
      overdue += 1;
      await emitTenantBusinessEvent({
        tenantId: row.tenant_id,
        userId: owner.user_id,
        eventType: 'lead.replied',
        source: 'system',
        title: `Follow-up overdue — ${row.lead_email || 'prospect'}`,
        message: `A prospect replied ${Math.floor(hoursSince)}h ago and has not received a follow-up.`,
        actionUrl: '/dashboard/crm/leads',
        entityType: 'lead',
        entityId: row.lead_id || undefined,
        status: 'at_risk',
      }).catch(() => undefined);
      notifications += 1;
    } else {
      needsAttention += 1;
      await emitTenantBusinessEvent({
        tenantId: row.tenant_id,
        userId: owner.user_id,
        eventType: 'lead.replied',
        source: 'system',
        title: `Reply needs attention — ${row.lead_email || 'prospect'}`,
        message: `Prospect replied to ${row.campaign_name || 'outreach'} ${Math.floor(hoursSince)}h ago.`,
        actionUrl: '/dashboard/crm/leads',
        entityType: 'lead',
        entityId: row.lead_id || undefined,
        status: 'waiting',
      }).catch(() => undefined);
      notifications += 1;
    }
  }

  return { scanned, needs_attention: needsAttention, overdue, notifications };
}
