import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

/**
 * POST /api/email/send
 * Send a single email via SendGrid (prioritized) or Resend (fallback)
 * Uses per-account credentials from the 'integrations' table.
 */
export async function POST(req: NextRequest) {
    const supabase = createSupabaseAdminClient();

    try {
        const payload = await req.json();
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
                    reply_to: replyTo ? { email: replyTo } : undefined
                }),
            });

            if (response.ok) {
                return NextResponse.json({ success: true, provider: 'sendgrid' });
            } else {
                const errData = await response.json();
                return NextResponse.json({ success: false, error: errData.errors?.[0]?.message || 'SendGrid failed' }, { status: response.status });
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
                return NextResponse.json({ success: false, error: data.message || 'Resend failed' }, { status: response.status });
            }
        }

    } catch (error) {
        console.error('Error in /api/email/send:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
