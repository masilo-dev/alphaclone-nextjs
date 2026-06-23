import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
    try {
        const { campaignId, tenantId } = await req.json();

        if (!campaignId || !tenantId) {
            return NextResponse.json({ error: 'Missing campaignId or tenantId' }, { status: 400 });
        }

        return NextResponse.json(
            {
                error: 'This legacy campaign send endpoint is deprecated. Use Marketing Campaigns in the dashboard or POST /api/email/campaigns/send.',
                code: 'DEPRECATED_ENDPOINT',
            },
            { status: 410 },
        );
    } catch (err: any) {
        console.error('Campaign send error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
