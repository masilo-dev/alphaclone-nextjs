import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendUniversalEmail } from '@/lib/email/universalEmailEngine';
import { recordBusinessActivity } from '@/lib/audit/businessAuditEngine';

const BATCH = 100;

export async function runTenantEventInboxDigest(): Promise<{
  tenants_processed: number;
  emails_sent: number;
  events_consumed: number;
  skipped: number;
}> {
  const admin = createSupabaseAdminClient();
  let emailsSent = 0;
  let eventsConsumed = 0;
  let skipped = 0;

  const { data: pendingByTenant } = await admin
    .from('tenant_business_event_inbox')
    .select('tenant_id')
    .eq('digest_status', 'pending')
    .limit(500);

  const tenantIds = [...new Set((pendingByTenant || []).map((r) => r.tenant_id))];

  for (const tenantId of tenantIds) {
    const { data: events } = await admin
      .from('tenant_business_event_inbox')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('digest_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH);

    if (!events?.length) continue;

    const { data: owner } = await admin
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle();

    if (!owner?.user_id) {
      skipped += events.length;
      continue;
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('email, name')
      .eq('id', owner.user_id)
      .maybeSingle();

    if (!profile?.email) {
      skipped += events.length;
      continue;
    }

    const lines = events.map((e) => `• ${e.title}: ${e.message || ''}`).join('\n');
    const leadCount = String(events.length);

    const send = await sendUniversalEmail({
      templateKey: 'end_of_day_summary',
      tenantId,
      recipientEmail: profile.email,
      userId: owner.user_id,
      variables: {
        first_name: profile.name?.split(' ')[0] || 'there',
        lead_count: leadCount,
        greeting: `Your business digest (${events.length} updates)`,
      },
      skipPreferenceCheck: false,
    });

    if (send.success) {
      emailsSent += 1;
      const ids = events.map((e) => e.id);
      await admin
        .from('tenant_business_event_inbox')
        .update({ digest_status: 'sent' })
        .in('id', ids);
      eventsConsumed += events.length;

      await recordBusinessActivity({
        tenantId,
        event: `Business digest sent (${events.length} updates)`,
        actor: 'AlphaClone',
        businessContext: lines.slice(0, 500),
        result: 'Digest delivered',
        status: 'success',
      }).catch(() => undefined);
    } else {
      skipped += events.length;
    }
  }

  return {
    tenants_processed: tenantIds.length,
    emails_sent: emailsSent,
    events_consumed: eventsConsumed,
    skipped,
  };
}
