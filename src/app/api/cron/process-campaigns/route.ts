import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';

export const dynamic = 'force-dynamic';

/**
 * Cron-triggered endpoint to process scheduled campaigns (every 5–15 minutes).
 * Auth: Railway Cron (`x-railway-cron`) or `Authorization: Bearer ${CRON_SECRET}`.
 * Requires INTERNAL_API_KEY for outbound email via /api/email/send.
 */
export async function GET(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    try {
        const now = new Date().toISOString();
        const admin = createSupabaseAdminClient();

        const { data: campaigns, error } = await admin
            .from('email_campaigns')
            .select('id')
            .eq('status', 'scheduled')
            .lte('scheduled_at', now);

        if (error) throw error;

        if (!campaigns?.length) {
            return NextResponse.json({ message: 'No campaigns to process' });
        }

        const results = [];
        for (const campaign of campaigns) {
            const result = await sendScheduledCampaignServer(campaign.id);
            results.push({ id: campaign.id, ...result });
        }

        return NextResponse.json({
            message: `Processed ${campaigns.length} campaigns`,
            results,
        });
    } catch (err: unknown) {
        console.error('Campaign Processing Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'cron/process-campaigns.GET' });
    }
}
