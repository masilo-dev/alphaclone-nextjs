import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { resolveEmailProviderConfig } from '@/lib/email/providerIntegrationResolver';
import { ensureFooter, normalizeEmailSubject } from '@/lib/email/emailComposition';

/**
 * POST /api/email/send
 * Send a single email via SendGrid (prioritized) or Resend (fallback)
 * Uses per-account credentials from the 'integrations' table.
 */
export async function POST(req: NextRequest) {
    const payload = await req.json();
    const internalKey = req.headers.get('x-internal-api-key');
    const internalOk =
        Boolean(internalKey) &&
        internalKey === process.env.INTERNAL_API_KEY &&
        Boolean(payload?.tenantId);

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

    try {
        const { to, subject, html, text, message, from, fromName, tenantId, userId, replyTo, attachments } = payload;
        const normalizedSubject = normalizeEmailSubject(subject);
        const bodyText = text || message;
        const normalizedText = ensureFooter(bodyText || '');
        const normalizedHtml = html
            ? ensureFooter(String(html))
            : undefined;

        if (!to || !normalizedSubject || (!normalizedHtml && !bodyText)) {
            return NextResponse.json({ error: 'to, subject, and content are required' }, { status: 400 });
        }

        // 1. Resolve Email Credentials from canonical integration store
        let fromEmail = from || process.env.SENDGRID_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'onboarding@alphacone.io';
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
        });
        const apiKey = resolved?.apiKey || null;
        if (resolved?.provider) {
            provider = resolved.provider;
            fromEmail = from || resolved.fromEmail || fromEmail;
        }

        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Email service not configured for this account' }, { status: 503 });
        }

        const recipients = Array.isArray(to) ? to : [to];
        if (tenantId) {
            for (const recipient of recipients) {
                if (await isEmailSuppressed(tenantId, recipient)) {
                    return NextResponse.json(
                        { success: false, error: `Recipient is suppressed and cannot receive emails: ${recipient}`, code: 'EMAIL_SUPPRESSED' },
                        { status: 409 }
                    );
                }
            }
        }

        const listUnsubscribeUrl = payload.listUnsubscribeUrl
            || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?email=${encodeURIComponent(to)}` : undefined);

        // 2. Execute Send through provider SDK
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
        });

        if (result.ok) {
            return NextResponse.json({
                success: true,
                id: result.emailId,
                provider: result.provider,
            });
        }

        console.error('[email/send] provider error:', result.error);
        const code = result.provider === 'sendgrid' ? 'SENDGRID_ERROR' : result.provider === 'resend' ? 'RESEND_ERROR' : 'BREVO_ERROR';
        return NextResponse.json(
            { success: false, error: 'Email provider rejected this send request', code },
            { status: 502 }
        );

    } catch (error) {
        console.error('Error in /api/email/send:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
