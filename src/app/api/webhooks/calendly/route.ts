import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import crypto from 'crypto';

// Calendly Webhook Handler
// Events: invitee.created, invitee.canceled
export async function POST(req: Request) {
    try {
        const body = await req.text();
        const payload = JSON.parse(body);
        const signature = req.headers.get('calendly-webhook-signature');

        // TODO: Implement signature verification if CALENDLY_WEBHOOK_SIGNING_KEY is provided
        // For now, we'll process the payload but log the event
        console.log('Calendly Webhook Received:', payload.event);

        const supabase = await createClient();

        if (payload.event === 'invitee.created') {
            await handleInviteeCreated(payload.payload, supabase);
        } else if (payload.event === 'invitee.canceled') {
            await handleInviteeCanceled(payload.payload, supabase);
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
        tracking,
        text_reminder_number,
        uri: inviteeUri,
        event: eventUri
    } = payload;

    // We need to find the tenant associated with this event
    // The event payload doesn't directly give us the tenantId, but we can look it up 
    // by the owner of the event or the user URI if we stored it

    // Fetch event details to get the owner/user URI
    // But since we are likely using the tokens of the tenant, we can try to find them
    // via a metadata field if we passed it in the booking URL, or by matching the user URI.

    // For simplicity, let's look for a tenant who has this calendlyUserUri in their settings
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, settings')
        .contains('settings', { calendly: { calendlyUserUri: payload.event_type_owner_uri || payload.owner_uri } })
        .limit(1)
        .maybeSingle();

    if (!tenant) {
        // Fallback: search more broadly in JSONB
        const { data: allTenants } = await supabase.from('tenants').select('id, settings');
        const matchingTenant = allTenants?.find((t: any) =>
            t.settings?.calendly?.calendlyUserUri === payload.event_type_owner_uri ||
            t.settings?.calendly?.calendlyUserUri === payload.owner_uri
        );

        if (!matchingTenant) {
            console.error('Could not find tenant for Calendly event:', payload.event_type_owner_uri);
            return;
        }
    }

    const tenantId = tenant?.id;

    // Map to bookings table
    const { error } = await supabase
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
        });

    if (error) console.error('Error inserting booking from Calendly:', error);
}

async function handleInviteeCanceled(payload: any, supabase: any) {
    const { uri: inviteeUri } = payload;

    // Update status to canceled in bookings table based on metadata URI
    const { error } = await supabase
        .from('bookings')
        .update({ status: 'canceled' })
        .filter('metadata->>calendly_invitee_uri', 'eq', inviteeUri);

    if (error) console.error('Error canceling booking from Calendly:', error);
}
