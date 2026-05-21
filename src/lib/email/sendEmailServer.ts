import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { resolveEmailProviderConfig } from '@/lib/email/providerIntegrationResolver';
import { ensureFooter, normalizeEmailSubject } from '@/lib/email/emailComposition';
import { logEmailSend } from '@/lib/emailLogger';
import { validateRecipient } from '@/lib/email/validateRecipient';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';

export interface SendEmailServerParams {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    message?: string;
    fromName?: string;
    tenantId: string;
    userId?: string;
    replyTo?: string;
    attachments?: any[];
    isPlatformNotification?: boolean;
    templateName?: string;
    listUnsubscribeUrl?: string;
}

export interface SendEmailServerResult {
    success: boolean;
    emailId?: string;
    provider?: string;
    error?: string;
    errorDetails?: any;
    code?: string;
}

/**
 * Execute email sending synchronously/programmatically on the server.
 * Handles validation, sanitization, config resolution, suppression checks, SDK delivery, and logging.
 */
export async function sendEmailServer(params: SendEmailServerParams): Promise<SendEmailServerResult> {
    const emailId = uuidv4(); // Generate email ID upfront so logs match
    const {
        to,
        subject,
        html,
        text,
        message,
        fromName,
        tenantId,
        userId,
        replyTo,
        attachments,
        isPlatformNotification,
        templateName,
        listUnsubscribeUrl
    } = params;

    try {
        const supabase = createSupabaseAdminClient();

        // 1. Recipient Validation
        const recipients = Array.isArray(to) ? to : [to];
        for (const recipient of recipients) {
            const { allowed, reason } = await validateRecipient(supabase, tenantId, recipient);
            if (!allowed) {
                await supabase.from('email_audit_log').insert({
                    tenant_id: tenantId,
                    user_id: userId || null,
                    to_email: recipient,
                    subject,
                    allowed: false,
                    blocked_reason: reason,
                });
                return { success: false, error: reason, code: 'BLOCKED_RECIPIENT' };
            }
        }

        // 2. HTML Sanitization & Footer Normalization
        const bodyText = text || message;
        const normalizedText = ensureFooter(bodyText || '');
        const normalizedHtml = html
            ? ensureFooter(sanitizeHtml(String(html), {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style']),
                allowedAttributes: {
                    ...sanitizeHtml.defaults.allowedAttributes,
                    '*': ['style', 'class'],
                }
            }))
            : undefined;

        if (!to || !subject || (!normalizedHtml && !bodyText)) {
            return { success: false, error: 'to, subject, and content are required', code: 'MISSING_FIELDS' };
        }

        const normalizedSubject = normalizeEmailSubject(subject);

        // 3. Resolve Credentials
        let fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'onboarding@alphacone.io';
        let provider: EmailProvider = 'sendgrid';
        let lookupId = userId;

        if (!lookupId && tenantId) {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('created_by')
                .eq('id', tenantId)
                .single();
            lookupId = tenant?.created_by || undefined;
        }

        const resolved = await resolveEmailProviderConfig({
            tenantId: tenantId || null,
            preferredUserId: lookupId || null,
            fallbackToEnv: true,
            forcePlatform: Boolean(isPlatformNotification),
        });

        const apiKey = resolved?.apiKey || '';
        if (resolved?.provider) {
            provider = resolved.provider as EmailProvider;
            fromEmail = resolved.fromEmail || fromEmail;
        }

        const providerNeedsKey = provider === 'sendgrid' || provider === 'resend' || provider === 'brevo';
        if (providerNeedsKey && !apiKey) {
            return { success: false, error: 'Email service not configured for this account', code: 'CONFIG_MISSING' };
        }

        // 4. Suppression check
        for (const recipient of recipients) {
            if (await isEmailSuppressed(tenantId, recipient)) {
                return {
                    success: false,
                    error: `Recipient is suppressed: ${recipient}`,
                    code: 'EMAIL_SUPPRESSED'
                };
            }
        }

        const finalUnsubscribeUrl = listUnsubscribeUrl
            || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?email=${encodeURIComponent(recipients[0])}` : undefined);

        // 5. Execute Send
        const result = await sendWithProviderSdk(provider, {
            apiKey,
            fromEmail,
            fromName: fromName || 'AlphaClone Systems',
            to,
            subject: normalizedSubject,
            html: normalizedHtml,
            text: normalizedText,
            replyTo,
            listUnsubscribeUrl: finalUnsubscribeUrl,
            attachments: Array.isArray(attachments) ? attachments : undefined,
            userId: lookupId || undefined,
        });

        if (result.ok) {
            await supabase.from('email_audit_log').insert({
                tenant_id: tenantId,
                user_id: userId || null,
                to_email: recipients.join(','),
                subject: normalizedSubject,
                provider,
                allowed: true,
            });

            await logEmailSend({
                tenantId: tenantId || null,
                userId: lookupId || null,
                provider,
                toEmail: Array.isArray(to) ? to.join(', ') : to,
                subject: normalizedSubject,
                templateName: templateName || undefined,
                status: 'sent',
                emailId: result.emailId || emailId
            });

            return {
                success: true,
                emailId: result.emailId || emailId,
                provider,
            };
        }

        // SDK sending failed
        await logEmailSend({
            tenantId: tenantId || null,
            userId: lookupId || null,
            provider,
            toEmail: Array.isArray(to) ? to.join(', ') : to,
            subject: normalizedSubject,
            templateName: templateName || undefined,
            status: 'failed',
            error: result.error
        });

        return {
            success: false,
            error: 'Email provider rejected request',
            errorDetails: result.error,
            code: 'PROVIDER_REJECTED'
        };

    } catch (error: any) {
        console.error('Error in sendEmailServer:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
            code: 'INTERNAL_ERROR'
        };
    }
}
