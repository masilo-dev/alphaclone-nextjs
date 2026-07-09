import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { emailCampaignService } from '@/services/emailCampaignService';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { sendEmail } from '@/lib/email/sendEmail';
import { sendWhatsAppMessage, isWhatsAppConfigured } from '@/lib/whatsapp/sendWhatsApp';
import { blocksBonnieSend, campaignQualityCheck } from '@/lib/bonnie/bonnieBannedLanguage';
import { bonnieErrorMessage, BONNIE_KNOWN_ERRORS } from '@/lib/bonnie/bonnieError';

type CampaignProvider = 'sendgrid' | 'resend' | 'brevo' | 'zoho';
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
    if (raw === 'sendgrid' || raw === 'resend' || raw === 'brevo' || raw === 'zoho') return raw;
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

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function resolvePhoneForRecipient(
    admin: ReturnType<typeof createSupabaseAdminClient>,
    tenantId: string,
    email: string
): Promise<string | null> {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;

    const { data: lead } = await admin
        .from('leads')
        .select('phone')
        .eq('tenant_id', tenantId)
        .ilike('email', normalized)
        .limit(1)
        .maybeSingle();
    if (lead?.phone) return String(lead.phone);

    const { data: client } = await admin
        .from('business_clients')
        .select('phone')
        .eq('tenant_id', tenantId)
        .ilike('email', normalized)
        .limit(1)
        .maybeSingle();
    if (client?.phone) return String(client.phone);

    const { data: contact } = await admin
        .from('contacts')
        .select('phone, custom_fields')
        .eq('tenant_id', tenantId)
        .ilike('email', normalized)
        .limit(1)
        .maybeSingle();
    if (contact?.phone) return String(contact.phone);

    const customFields = parseJsonObject(contact?.custom_fields);
    const customPhone = toNonEmptyString(customFields.phone) || toNonEmptyString(customFields.mobile);
    return customPhone;
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
            return {
                success: false,
                error: 'No pending recipients on this campaign. Add contacts in the campaign builder, or turn off “Skip previously contacted” if everyone was filtered out.',
            };
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

        const campaignQuality = campaignQualityCheck(bodySource);
        if (blocksBonnieSend(campaignQuality.score)) {
            const err = BONNIE_KNOWN_ERRORS.campaign_quality_failed(
                campaignQuality.score,
                campaignQuality.warnings
            );
            return { success: false, error: bonnieErrorMessage(err) };
        }

        const campaignFromEmail = String(c.from_email || 'notifications@alphaclonesystems.com');
        const campaignFromName = String(c.from_name || 'AlphaClone Systems');
        const replyTo = (c.reply_to as string) || undefined;
        const campaignLanguage = toNonEmptyString(rawMeta?.language) || toNonEmptyString(rawMeta?.languageMode) || undefined;
        const deliveryChannel = toNonEmptyString(rawMeta?.deliveryChannel) || 'email';
        const sendEmailChannel = deliveryChannel === 'email' || deliveryChannel === 'both';
        const sendWhatsappChannel = deliveryChannel === 'whatsapp' || deliveryChannel === 'both';

        const filters = [];
        if (c.tenant_id) filters.push(`tenant_id.eq.${c.tenant_id}`);
        else if (campaignCreatorId) filters.push(`user_id.eq.${campaignCreatorId}`);

        let query = admin
            .from('integrations')
            .select('type, enabled, config, user_id, tenant_id')
            .eq('enabled', true)
            .in('type', ['sendgrid', 'resend', 'brevo', 'zoho']);

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

        if (sendEmailChannel && !activeProviders.length) {
            return {
                success: false,
                error: 'No active email providers are connected for this campaign. Connect SendGrid, Resend, Brevo, or Zoho Mail.',
            };
        }

        if (sendWhatsappChannel) {
            const waReady = await isWhatsAppConfigured(String(c.tenant_id || ''));
            if (!waReady) {
                return {
                    success: false,
                    error: 'WhatsApp is not connected. Add your Zernio account ID under Settings → Integrations → WhatsApp.',
                };
            }
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
        const tenantId = String(c.tenant_id || '');
        const whatsappBodyBase = `${String(c.subject || '').trim()}\n\n${stripHtml(bodySource)}`.trim();

        if (sendWhatsappChannel) {
            for (const recipient of recipients) {
                const phone = await resolvePhoneForRecipient(admin, tenantId, recipient.email);
                if (!phone) {
                    if (!sendEmailChannel) {
                        await admin
                            .from('campaign_recipients')
                            .update({
                                status: 'failed',
                                error_message: 'No phone number on file for WhatsApp delivery',
                            })
                            .eq('id', recipient.id);
                    }
                    continue;
                }

                const waResult = await sendWhatsAppMessage({
                    tenantId,
                    phone,
                    message: whatsappBodyBase.slice(0, 4000),
                    contactId: recipient.contact_id || null,
                    metadata: { campaign_id: campaignId, channel: 'whatsapp_campaign' },
                });

                if (waResult.success) {
                    sentCount++;
                    await admin
                        .from('campaign_recipients')
                        .update({
                            status: sendEmailChannel ? 'pending' : 'sent',
                            sent_at: sendEmailChannel ? null : new Date().toISOString(),
                            metadata: {
                                ...(parseJsonObject(recipient.metadata)),
                                whatsapp_sent: true,
                                whatsapp_provider: waResult.provider,
                            },
                        })
                        .eq('id', recipient.id);
                } else if (!sendEmailChannel) {
                    await admin
                        .from('campaign_recipients')
                        .update({
                            status: 'failed',
                            error_message: waResult.error || 'WhatsApp send failed',
                            metadata: { whatsapp_provider: waResult.provider },
                        })
                        .eq('id', recipient.id);
                }
            }
        }

        if (!sendEmailChannel) {
            await admin
                .from('email_campaigns')
                .update({
                    status: 'sent',
                    total_sent: sentCount,
                    completed_at: new Date().toISOString(),
                })
                .eq('id', campaignId);
            return { success: true, error: null };
        }

        const emailRecipients = sendWhatsappChannel
            ? (await admin
                .from('campaign_recipients')
                .select('*')
                .eq('campaign_id', campaignId)
                .eq('status', 'pending'))?.data || []
            : recipients;

        const abTestMeta = parseJsonObject(rawMeta?.abTest);
        const abTestEnabled = abTestMeta.enabled === true && String(abTestMeta.subjectB || '').trim().length > 0;
        const abSubjectB = String(abTestMeta.subjectB || '').trim();
        const abSplitPercent = Math.min(100, Math.max(0, Number(abTestMeta.splitPercent) || 50));

        if (abTestEnabled && emailRecipients.length > 0) {
            const shuffled = [...emailRecipients];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const bCount = Math.round((shuffled.length * abSplitPercent) / 100);
            for (let i = 0; i < shuffled.length; i++) {
                const variant = i < bCount ? 'B' : 'A';
                const existingMeta = parseJsonObject(shuffled[i].metadata);
                await admin
                    .from('campaign_recipients')
                    .update({
                        metadata: { ...existingMeta, abVariant: variant },
                    })
                    .eq('id', shuffled[i].id);
                shuffled[i].metadata = { ...existingMeta, abVariant: variant };
            }
        }

        let failedCount = 0;

        for (const recipient of emailRecipients) {
            if (await isEmailSuppressed(String(c.tenant_id || ''), recipient.email)) {
                await admin
                    .from('campaign_recipients')
                    .update({
                        status: 'failed',
                        error_message: 'Recipient is suppressed',
                    })
                    .eq('id', recipient.id);
                failedCount += 1;
                continue;
            }

            let contactName = '';
            let companyName = '';
            let customFields: Record<string, unknown> = {};

            if (recipient.contact_id) {
                const { data: contact } = await admin
                    .from('contacts')
                    .select('id, full_name, email, custom_fields, company:companies(name, website)')
                    .eq('id', recipient.contact_id)
                    .single();

                contactName = String(contact?.full_name || '').trim();
                const companyRecord = Array.isArray(contact?.company) ? contact.company[0] : contact?.company;
                companyName = String(companyRecord?.name || companyRecord?.website || '').trim();
                customFields = (contact?.custom_fields as Record<string, unknown>) || {};
            } else {
                const meta = parseJsonObject(recipient.metadata);
                const clientId = toNonEmptyString(meta.client_id);
                if (clientId) {
                    const { data: client } = await admin
                        .from('business_clients')
                        .select('name, email, industry, website')
                        .eq('id', clientId)
                        .maybeSingle();
                    contactName = String(client?.name || '').trim();
                    companyName = String(client?.website || client?.industry || '').trim();
                }
            }

            const parts = contactName.split(/\s+/).filter(Boolean);

            const recipientData = {
                id: recipient.contact_id,
                email: recipient.email,
                firstName: parts[0] || undefined,
                lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
                company: companyName || undefined,
                ...(customFields || {}),
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
                failedCount += 1;
                continue;
            }

            const fromEmail = provider.fromEmail || campaignFromEmail;
            const fromName = provider.fromName || campaignFromName;
            const personalizedHtml = emailCampaignService.injectVariables(bodySource, {
                ...recipientData,
                fromName,
                senderName: fromName,
            });
            const recipientMeta = parseJsonObject(recipient.metadata);
            const abVariant = String(recipientMeta.abVariant || 'A');
            const subjectSource =
                abTestEnabled && abVariant === 'B' && abSubjectB
                    ? abSubjectB
                    : String(c.subject || '');
            const personalizedSubject = emailCampaignService.injectVariables(
                subjectSource,
                {
                    ...recipientData,
                    fromName,
                    senderName: fromName,
                }
            );
            const preferredProvider = provider.id;
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
                        provider_message_id: sendResult.emailId || null,
                        metadata: {
                            provider: sendResult.provider || provider.id,
                            provider_from: fromEmail,
                            provider_message_id: sendResult.emailId || null,
                            language: campaignLanguage,
                            abVariant: abVariant || 'A',
                        },
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
                failedCount += 1;
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

        if (sentCount === 0 && emailRecipients.length > 0) {
            await admin
                .from('email_campaigns')
                .update({
                    status: 'draft',
                    total_sent: 0,
                })
                .eq('id', campaignId);
            return {
                success: false,
                error: `No emails were delivered (${failedCount} failed). Check connected providers under Settings → Integrations and verify recipient emails.`,
            };
        }

        await admin
            .from('email_campaigns')
            .update({
                status: sentCount > 0 ? 'sent' : 'draft',
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
