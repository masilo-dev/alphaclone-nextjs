import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { syncSuppressionCleanup } from '@/lib/email/suppression';
=======
import { upsertSuppression } from '@/lib/email/suppression';
>>>>>>> origin/main

type ProviderEvent = {
    email?: string;
    event?: string;
    message_id?: string;
    sg_event_id?: string;
    reason?: string;
    [key: string]: unknown;
};

function normalizeEventType(value: string): string {
    return value.trim().toLowerCase();
}

function parseWebhookSecret(req: NextRequest): string {
    return req.headers.get('x-webhook-token')
        || req.nextUrl.searchParams.get('token')
        || '';
}

export async function POST(req: NextRequest) {
    try {
        const sharedSecret = process.env.EMAIL_WEBHOOK_TOKEN;
        if (!sharedSecret) {
            return NextResponse.json({ error: 'Email webhook is not configured' }, { status: 503 });
        }

        const token = parseWebhookSecret(req);
        if (!token || token !== sharedSecret) {
            return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
        }

        const body = await req.json().catch(() => []);
        const events = Array.isArray(body) ? body : body?.events || [];
        if (!Array.isArray(events) || events.length === 0) {
            return NextResponse.json({ success: true, processed: 0, ignored: 0 });
        }

        const admin = createSupabaseAdminClient();
        let processed = 0;
        let ignored = 0;

        for (const rawEvent of events as ProviderEvent[]) {
            const eventType = normalizeEventType(String(rawEvent.event || ''));
            const email = String(rawEvent.email || '').trim().toLowerCase();
            if (!eventType || !email) {
                ignored += 1;
                continue;
            }

            const provider = String(rawEvent.provider || 'sendgrid').toLowerCase();
            const messageId = String(rawEvent.message_id || rawEvent.sg_event_id || '');
            const { data: logRecord } = await admin
                .from('email_logs')
                .select('tenant_id')
                .eq('to_email', email)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const tenantId = logRecord?.tenant_id || null;

            await admin.from('email_webhook_events').insert({
                tenant_id: tenantId,
                provider,
                event_type: eventType,
                recipient_email: email,
                provider_event_id: messageId || null,
                payload: rawEvent,
            });

            if (tenantId && (eventType === 'bounce' || eventType === 'spam_report' || eventType === 'unsubscribe')) {
<<<<<<< HEAD
                await syncSuppressionCleanup({
=======
                await upsertSuppression({
>>>>>>> origin/main
                    tenantId,
                    email,
                    reason: eventType as 'bounce' | 'spam_report' | 'unsubscribe',
                    provider,
                    eventId: messageId,
                    metadata: rawEvent,
                });
            }

            processed += 1;
        }

        return NextResponse.json({ success: true, processed, ignored });
    } catch (error) {
        console.error('[webhooks/email] failed:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
