import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';

interface CampaignPayload {
    campaignId: string;
    tenantId: string;
    userId: string;
}

/**
 * Legacy workflow entrypoint kept for compatibility.
 * Delegate to the production campaign sender so workflow-triggered sends
 * and dashboard/API sends follow the exact same provider-selection logic.
 */
export async function campaignDelivery({ campaignId, tenantId, userId }: CampaignPayload) {
    "use workflow";

    const result = await runCampaignDelivery(campaignId);
    if (!result.success) {
        throw new Error(result.error || 'Campaign delivery failed');
    }

    return { status: 'completed', campaignId, tenantId, userId };
}

async function runCampaignDelivery(campaignId: string) {
    "use step";
    return sendScheduledCampaignServer(campaignId);
}
