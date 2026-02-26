import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const { tenantId, eventId, reason } = await req.json();

        if (!tenantId || !eventId) {
            return NextResponse.json({ error: 'Missing tenant ID or event ID' }, { status: 400 });
        }

        const { data: tenant, error } = await supabase
            .from('tenants')
            .select('settings')
            .eq('id', tenantId)
            .single();

        if (error || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const config = tenant.settings?.calendly;
        if (!config || !config.accessToken) {
            return NextResponse.json({ error: 'Calendly OAuth is not configured' }, { status: 400 });
        }

        // 1. Find the internal Calendar Event to get the Calendly URI
        const { data: calendarEvent, error: fetchError } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (fetchError || !calendarEvent) {
            return NextResponse.json({ error: 'Event not found locally' }, { status: 404 });
        }

        const calendlyUri = calendarEvent.metadata?.calendly_event_uri;
        if (!calendlyUri) {
            return NextResponse.json({ error: 'Event is not linked to Calendly' }, { status: 400 });
        }

        // 2. Extract UUID from URI
        const eventUuid = calendlyUri.split('/').pop();

        // 3. Call Calendly Cancellation API
        const response = await fetch(`https://api.calendly.com/scheduled_events/${eventUuid}/cancellation`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: reason || 'Canceled via CRM Dashboard' })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Calendly cancellation error:', errorText);
            return NextResponse.json({ error: 'Failed to cancel on Calendly', details: errorText }, { status: response.status });
        }

        // 4. Update the local event or delete it
        // We will mark it canceled in metadata, and optionally delete the row if preferred
        await supabase
            .from('calendar_events')
            .update({
                metadata: {
                    ...calendarEvent.metadata,
                    status: 'cancelled',
                    cancellation_reason: reason
                }
            })
            .eq('id', eventId);

        return NextResponse.json({ success: true, message: 'Event canceled successfully' });

    } catch (err: any) {
        console.error('API /calendly/cancel Error:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
    }
}
