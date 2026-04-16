import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const tenantId = String(body.tenantId || '').trim();
        const campaignId = String(body.campaignId || '').trim();
        if (!tenantId || !campaignId) {
            return NextResponse.json({ error: 'tenantId and campaignId are required' }, { status: 400 });
        }

        await requireTenantAccess(tenantId);
        const result = await sendScheduledCampaignServer(campaignId);
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to send campaign' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to send campaign');
    }
}
