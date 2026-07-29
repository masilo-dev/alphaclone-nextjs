import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
<<<<<<< HEAD
import { guardCronTenantRow } from '@/lib/tenant/cronTenantGuard';
=======
>>>>>>> origin/main
import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';

export const dynamic = 'force-dynamic';

/**
 * Sequence Worker Cron
 * 
 * Handles multi-step email sequences (Drip Campaigns).
 * It checks for "Waiting" drips whose delay period has passed.
 */
export async function GET(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    const admin = createSupabaseAdminClient();
    const now = new Date();

    try {
        // 1. Find campaign recipients in 'waiting' status whose delay is over
        // We assume campaign_recipients has a 'next_step_at' column for drips
        const { data: waiting, error } = await admin
            .from('campaign_recipients')
<<<<<<< HEAD
            .select('id, campaign_id, contact_id, email, email_campaigns!inner(tenant_id)')
=======
            .select('id, campaign_id, contact_id, email')
>>>>>>> origin/main
            .eq('status', 'waiting')
            .lte('next_step_at', now.toISOString())
            .limit(50);

        if (error || !waiting?.length) {
            return NextResponse.json({ success: true, processed: 0 });
        }

        let processed = 0;
        for (const record of waiting) {
<<<<<<< HEAD
            const campaignJoin = (record as { email_campaigns?: { tenant_id?: string } }).email_campaigns;
            const guard = await guardCronTenantRow(
                { id: record.id, tenant_id: campaignJoin?.tenant_id },
                'campaign_recipients',
                { campaign_id: record.campaign_id }
            );
            if (!guard.ok) continue;

=======
>>>>>>> origin/main
            // Logic to trigger the next email step
            // 1. Move from 'waiting' to 'pending' so the campaign server picks it up
            // 2. Call the server for that campaign
            try {
                await admin
                    .from('campaign_recipients')
                    .update({ status: 'pending' })
                    .eq('id', record.id);

                await sendScheduledCampaignServer(record.campaign_id);
                processed++;
            } catch (e) {
                console.error(`Drip failure for ${record.email}:`, e);
            }
        }

        return NextResponse.json({ success: true, processed });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
