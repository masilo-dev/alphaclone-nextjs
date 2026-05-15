import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { resolveEmailProviderConfig } from '@/lib/email/providerIntegrationResolver';
import { ensureFooter, normalizeEmailSubject } from '@/lib/email/emailComposition';
import { logEmailSend } from '@/lib/emailLogger';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { validateRecipient } from '@/lib/email/validateRecipient';

const SendEmailSchema = z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string().min(1).max(250),
    html: z.string().max(100000).optional(),
    text: z.string().max(50000).optional(),
    message: z.string().max(50000).optional(),
    fromName: z.string().max(100).optional(),
    tenantId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    replyTo: z.string().email().optional(),
    attachments: z.array(z.any()).optional(),
    isPlatformNotification: z.boolean().optional(),
    templateName: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = SendEmailSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const { to, subject, html, text, message, fromName, tenantId, userId, replyTo, attachments, isPlatformNotification } = parsed.data;

        const internalKey = req.headers.get('x-internal-api-key');
        const internalOk =
            Boolean(internalKey) &&
            internalKey === process.env.INTERNAL_API_KEY;

        let authUserId: string | null = null;
        if (!internalOk) {
            const authClient = await createSupabaseServerClient();
            const {
                data: { user },
            } = await authClient.auth.getUser();
            if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            authUserId = user.id;
        }

        const supabase = createSupabaseAdminClient();

        // 1. Recipient Validation
        const recipients = Array.isArray(to) ? to : [to];
        for (const recipient of recipients) {
            const { allowed, reason } = await validateRecipient(supabase, tenantId, recipient);
            if (!allowed) {
                await supabase.from('email_audit_log').insert({
                    tenant_id: tenantId,
                    user_id: authUserId || userId || null,
                    to_email: recipient,
                    subject,
                    allowed: false,
                    blocked_reason: reason,
                });
                return NextResponse.json({ error: reason }, { status: 403 });
            }
        }

        // 2. HTML Sanitization
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
            return NextResponse.json({ error: 'to, subject, and content are required' }, { status: 400 });
        }

        const normalizedSubject = normalizeEmailSubject(subject);

        // 3. Resolve Credentials
        let fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'onboarding@alphacone.io';
        let provider: EmailProvider = 'sendgrid';
        let lookupId = userId || authUserId;

        if (!lookupId && tenantId) {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('created_by')
                .eq('id', tenantId)
                .single();
            lookupId = tenant?.created_by || null;
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
            return NextResponse.json({ success: false, error: 'Email service not configured for this account' }, { status: 503 });
        }

        // 4. Suppression check
        for (const recipient of recipients) {
            if (await isEmailSuppressed(tenantId, recipient)) {
                return NextResponse.json(
                    { success: false, error: `Recipient is suppressed: ${recipient}`, code: 'EMAIL_SUPPRESSED' },
                    { status: 409 }
                );
            }
        }

        const listUnsubscribeUrl = body.listUnsubscribeUrl
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
            listUnsubscribeUrl,
            attachments: Array.isArray(attachments) ? attachments : undefined,
            userId: lookupId || undefined,
        });

        if (result.ok) {
            await supabase.from('email_audit_log').insert({
                tenant_id: tenantId,
                user_id: authUserId || userId || null,
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
                templateName: body.templateName || null,
                status: 'sent',
                emailId: result.emailId
            });

            return NextResponse.json({
                success: true,
                id: result.emailId,
                provider: result.provider,
            });
        }

        await logEmailSend({
            tenantId: tenantId || null,
            userId: lookupId || null,
            provider,
            toEmail: Array.isArray(to) ? to.join(', ') : to,
            subject: normalizedSubject,
            templateName: body.templateName || null,
            status: 'failed',
            error: result.error
        });

        return NextResponse.json(
            { success: false, error: 'Email provider rejected request', errorDetails: result.error },
            { status: 502 }
        );

    } catch (error) {
        console.error('Error in /api/email/send:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
