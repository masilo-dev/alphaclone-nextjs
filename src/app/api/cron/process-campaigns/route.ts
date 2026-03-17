import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { emailCampaignService } from '@/services/emailCampaignService';

/**
 * Cron-triggered endpoint to process scheduled campaigns
 * This should be called every 5-15 minutes by a GitHub Action or similar.
 */
export async function GET(req: NextRequest) {
    // Basic verification (optional: add a secret key check)
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const now = new Date().toISOString();

        // 1. Find campaigns that are scheduled and ready to be sent
        const { data: campaigns, error } = await supabase
            .from('email_campaigns')
            .select('id')
            .eq('status', 'scheduled')
            .lte('scheduled_at', now);

        if (error) throw error;

        if (!campaigns || campaigns.length === 0) {
            return NextResponse.json({ message: 'No campaigns to process' });
        }

        const results = [];
        for (const campaign of campaigns) {
            const result = await emailCampaignService.sendCampaign(campaign.id);
            results.push({ id: campaign.id, ...result });
        }

        return NextResponse.json({
            message: `Processed ${campaigns.length} campaigns`,
            results
        });
    } catch (err: any) {
        console.error('Campaign Processing Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
