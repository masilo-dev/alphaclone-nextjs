import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
<<<<<<< HEAD
=======
import { start } from 'workflow/api';
import { emailCampaignWorkflow } from '@/workflows/email-campaign';
>>>>>>> origin/main
import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';
import { campaignSendSchema } from '@/schemas/validation';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = campaignSendSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
        }
        const tenantId = parsed.data.tenantId;
        const campaignId = parsed.data.campaignId;

        await requireTenantAccess(tenantId);
        const result = await sendScheduledCampaignServer(campaignId);
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to send campaign', code: 'CAMPAIGN_SEND_FAILED' }, { status: 500 });
        }
<<<<<<< HEAD

        return NextResponse.json({ success: true, mode: 'direct_provider_delivery' });
=======
        const { runId } = await start(emailCampaignWorkflow, [{ campaignId, tenantId }]);

        return NextResponse.json({ success: true, runId });
>>>>>>> origin/main
    } catch (error) {
        return routeErrorResponse(error, 'Failed to send campaign', request);
    }
}
