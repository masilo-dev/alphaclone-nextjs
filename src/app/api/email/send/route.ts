import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isEmailSuppressed } from '@/lib/email/suppression';

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

    if (!internalOk) {
        const authClient = await createSupabaseServerClient();
        const {
            data: { user },
        } = await authClient.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    try {
        const { to, subject, html, text, from, fromName, tenantId, userId, replyTo } = payload;

        if (!to || !subject || (!html && !text)) {
            return NextResponse.json({ error: 'to, subject, and content are required' }, { status: 400 });
        }

        // 1. Resolve Email Credentials
        let apiKey = process.env.SENDGRID_API_KEY;
        let fromEmail = from || process.env.SENDGRID_FROM_EMAIL || 'onboarding@alphacone.io';
        let provider: 'sendgrid' | 'resend' = 'sendgrid';

        if (tenantId || userId) {
            let lookupId = userId;
            if (!lookupId && tenantId) {
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('created_by')
                    .eq('id', tenantId)
                    .single();
                lookupId = tenant?.created_by;
            }

            if (lookupId) {
                const { data: integration } = await supabase
                    .from('integrations')
                    .select('config, enabled')
                    .eq('user_id', lookupId)
                    .eq('type', 'sendgrid')
                    .eq('enabled', true)
                    .maybeSingle();

                if (integration?.config) {
                    apiKey = integration.config.apiKey || apiKey;
                    fromEmail = from || integration.config.fromEmail || fromEmail;
                } else {
                    // Fallback to Resend if no SendGrid is configured
                    apiKey = process.env.RESEND_API_KEY;
                    provider = 'resend';
                }
            }
        }

        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Email service not configured for this account' }, { status: 503 });
        }
        if (tenantId && await isEmailSuppressed(tenantId, to)) {
            return NextResponse.json(
                { success: false, error: 'Recipient is suppressed and cannot receive emails', code: 'EMAIL_SUPPRESSED' },
                { status: 409 }
            );
        }

        const listUnsubscribeUrl = payload.listUnsubscribeUrl
            || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?email=${encodeURIComponent(to)}` : undefined);

        // 2. Execute Send
        if (provider === 'sendgrid') {
            const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    personalizations: [{ to: [{ email: to }] }],
                    from: { email: fromEmail, name: fromName || 'AlphaClone Systems' },
                    subject: subject,
                    content: [
                        { type: 'text/plain', value: text || '' },
                        { type: 'text/html', value: html || '' }
                    ].filter(c => c.value),
                    reply_to: replyTo ? { email: replyTo } : undefined,
                    headers: listUnsubscribeUrl ? {
                        'List-Unsubscribe': `<${listUnsubscribeUrl}>`,
                        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                    } : undefined,
                }),
            });

            if (response.ok) {
                return NextResponse.json({ success: true, provider: 'sendgrid' });
            } else {
                const errData = await response.json();
                console.error('[email/send] SendGrid:', errData);
                return NextResponse.json(
                    { success: false, error: 'SendGrid rejected this send request', code: 'SENDGRID_ERROR' },
                    { status: response.status }
                );
            }
        } else {
            // Legacy Resend Fallback
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: to,
                    subject: subject,
                    html: html,
                    text: text,
                    reply_to: replyTo
                }),
            });

            const data = await response.json();
            if (response.ok) {
                return NextResponse.json({ success: true, id: data.id, provider: 'resend' });
            } else {
                console.error('[email/send] Resend:', data);
                return NextResponse.json(
                    { success: false, error: 'Email provider rejected this send request', code: 'RESEND_ERROR' },
                    { status: response.status }
                );
            }
        }

    } catch (error) {
        console.error('Error in /api/email/send:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
