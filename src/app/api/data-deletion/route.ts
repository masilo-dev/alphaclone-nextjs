import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { z } from 'zod';
import { sendWithProviderSdk } from '@/lib/email/providerSdk';
import { isTurnstileEnforced, readClientIp, readTurnstileToken, verifyTurnstileToken } from '@/lib/verifyTurnstile';

const requestSchema = z.object({
    email: z.string().trim().email().max(320),
    name: z.string().trim().max(200).optional(),
    reason: z.string().trim().max(4000).optional(),
    turnstileToken: z.string().optional(),
});

function escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** POST /api/data-deletion — general GDPR/CCPA deletion request form */
export async function POST(req: NextRequest) {
    const supabase = createSupabaseAdminClient();

    try {
        const raw = await req.json().catch(() => ({}));
        if (raw?.action === 'verify') {
            const code = z.string().min(20).max(200).parse(raw?.code);
            const { data, error } = await supabase
                .from('data_deletion_requests')
                .update({ status: 'pending', verified_at: new Date().toISOString() })
                .eq('confirmation_code', code)
                .eq('status', 'verification_pending')
                .select('id')
                .maybeSingle();
            if (error) throw error;
            if (!data) return NextResponse.json({ error: 'Invalid or already verified request' }, { status: 404 });
            return NextResponse.json({ success: true, message: 'Email verified. Your deletion request is now queued.' });
        }

        const { email, name, reason } = requestSchema.parse(raw);
        if (isTurnstileEnforced()) {
            const token = readTurnstileToken(raw);
            if (!token || !(await verifyTurnstileToken(token, readClientIp(req)))) {
                return NextResponse.json({ error: 'Security verification failed.' }, { status: 403 });
            }
        }
        const normalizedEmail = email.toLowerCase();

        // Check for existing pending request
        const { data: existing } = await supabase
            .from('data_deletion_requests')
            .select('id, confirmation_code, status')
            .ilike('requester_email', normalizedEmail)
            .in('status', ['verification_pending', 'pending', 'under_review', 'approved', 'processing'])
            .maybeSingle();

        let record = existing;
        if (!record) {
            const result = await supabase
                .from('data_deletion_requests')
                .insert({
                    requester_email: normalizedEmail,
                    requester_name: name || null,
                    reason: reason || null,
                    source: 'gdpr_form',
                    status: 'verification_pending',
                    request_type: 'full_deletion',
                })
                .select('id, confirmation_code, status')
                .single();
            if (result.error || !result.data) throw result.error || new Error('Failed to create request');
            record = result.data;
        }

        if (record.status === 'verification_pending') {
            const apiKey = process.env.BREVO_PLATFORM_API_KEY || process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
            if (!apiKey) return NextResponse.json({ error: 'Privacy email delivery is unavailable.' }, { status: 503 });
            const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
            const link = `${appUrl.replace(/\/$/, '')}/data-deletion?code=${encodeURIComponent(record.confirmation_code)}`;
            const send = await sendWithProviderSdk('brevo', {
                apiKey,
                fromEmail: process.env.BREVO_PLATFORM_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'privacy@alphaclonesystems.com',
                fromName: 'AlphaClone Privacy',
                to: normalizedEmail,
                subject: 'Verify your AlphaClone data deletion request',
                text: `Verify your data deletion request: ${link}\n\nIf you did not request this, ignore this email.`,
                html: `<p>We received a data deletion request for <strong>${escapeHtml(normalizedEmail)}</strong>.</p><p><a href="${escapeHtml(link)}">Verify this request</a></p><p>If you did not request this, ignore this email.</p>`,
            });
            if (!send.ok) return NextResponse.json({ error: 'Verification email could not be sent.' }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            message: 'If the address is valid, a verification link has been sent. The request will not be processed until verified.',
        });

    } catch (err) {
        console.error('Data deletion form error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** GET /api/data-deletion?code=xxx — check request status */
export async function GET(req: NextRequest) {
    const supabase = createSupabaseAdminClient();
    const code = new URL(req.url).searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

    const { data, error } = await supabase
        .from('data_deletion_requests')
        .select('id, status, source, created_at, processed_at')
        .eq('confirmation_code', code)
        .single();

    if (error || !data) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    return NextResponse.json({ request: data });
}
