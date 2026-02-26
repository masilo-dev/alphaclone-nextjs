import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const { tenantId, userId } = await req.json();

        if (!tenantId || !userId) {
            return NextResponse.json({ error: 'Missing tenant ID or user ID' }, { status: 400 });
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
        if (!config || !config.accessToken || !config.calendlyUserUri) {
            return NextResponse.json({ error: 'Calendly OAuth is not configured for this tenant' }, { status: 400 });
        }

        // Fetch Scheduled Events from Calendly
        const minStartTime = new Date().toISOString();
        let allEvents: any[] = [];
        let nextPage = `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(config.calendlyUserUri)}&min_start_time=${encodeURIComponent(minStartTime)}&status=active`;

        let pages = 0;
        while (nextPage && pages < 10) {
            const response = await fetch(nextPage, {
                headers: {
                    'Authorization': `Bearer ${config.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Calendly fetch error:', await response.text());
                break;
            }

            const data = await response.json();
            allEvents = [...allEvents, ...(data.collection || [])];
            nextPage = data.pagination?.next_page;
            pages++;
        }

        let syncedCount = 0;

        // Process fetched events and insert them if they don't exist
        for (const event of allEvents) {
            const { data: existing } = await supabase
                .from('calendar_events')
                .select('id')
                .eq('metadata->>calendly_event_uri', event.uri)
                .single();

            if (!existing) {
                let desc = event.name;
                const eventUuid = event.uri.split('/').pop();

                try {
                    const inviteesRes = await fetch(`https://api.calendly.com/scheduled_events/${eventUuid}/invitees`, {
                        headers: {
                            'Authorization': `Bearer ${config.accessToken}`
                        }
                    });
                    if (inviteesRes.ok) {
                        const inviteesData = await inviteesRes.json();
                        const invitee = inviteesData.collection?.[0];
                        if (invitee) {
                            desc = `Calendly meeting with ${invitee.name || invitee.email}`;
                        }
                    }
                } catch (e) {
                    // Ignore invitee fetch errors
                }

                await supabase.from('calendar_events').insert({
                    tenant_id: tenantId,
                    user_id: userId,
                    title: `Calendly: ${event.name}`,
                    description: desc,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    type: 'meeting',
                    location: event.location?.location || 'Calendly Video Link',
                    is_all_day: false,
                    reminder_minutes: 15,
                    metadata: {
                        calendly_event_uri: event.uri,
                        calendly_status: event.status
                    }
                });

                syncedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            syncedCount,
            totalActive: allEvents.length
        });

    } catch (err: any) {
        console.error('API /calendly/sync Error:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
    }
}
