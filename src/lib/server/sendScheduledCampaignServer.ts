import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { emailCampaignService } from '@/services/emailCampaignService';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { gmailServerService } from '@/services/server/gmailServerService';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

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

function encodeGmailRawMessage(params: {
    to: string;
    subject: string;
    html: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
}) {
    const utf8Subject = `=?utf-8?B?${Buffer.from(params.subject).toString('base64')}?=`;
    const message = [
        `From: ${params.fromName} <${params.fromEmail}>`,
        `To: ${params.to}`,
        params.replyTo ? `Reply-To: ${params.replyTo}` : null,
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset="UTF-8"',
        '',
        params.html,
    ]
        .filter(Boolean)
        .join('\n');

    return Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
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

async function sendViaProvider(
    provider: ProviderConfig,
    args: {
        to: string;
        subject: string;
        html: string;
        fromEmail: string;
        fromName: string;
        replyTo?: string;
        userId: string;
    }
): Promise<{ success: boolean; error?: string }> {
    if (provider.id === 'sendgrid') {
        if (!provider.apiKey) return { success: false, error: 'SendGrid API key is missing' };
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: args.to }] }],
                from: { email: args.fromEmail, name: args.fromName },
                subject: args.subject,
                content: [{ type: 'text/html', value: args.html }],
                reply_to: args.replyTo ? { email: args.replyTo } : undefined,
            }),
        });
        if (!response.ok) return { success: false, error: `SendGrid rejected request (${response.status})` };
        return { success: true };
    }

    if (provider.id === 'resend') {
        if (!provider.apiKey) return { success: false, error: 'Resend API key is missing' };
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify({
                from: `${args.fromName} <${args.fromEmail}>`,
                to: args.to,
                subject: args.subject,
                html: args.html,
                reply_to: args.replyTo,
            }),
        });
        if (!response.ok) return { success: false, error: `Resend rejected request (${response.status})` };
        return { success: true };
    }

    if (provider.id === 'brevo') {
        if (!provider.apiKey) return { success: false, error: 'Brevo API key is missing' };
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': provider.apiKey,
            },
            body: JSON.stringify({
                sender: { email: args.fromEmail, name: args.fromName },
                to: [{ email: args.to }],
                subject: args.subject,
                htmlContent: args.html,
                replyTo: args.replyTo ? { email: args.replyTo } : undefined,
            }),
        });
        if (!response.ok) return { success: false, error: `Brevo rejected request (${response.status})` };
        return { success: true };
    }

    if (provider.id === 'zoho') {
        const zoho = new ZohoMailService(args.userId);
        await zoho.sendEmail({
            fromAddress: args.fromEmail,
            toAddress: args.to,
            subject: args.subject,
            content: args.html,
        });
        return { success: true };
    }

    if (provider.id === 'gmail') {
        const raw = encodeGmailRawMessage({
            to: args.to,
            subject: args.subject,
            html: args.html,
            fromEmail: args.fromEmail,
            fromName: args.fromName,
            replyTo: args.replyTo,
        });
        await gmailServerService.proxyRequest(args.userId, 'messages/send', {
            method: 'POST',
            body: JSON.stringify({ raw }),
        });
        return { success: true };
    }

    return { success: false, error: 'Unsupported provider' };
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

        const { data: integrationRows, error: integrationError } = await admin
            .from('integrations')
            .select('type, enabled, config')
            .eq('user_id', campaignCreatorId)
            .eq('enabled', true)
            .in('type', ['sendgrid', 'resend', 'brevo', 'zoho', 'gmail']);
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
            const sendResult = await sendViaProvider(provider, {
                to: recipient.email,
                subject: personalizedSubject,
                html: personalizedHtml,
                fromEmail,
                fromName,
                replyTo,
                userId: campaignCreatorId,
            });

            if (sendResult.success) {
                sentCount++;
                providerCountsToday.set(provider.id, (providerCountsToday.get(provider.id) || 0) + 1);
                await admin
                    .from('campaign_recipients')
                    .update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        metadata: { provider: provider.id, provider_from: fromEmail },
                    })
                    .eq('id', recipient.id);
                try {
                    await captureUnifiedMessageFromWebhook({
                        supabase: admin as any,
                        tenantId: String(c.tenant_id || ''),
                        source: provider.id,
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
                            provider: provider.id,
                            providerFrom: fromEmail,
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
                        metadata: { provider: provider.id, provider_from: fromEmail },
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
