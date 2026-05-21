import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';

export async function POST(req: Request) {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { tenantId } = await req.json();
        const userId = user.id;

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenant ID or user ID' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();
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

        let { accessToken, refreshToken, expiresAt, calendlyUserUri } = config;

        // Refresh token if expired or expiring within 5 minutes
        if (refreshToken && expiresAt && new Date(expiresAt).getTime() < Date.now() + 5 * 60000) {
            const tokenRes = await fetch('https://auth.calendly.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: ENV.VITE_CALENDLY_CLIENT_ID,
                    client_secret: ENV.CALENDLY_CLIENT_SECRET
                })
            });

            if (tokenRes.ok) {
                const tokens = await tokenRes.json();
                accessToken = tokens.access_token;
                refreshToken = tokens.refresh_token;
                expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

                tenant.settings.calendly = {
                    ...tenant.settings.calendly,
                    accessToken,
                    refreshToken,
                    expiresAt
                };
                await supabase.from('tenants').update({ settings: tenant.settings }).eq('id', tenantId);
            } else {
                console.error('Failed to refresh Calendly token:', await tokenRes.text());
                return NextResponse.json({ error: 'Calendly token expired and refresh failed. Please reconnect.' }, { status: 401 });
            }
        }

        // Fetch Scheduled Events from Calendly (syncing past 30 days to future)
        const minStartTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        let allEvents: any[] = [];
        let nextPage = `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(calendlyUserUri)}&min_start_time=${encodeURIComponent(minStartTime)}&status=active`;

        let pages = 0;
        while (nextPage && pages < 10) {
            const response = await fetch(nextPage, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
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
                .maybeSingle();

            if (!existing) {
                let desc = event.name;
                const eventUuid = event.uri.split('/').pop();

                let inviteeData: any = null;

                try {
                    const inviteesRes = await fetch(`https://api.calendly.com/scheduled_events/${eventUuid}/invitees`, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                    if (inviteesRes.ok) {
                        const data = await inviteesRes.json();
                        const invitee = data.collection?.[0];
                        if (invitee) {
                            desc = `Calendly meeting with ${invitee.name || invitee.email}`;
                            inviteeData = {
                                name: invitee.name,
                                email: invitee.email,
                                cancel_url: invitee.cancel_url,
                                reschedule_url: invitee.reschedule_url,
                                questions_and_responses: invitee.questions_and_responses,
                                timezone: invitee.timezone
                            };
                        }
                    }
                } catch (e) {
                    console.error('Error fetching invitee data:', e);
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
                        calendly_status: event.status,
                        invitee: inviteeData
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
        return clientErrorResponse(err, { request: req, scope: 'calendly/sync' });
    }
}
