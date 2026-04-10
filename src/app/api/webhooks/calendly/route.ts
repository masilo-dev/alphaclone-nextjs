import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

// Calendly Webhook Handler
// Events: invitee.created, invitee.canceled
export async function POST(req: Request) {
    try {
        const body = await req.text();
        const signature = req.headers.get('calendly-webhook-signature');
        const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

        // ── Signature Verification ──────────────────────────────────────────
        if (signingKey) {
            if (!signature) {
                console.warn('[Calendly] Rejected: missing signature header');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            // Calendly sends: "t=<timestamp>,v1=<HMAC-SHA256>"
            const parts: Record<string, string> = {};
            signature.split(',').forEach(part => {
                const [key, value] = part.split('=');
                if (key && value) parts[key] = value;
            });

            const timestamp = parts['t'];
            const receivedHmac = parts['v1'];

            if (!timestamp || !receivedHmac) {
                console.warn('[Calendly] Rejected: malformed signature header');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            // Reject if older than 5 minutes (replay attack protection)
            const requestAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
            if (Math.abs(requestAge) > 300) {
                console.warn('[Calendly] Rejected: timestamp too old', requestAge);
                return NextResponse.json({ error: 'Unauthorized – Replay' }, { status: 401 });
            }

            const signedPayload = `${timestamp}.${body}`;
            const expectedHmac = crypto
                .createHmac('sha256', signingKey)
                .update(signedPayload)
                .digest('hex');

            // Use timingSafeEqual to prevent timing attacks
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
                console.warn('[Calendly] Rejected: invalid HMAC signature');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        } else {
            // Dev mode: log a warning but still process
            console.warn('[Calendly] CALENDLY_WEBHOOK_SIGNING_KEY not set – skipping signature check (dev only).');
        }
        // ───────────────────────────────────────────────────────────────────

        const payload = JSON.parse(body);
        console.log('[Calendly] Verified webhook received:', payload.event);

        const supabaseAdmin = createSupabaseAdminClient();

        if (payload.event === 'invitee.created') {
            await handleInviteeCreated(payload.payload, supabaseAdmin);
        } else if (payload.event === 'invitee.canceled') {
            await handleInviteeCanceled(payload.payload, supabaseAdmin);
        } else if (payload.event === 'invitee.no_show.created') {
            await handleInviteeNoShow(payload.payload, supabaseAdmin);
        } else if (payload.event === 'meeting_recap.created') {
            await handleMeetingRecap(payload.payload, supabaseAdmin);
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Calendly Webhook Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function handleInviteeCreated(payload: any, supabase: any) {
    const {
        email,
        name,
        questions_and_answers,
        text_reminder_number,
        uri: inviteeUri,
        event: eventUri
    } = payload;

    // We need to find the tenant associated with this event
    // Look for a tenant who has this calendlyUserUri in their settings
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id, settings')
        .contains('settings', { calendly: { calendlyUserUri: payload.event_type_owner_uri || payload.owner_uri } })
        .limit(1)
        .maybeSingle();

    let tenantId = tenant?.id;

    if (!tenantId) {
        // Fallback: search more broadly in JSONB
        const { data: allTenants } = await supabase.from('tenants').select('id, settings');
        const matchingTenant = allTenants?.find((t: any) =>
            t.settings?.calendly?.calendlyUserUri === payload.event_type_owner_uri ||
            t.settings?.calendly?.calendlyUserUri === payload.owner_uri
        );

        if (!matchingTenant) {
            console.error('[Calendly] Could not find tenant for event owner URI:', payload.event_type_owner_uri);
            return;
        }
        tenantId = matchingTenant.id;
    }

    // Map to bookings table
    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
            tenant_id: tenantId,
            client_name: name || 'Calendly Guest',
            client_email: email,
            client_phone: text_reminder_number,
            client_notes: questions_and_answers ? JSON.stringify(questions_and_answers) : null,
            start_time: payload.scheduled_event?.start_time || new Date().toISOString(),
            end_time: payload.scheduled_event?.end_time || new Date().toISOString(),
            status: 'confirmed',
            metadata: {
                calendly_invitee_uri: inviteeUri,
                calendly_event_uri: eventUri,
                full_payload: payload
            }
        })
        .select()
        .single();

    if (bookingError) {
        console.error('[Calendly] Error inserting booking:', bookingError);
        return;
    }

    // Sync to video_calls so it shows in Meetings dashboard
    const { data: userData } = await supabase
        .from('profiles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('role', 'tenant')
        .limit(1)
        .maybeSingle();

    if (userData) {
        await supabase
            .from('video_calls')
            .insert({
                host_id: userData.id,
                title: `Calendly: ${name || 'Guest'}`,
                status: 'scheduled',
                scheduled_at: booking.start_time,
                daily_room_url: payload.scheduled_event?.location?.location || null,
                description: questions_and_answers ? JSON.stringify(questions_and_answers) : null,
                metadata: {
                    booking_id: booking.id,
                    calendly_event_uri: eventUri
                }
            });

        // Create entry in calendar_events so it shows in the main dashboard calendar
        await supabase
            .from('calendar_events')
            .insert({
                tenant_id: tenantId,
                user_id: userData.id,
                title: `Calendly: ${name || 'Guest'}`,
                description: questions_and_answers ? JSON.stringify(questions_and_answers) : `Calendly meeting with ${name || 'Guest'}`,
                start_time: booking.start_time,
                end_time: booking.end_time,
                type: 'meeting',
                location: payload.scheduled_event?.location?.location || 'Calendly Video Link',
                metadata: {
                    booking_id: booking.id,
                    calendly_event_uri: eventUri,
                    calendly_invitee_uri: inviteeUri
                }
            });
    }
}

async function handleInviteeCanceled(payload: any, supabase: any) {
    const { uri: inviteeUri } = payload;

    // Update status to canceled in bookings table
    await supabase
        .from('bookings')
        .update({ status: 'canceled' })
        .filter('metadata->>calendly_invitee_uri', 'eq', inviteeUri);

    // Also update video_calls
    await supabase
        .from('video_calls')
        .update({ status: 'cancelled' })
        .filter('metadata->>calendly_invitee_uri', 'eq', inviteeUri);
}

async function handleInviteeNoShow(payload: any, supabase: any) {
    const { invitee: inviteeUri } = payload;

    // Update status to 'missed' in bookings
    await supabase
        .from('bookings')
        .update({ status: 'missed' })
        .filter('metadata->>calendly_invitee_uri', 'eq', inviteeUri);
    
    // Log visibility for human oversight
    console.log(`[Calendly] Marked no-show for invitee: ${inviteeUri}`);
}

async function handleMeetingRecap(payload: any, supabase: any) {
    const { 
        event: eventUri, 
        summary, 
        transcript_url,
        action_items 
    } = payload;

    // Store the recap in the persistent memory / knowledge base
    // Use the eventUri to link to the existing booking/meeting context
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, tenant_id, metadata')
        .filter('metadata->>calendly_event_uri', 'eq', eventUri)
        .maybeSingle();

    if (booking) {
        // Create an entry in a 'meeting_notes' or similar table if it exists, 
        // or update the metadata of the booking
        await supabase
            .from('bookings')
            .update({
                client_notes: (summary || '') + '\n\nAction Items:\n' + (action_items?.join('\n') || 'None'),
                metadata: {
                    ...booking.metadata,
                    recap_received: true,
                    transcript_url,
                    action_items
                }
            })
            .eq('id', booking.id);
            
        console.log(`[Calendly] Insight synchronized for event: ${eventUri}`);
    }
}
