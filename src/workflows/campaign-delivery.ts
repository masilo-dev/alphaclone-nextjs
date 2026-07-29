<<<<<<< HEAD
import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';
=======
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { emailCampaignService } from "@/services/emailCampaignService";
>>>>>>> origin/main

interface CampaignPayload {
    campaignId: string;
    tenantId: string;
    userId: string;
}

<<<<<<< HEAD
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
=======
export async function campaignDelivery({ campaignId, tenantId, userId }: CampaignPayload) {
    "use workflow";

    // 1. Fetch campaign and recipients
    const { recipients, campaign } = await fetchRecipients(campaignId);

    if (!recipients.length) return { status: "no-recipients" };

    // 2. Batch processing (50 recipients per batch)
    const batchSize = 50;
    const totalBatches = Math.ceil(recipients.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
        const batch = recipients.slice(i * batchSize, (i + 1) * batchSize);
        
        await processBatch(batch, campaign, i);
        await updateProgress(campaignId, i, totalBatches);
    }

    return { status: "completed", totalRecipients: recipients.length };
}

async function fetchRecipients(campaignId: string) {
    "use step";
    const { recipients, error } = await emailCampaignService.getCampaignRecipients(campaignId);
    if (error) throw new Error(error);
    
    const { campaigns } = await emailCampaignService.getCampaigns();
    const campaign = campaigns.find((c: any) => c.id === campaignId);
    
    return { recipients, campaign };
}

async function processBatch(batch: any[], campaign: any, batchIndex: number) {
    "use step";
    const { emailProviderService } = await import("@/services/EmailProviderService");
    const { supabase } = await import("@/lib/supabase");

    for (const recipient of batch) {
        try {
            const content = emailCampaignService.injectVariables(campaign?.bodyHtml || "", {
                email: recipient.email,
                firstName: recipient.firstName,
                lastName: recipient.lastName,
                company: recipient.company,
            } as any);

            const result = await emailProviderService.sendEmail({
                to: recipient.email,
                subject: campaign?.subject || "Campaign",
                html: content,
                fromName: campaign?.fromName || "AlphaClone Systems",
                from: campaign?.fromEmail || "notifications@alphaclonesystems.com"
            });

            if (result.success) {
                await supabase.from('campaign_recipients').update({ 
                    status: 'sent', 
                    sent_at: new Date().toISOString() 
                }).eq('id', recipient.id);
            } else {
                await supabase.from('campaign_recipients').update({ 
                    status: 'failed', 
                    error_message: result.error 
                }).eq('id', recipient.id);
            }
        } catch (e) {
            console.error(`Failed to send to ${recipient.email}:`, e);
        }
    }
}

async function updateProgress(campaignId: string, batchIndex: number, totalBatches: number) {
    "use step";
    const { supabase } = await import("@/lib/supabase");
    const { data: counts } = await supabase
        .from('campaign_recipients')
        .select('status', { count: 'exact' })
        .eq('campaign_id', campaignId);
    
    const sent = (counts || []).filter((c: any) => c.status === 'sent').length;
    
    await supabase.from('email_campaigns').update({
        total_sent: sent,
        status: batchIndex === totalBatches - 1 ? 'sent' : 'sending',
        completed_at: batchIndex === totalBatches - 1 ? new Date().toISOString() : null
    }).eq('id', campaignId);
>>>>>>> origin/main
}
