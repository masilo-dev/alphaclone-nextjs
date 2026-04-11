import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { emailCampaignService } from '@/services/emailCampaignService';

/**
 * Sends a scheduled campaign from cron/worker context (no browser session).
 * Uses service role for DB and internal API key for /api/email/send.
 */
export async function sendScheduledCampaignServer(campaignId: string): Promise<{
    success: boolean;
    error: string | null;
}> {
    const internalKey = process.env.INTERNAL_API_KEY;
    if (!internalKey) {
        return { success: false, error: 'INTERNAL_API_KEY is not set (required for cron email delivery)' };
    }

    const baseUrl = (ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech').replace(/\/$/, '');
    const admin = createSupabaseAdminClient();

    try {
        const { data: campaign, error: cError } = await admin
            .from('email_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (cError || !campaign) {
            return { success: false, error: cError?.message || 'Campaign not found' };
        }

        const { data: recipients, error: rError } = await admin
            .from('campaign_recipients')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('status', 'pending');

        if (rError) {
            return { success: false, error: rError.message };
        }

        if (!recipients?.length) {
            return { success: true, error: 'No pending recipients' };
        }

        const c = campaign as Record<string, unknown>;
        const rawMeta = c.metadata as Record<string, unknown> | undefined;
        const bodySource =
            (rawMeta?.bodyHtml as string) ||
            (c.body_html as string) ||
            (c.html_content as string) ||
            (c.content as string) ||
            'Empty email body';
        const fromEmail = String(c.from_email || 'notifications@alphaclone.tech');
        const fromName = String(c.from_name || 'AlphaClone Systems');
        const replyTo = (c.reply_to as string) || undefined;

        await admin
            .from('email_campaigns')
            .update({ status: 'sending', sent_at: new Date().toISOString() })
            .eq('id', campaignId);

        let sentCount = 0;

        for (const recipient of recipients) {
            const { data: contact } = await admin
                .from('contacts')
                .select('*')
                .eq('id', recipient.contact_id)
                .single();

            const recipientData = {
                id: recipient.contact_id,
                email: recipient.email,
                firstName: contact?.first_name,
                lastName: contact?.last_name,
                company: contact?.company_name,
                ...(contact?.metadata || {}),
            };

            const personalizedHtml = emailCampaignService.injectVariables(bodySource, recipientData);
            const personalizedSubject = emailCampaignService.injectVariables(
                String(c.subject || ''),
                recipientData
            );

            const res = await fetch(`${baseUrl}/api/email/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-api-key': internalKey,
                },
                body: JSON.stringify({
                    to: recipient.email,
                    subject: personalizedSubject,
                    html: personalizedHtml,
                    from: fromEmail,
                    fromName,
                    replyTo,
                    tenantId: c.tenant_id,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok && data.success) {
                sentCount++;
                await admin
                    .from('campaign_recipients')
                    .update({ status: 'sent', sent_at: new Date().toISOString() })
                    .eq('id', recipient.id);
            } else {
                await admin
                    .from('campaign_recipients')
                    .update({
                        status: 'failed',
                        error_message: data.error || `HTTP ${res.status}`,
                    })
                    .eq('id', recipient.id);
            }
        }

        await admin
            .from('email_campaigns')
            .update({
                status: 'sent',
                total_sent: sentCount,
                completed_at: new Date().toISOString(),
            })
            .eq('id', campaignId);

        return { success: true, error: null };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, error: msg };
    }
}
