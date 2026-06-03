import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { emailCampaignService } from '@/services/emailCampaignService';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { sendEmail } from '@/lib/email/sendEmail';

type CampaignProvider = 'sendgrid' | 'resend' | 'brevo' | 'zoho' | 'gmail';
type ProviderConfig = {
    id: CampaignProvider;
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
    dailyLimit: number;
};

const DEFAULT_DAILY_LIMITS: Record<CampaignProvider, number> = {
    sendgrid: 500,
    resend: 300,
    brevo: 300,
    zoho: 200,
    gmail: 150,
};

function toNonEmptyString(value: unknown): string | null {
    const next = String(value || '').trim();
    return next.length > 0 ? next : null;
}

function toNumberOrDefault(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function normalizeProviderId(value: unknown): CampaignProvider | null {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'sendgrid' || raw === 'resend' || raw === 'brevo' || raw === 'zoho' || raw === 'gmail') return raw;
    return null;
}

function resolveProviderConfig(provider: CampaignProvider, config: Record<string, unknown>): ProviderConfig {
    return {
        id: provider,
        apiKey: toNonEmptyString(config.apiKey) || toNonEmptyString(config.api_key) || undefined,
        fromEmail: toNonEmptyString(config.fromEmail) || toNonEmptyString(config.from_email) || undefined,
        fromName: toNonEmptyString(config.fromName) || toNonEmptyString(config.from_name) || undefined,
        dailyLimit: toNumberOrDefault(config.dailyLimit ?? config.daily_limit, DEFAULT_DAILY_LIMITS[provider]),
    };
}

function selectProviderForRecipient(
    providers: ProviderConfig[],
    providerCountsToday: Map<CampaignProvider, number>,
    balanceByDailyLimit: boolean
): ProviderConfig | null {
    if (!providers.length) return null;
    const available = providers.filter((provider) => (providerCountsToday.get(provider.id) || 0) < provider.dailyLimit);
    if (!available.length) return null;
    if (!balanceByDailyLimit) return available[0] || null;

    const ranked = [...available].sort((a, b) => {
        const aRemaining = a.dailyLimit - (providerCountsToday.get(a.id) || 0);
        const bRemaining = b.dailyLimit - (providerCountsToday.get(b.id) || 0);
        if (aRemaining !== bRemaining) return bRemaining - aRemaining;
        return (providerCountsToday.get(a.id) || 0) - (providerCountsToday.get(b.id) || 0);
    });
    return ranked[0] || null;
}

/**
 * Sends a scheduled campaign from cron/worker context (no browser session).
 * Uses service role for DB and internal API key for /api/email/send.
 */
export async function sendScheduledCampaignServer(campaignId: string): Promise<{
    success: boolean;
    error: string | null;
}> {
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
        const campaignCreatorId = String(c.created_by || '').trim();
        if (!campaignCreatorId) {
            return { success: false, error: 'Campaign creator is missing. Recreate the campaign and try again.' };
        }
        const rawMeta = c.metadata as Record<string, unknown> | undefined;
        const deliverySettings = parseJsonObject(rawMeta?.deliverySettings);
        const selectedProviders = Array.isArray(deliverySettings.selectedProviders)
            ? deliverySettings.selectedProviders
                  .map((value: unknown) => normalizeProviderId(value))
                  .filter((value: CampaignProvider | null): value is CampaignProvider => value !== null)
            : [];
        const balanceByDailyLimit = deliverySettings.balanceByDailyLimit !== false;
        const bodySource =
            (rawMeta?.bodyHtml as string) ||
            (c.body_html as string) ||
            (c.html_content as string) ||
            (c.content as string) ||
            'Empty email body';
        const campaignFromEmail = String(c.from_email || 'notifications@alphaclonesystems.com');
        const campaignFromName = String(c.from_name || 'AlphaClone Systems');
        const replyTo = (c.reply_to as string) || undefined;
        const campaignLanguage = toNonEmptyString(rawMeta?.language) || toNonEmptyString(rawMeta?.languageMode) || undefined;

        const filters = [];
        if (campaignCreatorId) filters.push(`user_id.eq.${campaignCreatorId}`);
        if (c.tenant_id) filters.push(`tenant_id.eq.${c.tenant_id}`);

        let query = admin
            .from('integrations')
            .select('type, enabled, config')
            .eq('enabled', true)
            .in('type', ['sendgrid', 'resend', 'brevo', 'zoho', 'gmail']);

        if (filters.length > 0) {
            query = query.or(filters.join(','));
        }

        const { data: integrationRows, error: integrationError } = await query;
        if (integrationError) return { success: false, error: integrationError.message };

        const providerConfigs = (integrationRows || [])
            .map((row: any) => {
                const provider = normalizeProviderId(row.type);
                if (!provider) return null;
                return resolveProviderConfig(provider, parseJsonObject(row.config));
            })
            .filter((row: ProviderConfig | null): row is ProviderConfig => row !== null);

        const activeProviders = providerConfigs.filter((provider: any) =>
            selectedProviders.length > 0 ? selectedProviders.includes(provider.id) : true
        );

        if (!activeProviders.length) {
            return {
                success: false,
                error: 'No active email providers are connected for this campaign. Connect SendGrid, Resend, Brevo, Zoho Mail, or Gmail.',
            };
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { data: sentTodayRows } = await admin
            .from('campaign_recipients')
            .select('metadata')
            .eq('tenant_id', c.tenant_id)
            .gte('sent_at', startOfDay.toISOString())
            .in('status', ['sent', 'delivered', 'opened', 'clicked']);
        const providerCountsToday = new Map<CampaignProvider, number>();
        for (const row of sentTodayRows || []) {
            const providerId = normalizeProviderId(parseJsonObject(row.metadata).provider);
            if (providerId) {
                providerCountsToday.set(providerId, (providerCountsToday.get(providerId) || 0) + 1);
            }
        }

        await admin
            .from('email_campaigns')
            .update({ status: 'sending', sent_at: new Date().toISOString() })
            .eq('id', campaignId);

        let sentCount = 0;

        for (const recipient of recipients) {
            if (await isEmailSuppressed(String(c.tenant_id || ''), recipient.email)) {
                await admin
                    .from('campaign_recipients')
                    .update({
                        status: 'failed',
                        error_message: 'Recipient is suppressed',
                    })
                    .eq('id', recipient.id);
                continue;
            }

            const { data: contact } = await admin
                .from('contacts')
                .select('id, full_name, email, custom_fields, company:companies(name, website)')
                .eq('id', recipient.contact_id)
                .single();

            const contactName = String(contact?.full_name || '').trim();
            const parts = contactName.split(/\s+/).filter(Boolean);
            const companyRecord = Array.isArray(contact?.company) ? contact.company[0] : contact?.company;
            const companyName = String(companyRecord?.name || companyRecord?.website || '').trim();

            const recipientData = {
                id: recipient.contact_id,
                email: recipient.email,
                firstName: parts[0] || undefined,
                lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
                company: companyName || undefined,
                ...(contact?.custom_fields || {}),
            };

            const provider = selectProviderForRecipient(activeProviders, providerCountsToday, balanceByDailyLimit);
            if (!provider) {
                await admin
                    .from('campaign_recipients')
                    .update({
                        status: 'failed',
                        error_message: 'Daily sending limits reached for all selected providers',
                    })
                    .eq('id', recipient.id);
                continue;
            }

            const fromEmail = provider.fromEmail || campaignFromEmail;
            const fromName = provider.fromName || campaignFromName;
            const personalizedHtml = emailCampaignService.injectVariables(bodySource, {
                ...recipientData,
                fromName,
                senderName: fromName,
            });
            const personalizedSubject = emailCampaignService.injectVariables(
                String(c.subject || ''),
                {
                    ...recipientData,
                    fromName,
                    senderName: fromName,
                }
            );
            const preferredProvider = provider.id === 'gmail' ? undefined : provider.id;
            const sendResult = await sendEmail(String(c.tenant_id || ''), {
                to: recipient.email,
                subject: personalizedSubject,
                html: personalizedHtml,
                from_name: fromName,
                reply_to: replyTo,
                userId: campaignCreatorId,
                templateName: 'emailCampaign',
            }, preferredProvider);

            if (sendResult.success) {
                sentCount++;
                const usedProvider = normalizeProviderId(sendResult.provider) || provider.id;
                providerCountsToday.set(usedProvider, (providerCountsToday.get(usedProvider) || 0) + 1);
                await admin
                    .from('campaign_recipients')
                    .update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        metadata: { provider: sendResult.provider || provider.id, provider_from: fromEmail, language: campaignLanguage },
                    })
                    .eq('id', recipient.id);
                try {
                    await captureUnifiedMessageFromWebhook({
                        supabase: admin as any,
                        tenantId: String(c.tenant_id || ''),
                        source: (sendResult.provider || provider.id) as any,
                        channel: 'email',
                        direction: 'outbound',
                        externalId: String(recipient.id),
                        threadId: String(campaignId),
                        from: fromEmail,
                        to: recipient.email,
                        subject: personalizedSubject,
                        text: null,
                        html: personalizedHtml,
                        sentAt: new Date().toISOString(),
                        metadata: {
                            campaignId,
                            campaignName: String(c.name || ''),
                            contactId: recipient.contact_id,
                            provider: sendResult.provider || provider.id,
                            providerFrom: fromEmail,
                            language: campaignLanguage,
                        },
                    });
                } catch {
                    // Non-blocking: campaign delivery should not fail due to analytics capture issues.
                }
            } else {
                await admin
                    .from('campaign_recipients')
                    .update({
                        status: 'failed',
                        error_message: sendResult.error || 'Provider send failed',
                        metadata: { provider: provider.id, provider_from: fromEmail, language: campaignLanguage, tried: sendResult.tried },
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
