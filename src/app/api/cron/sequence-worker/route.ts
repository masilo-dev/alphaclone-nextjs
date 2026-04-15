import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
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
            .select('id, campaign_id, contact_id, email')
            .eq('status', 'waiting')
            .lte('next_step_at', now.toISOString())
            .limit(50);

        if (error || !waiting?.length) {
            return NextResponse.json({ success: true, processed: 0 });
        }

        let processed = 0;
        for (const record of waiting) {
            // Logic to trigger the next email step
            // This pulls the next template from the sequence and sends via the campaign server
            try {
                await sendScheduledCampaignServer(record.campaign_id, record.contact_id);
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
