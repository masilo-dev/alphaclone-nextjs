import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';
import {
    findTenantByCalendlyUserUri,
    resolveCalendlyUserUriFromPayload,
    resolveTenantHostUser,
    upsertCalendlyEvent,
} from '@/lib/calendly/syncToNative';

export async function POST(req: Request) {
    try {
        const body = await req.text();
        const signature = req.headers.get('calendly-webhook-signature');
        const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

        if (signingKey) {
            if (!signature) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const parts: Record<string, string> = {};
            signature.split(',').forEach((part) => {
                const [key, value] = part.split('=');
                if (key && value) parts[key] = value;
            });

            const timestamp = parts['t'];
            const receivedHmac = parts['v1'];
            if (!timestamp || !receivedHmac) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const requestAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
            if (Math.abs(requestAge) > 300) {
                return NextResponse.json({ error: 'Unauthorized – Replay' }, { status: 401 });
            }

            const signedPayload = `${timestamp}.${body}`;
            const expectedHmac = crypto.createHmac('sha256', signingKey).update(signedPayload).digest('hex');

            let isValid = false;
            try {
                isValid = crypto.timingSafeEqual(
                    Buffer.from(receivedHmac.padEnd(64, '0'), 'hex'),
                    Buffer.from(expectedHmac, 'hex')
                );
            } catch {
                isValid = false;
            }

            if (!isValid) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        } else {
            console.warn('[Calendly] CALENDLY_WEBHOOK_SIGNING_KEY not set – skipping signature check (dev only).');
        }

        const payload = JSON.parse(body);
        const supabaseAdmin = createSupabaseAdminClient();

        if (payload.event === 'invitee.created') {
            await handleInviteeCreated(payload.payload, supabaseAdmin);
        } else if (payload.event === 'invitee.canceled') {
            await handleInviteeCanceled(payload.payload, supabaseAdmin);
        } else if (payload.event === 'invitee.no_show.created') {
            await handleInviteeCanceled({ ...payload.payload, status: 'missed' }, supabaseAdmin);
        } else if (payload.event === 'meeting_recap.created') {
            await handleMeetingRecap(payload.payload, supabaseAdmin);
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('Calendly Webhook Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'webhooks/calendly' });
    }
}

async function handleInviteeCreated(payload: Record<string, unknown>, supabase: ReturnType<typeof createSupabaseAdminClient>) {
    const userUri = resolveCalendlyUserUriFromPayload(payload);
    if (!userUri) {
        console.error('[Calendly] Could not resolve user URI from webhook payload');
        return;
    }

    const match = await findTenantByCalendlyUserUri(userUri);
    if (!match) {
        console.error('[Calendly] Could not find tenant for user URI:', userUri);
        return;
    }

    const hostUserId = (await resolveTenantHostUser(match.tenantId)) || '';
    if (!hostUserId) return;

    const scheduled = payload.scheduled_event as Record<string, unknown> | undefined;
    const qna = payload.questions_and_answers as unknown;
    const notes = qna ? JSON.stringify(qna) : null;

    await upsertCalendlyEvent({
        tenantId: match.tenantId,
        hostUserId,
        eventUri: String(payload.event || ''),
        inviteeUri: String(payload.uri || ''),
        eventName: String(scheduled?.name || 'Meeting'),
        inviteeName: String(payload.name || ''),
        inviteeEmail: String(payload.email || ''),
        inviteePhone: String(payload.text_reminder_number || ''),
        startTime: String(scheduled?.start_time || new Date().toISOString()),
        endTime: String(scheduled?.end_time || new Date().toISOString()),
        location: (scheduled?.location as { location?: string } | undefined)?.location || null,
        notes,
        extraMetadata: { full_payload: payload },
    });
}

async function handleInviteeCanceled(payload: Record<string, unknown>, supabase: ReturnType<typeof createSupabaseAdminClient>) {
    const userUri = resolveCalendlyUserUriFromPayload(payload);
    const match = userUri ? await findTenantByCalendlyUserUri(userUri) : null;
    if (!match) return;

    const hostUserId = (await resolveTenantHostUser(match.tenantId)) || '';
    if (!hostUserId) return;

    const scheduled = payload.scheduled_event as Record<string, unknown> | undefined;
    const status = payload.status === 'missed' ? 'missed' as const : 'canceled' as const;

    await upsertCalendlyEvent({
        tenantId: match.tenantId,
        hostUserId,
        eventUri: String(payload.event || scheduled?.uri || ''),
        inviteeUri: String(payload.uri || ''),
        eventName: String(scheduled?.name || 'Meeting'),
        inviteeName: String(payload.name || ''),
        startTime: String(scheduled?.start_time || new Date().toISOString()),
        endTime: String(scheduled?.end_time || new Date().toISOString()),
        status,
    });
}

async function handleMeetingRecap(payload: Record<string, unknown>, supabase: ReturnType<typeof createSupabaseAdminClient>) {
    const eventUri = String(payload.event || '');
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, tenant_id, metadata')
        .filter('metadata->>calendly_event_uri', 'eq', eventUri)
        .maybeSingle();

    if (!booking) return;

    const summary = String(payload.summary || '');
    const actionItems = payload.action_items as string[] | undefined;
    const transcriptUrl = payload.transcript_url as string | undefined;

    await supabase
        .from('bookings')
        .update({
            client_notes: `${summary}\n\nAction Items:\n${actionItems?.join('\n') || 'None'}`,
            metadata: {
                ...booking.metadata,
                recap_received: true,
                transcript_url: transcriptUrl,
                action_items: actionItems,
            },
        })
        .eq('id', booking.id);
}
