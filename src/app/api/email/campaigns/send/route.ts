import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';
import { campaignSendSchema } from '@/schemas/validation';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';
import { sendCampaignViaListmonk } from '@/lib/marketing/sendCampaignViaListmonk';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = campaignSendSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
        }
        const tenantId = parsed.data.tenantId;
        const campaignId = parsed.data.campaignId;

        const { admin } = await requireTenantAccess(tenantId, request);
        const listmonkEnabled = await isExecutionFeatureEnabled(admin, 'LISTMONK_ENABLED', tenantId);

        if (listmonkEnabled) {
            const result = await sendCampaignViaListmonk({ tenantId, campaignId });
            if (!result.success) {
                return NextResponse.json({
                    error: result.error || 'Listmonk campaign delivery failed',
                    code: 'LISTMONK_CAMPAIGN_SEND_FAILED',
                }, { status: 503 });
            }
            return NextResponse.json({
                success: true,
                mode: 'listmonk',
                listmonkCampaignId: result.listmonkCampaignId,
            });
        }

        const result = await sendScheduledCampaignServer(campaignId);
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to send campaign', code: 'CAMPAIGN_SEND_FAILED' }, { status: 500 });
        }

        return NextResponse.json({ success: true, mode: 'direct_provider_delivery' });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to send campaign', request);
    }
}
