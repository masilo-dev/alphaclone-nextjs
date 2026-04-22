import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

type InboundProvider = 'brevo' | 'resend' | 'sendgrid';
type InboundMessage = {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    messageId: string;
};

function isInboundProvider(provider: string): provider is InboundProvider {
    return provider === 'brevo' || provider === 'resend' || provider === 'sendgrid';
}

function asString(value: unknown): string {
    return String(value || '').trim();
}

function firstEmailFromMixed(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value) && value.length > 0) {
        const first = value[0] as { email?: unknown };
        return asString(first?.email);
    }
    if (value && typeof value === 'object') {
        return asString((value as { email?: unknown }).email);
    }
    return '';
}

async function parseWebhookBody(req: NextRequest): Promise<{ raw: unknown; items: Record<string, unknown>[] }> {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const raw: Record<string, unknown> = {};
        formData.forEach((value, key) => {
            raw[key] = typeof value === 'string' ? value : '';
        });
        return { raw, items: [raw] };
    }
    const json = await req.json().catch(() => ({}));
    if (Array.isArray(json)) return { raw: json, items: json as Record<string, unknown>[] };
    if (json && typeof json === 'object' && Array.isArray((json as { events?: unknown[] }).events)) {
        return { raw: json, items: ((json as { events: unknown[] }).events || []) as Record<string, unknown>[] };
    }
    return { raw: json, items: [json as Record<string, unknown>] };
}

function normalizeInboundMessage(provider: InboundProvider, item: Record<string, unknown>): InboundMessage | null {
    if (provider === 'sendgrid') {
        const from = asString(item.from || item.sender);
        const to = asString(item.to);
        const subject = asString(item.subject);
        const text = asString(item.text || item.textbody || item.body);
        const html = asString(item.html || item.htmlbody);
        const messageId = asString(item['Message-Id'] || item.message_id || item.messageId);
        if (!from || !to) return null;
        return { from, to, subject, text, html, messageId };
    }
    if (provider === 'resend') {
        const data = (item.data && typeof item.data === 'object' ? item.data : item) as Record<string, unknown>;
        const from = firstEmailFromMixed(data.from || data.sender);
        const to = firstEmailFromMixed(data.to);
        const subject = asString(data.subject);
        const text = asString(data.text || data.textBody);
        const html = asString(data.html || data.htmlBody);
        const messageId = asString(data.id || data.message_id || data.messageId);
        if (!from || !to) return null;
        return { from, to, subject, text, html, messageId };
    }
    const from = asString(item.sender?.toString() || item.from || item.email);
    const to = asString(item.recipient || item.to);
    const subject = asString(item.subject);
    const text = asString(item.text || item.textContent || item.content);
    const html = asString(item.html || item.htmlContent);
    const messageId = asString(item.messageId || item.message_id || item.uuid);
    if (!from || !to) return null;
    return { from, to, subject, text, html, messageId };
}

export async function POST(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
    try {
        const { provider: providerParam } = await context.params;
        const provider = providerParam.toLowerCase();
        if (!isInboundProvider(provider)) {
            return NextResponse.json({ error: 'Unsupported inbound provider' }, { status: 400 });
        }

        const webhookToken = asString(new URL(req.url).searchParams.get('token'));
        if (!webhookToken) {
            return NextResponse.json({ error: 'Webhook token is required' }, { status: 401 });
        }

        const admin = createSupabaseAdminClient();
        const { data: integration, error: integrationError } = await admin
            .from('integrations')
            .select('id, tenant_id, user_id, config')
            .eq('enabled', true)
            .eq('type', provider)
            .contains('config', { webhookToken })
            .maybeSingle();
        if (integrationError) {
            return NextResponse.json({ error: integrationError.message }, { status: 500 });
        }
        if (!integration) {
            return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
        }

        const { raw, items } = await parseWebhookBody(req);
        const normalized = items
            .map((item) => normalizeInboundMessage(provider, item))
            .filter((msg): msg is InboundMessage => Boolean(msg));

        let received = 0;
        for (const message of normalized) {
            const summary = message.text || message.html || '(empty body)';
            const shortBody = summary.length > 280 ? `${summary.slice(0, 280)}...` : summary;
            await admin.from('activity_logs').insert({
                user_id: integration.user_id,
                tenant_id: integration.tenant_id,
                action: 'email_inbound_reply_received',
                metadata: {
                    provider,
                    from: message.from,
                    to: message.to,
                    subject: message.subject,
                    bodyPreview: shortBody,
                    bodyText: message.text,
                    bodyHtml: message.html,
                    messageId: message.messageId,
                    integrationId: integration.id,
                    receivedAt: new Date().toISOString(),
                },
            });
            await captureUnifiedMessageFromWebhook({
                supabase: admin as any,
                tenantId: integration.tenant_id,
                source: provider,
                channel: 'email',
                direction: 'inbound',
                externalId: message.messageId || null,
                threadId: null,
                from: message.from,
                to: message.to,
                subject: message.subject,
                text: message.text,
                html: message.html,
                receivedAt: new Date().toISOString(),
                metadata: {
                    provider,
                    integrationId: integration.id,
                },
            });
            await admin.from('notifications').insert({
                user_id: integration.user_id,
                type: 'message',
                title: `New email reply from ${message.from}`,
                message: message.subject || 'Reply received from inbound webhook',
                read: false,
                link: '/dashboard/messages',
            });
            received += 1;
        }

        return NextResponse.json({
            success: true,
            provider,
            received,
            ignored: Math.max(0, items.length - received),
            hasPayload: Boolean(raw),
        });
    } catch (error) {
        return clientErrorResponse(error, { request: req, scope: 'webhooks/email/inbound' });
    }
}
