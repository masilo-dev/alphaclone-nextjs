import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { withCronJob } from '@/lib/cron/withCronJob';
import { guardCronTenantRow } from '@/lib/tenant/cronTenantGuard';
import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';
import { processSequenceEnrollments } from '@/lib/outreach/processSequenceEnrollments';

export const dynamic = 'force-dynamic';

/**
 * Sequence Worker Cron — multi-step email sequences (Drip Campaigns).
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  return withCronJob('sequence-worker', async () => {
    const admin = createSupabaseAdminClient();
    const now = new Date();

    try {
      const lifecycleSequences = await processSequenceEnrollments(admin, 50);
      const { data: waiting, error } = await admin
        .from('campaign_recipients')
        .select('id, campaign_id, contact_id, email, email_campaigns!inner(tenant_id)')
        .eq('status', 'waiting')
        .lte('next_step_at', now.toISOString())
        .limit(50);

      if (error || !waiting?.length) {
        return NextResponse.json({ success: true, processed: 0, lifecycleSequences });
      }

      let processed = 0;
      for (const record of waiting) {
        const campaignJoin = (record as { email_campaigns?: { tenant_id?: string } }).email_campaigns;
        const guard = await guardCronTenantRow(
          { id: record.id, tenant_id: campaignJoin?.tenant_id },
          'campaign_recipients',
          { campaign_id: record.campaign_id }
        );
        if (!guard.ok) continue;

        try {
          await admin.from('campaign_recipients').update({ status: 'pending' }).eq('id', record.id);
          await sendScheduledCampaignServer(record.campaign_id);
          processed += 1;
        } catch (e) {
          console.error(`Drip failure for ${record.email}:`, e);
        }
      }

      return NextResponse.json({ success: true, processed, lifecycleSequences });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sequence worker failed';
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  });
}
