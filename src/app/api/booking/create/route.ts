import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { confirmNativeBooking } from '@/lib/booking/confirmNativeBooking';
import { publicAppUrl } from '@/lib/config/public-origin';
import { acquireCronLock } from '@/lib/cron/distributedLock';
import { microsoftServerService } from '@/services/server/microsoftServerService';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';
import { isTurnstileEnforced, readClientIp, readTurnstileToken, verifyTurnstileToken } from '@/lib/verifyTurnstile';

export async function POST(req: Request) {
    try {
        const supabase = createSupabaseAdminClient();

        const body = await req.json();
        const {
            tenant_id,
            booking_type_id,
            start_time,
            end_time,
            client_name,
            client_email,
            client_phone,
            client_notes,
            time_zone,
        } = body;

        const limited = await rateLimitMiddleware(
            req as any,
            rateLimitConfigs.public.contact,
            `booking:${tenant_id}:${client_email || req.headers.get('x-forwarded-for') || 'anonymous'}`
        );
        if (limited) return limited;

        if (!tenant_id || !booking_type_id || !start_time || !client_email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (isTurnstileEnforced()) {
            const turnstile_token = readTurnstileToken(body);
            if (!turnstile_token) {
                return NextResponse.json({ error: 'Security verification required' }, { status: 400 });
            }
            const ok = await verifyTurnstileToken(turnstile_token, readClientIp(req));
            if (!ok) {
                return NextResponse.json(
                    { error: 'Security verification failed. Please try again.' },
                    { status: 403 }
                );
            }
        }

        // 1b. Fetch Plan and Enforce Limits
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('id,name,slug,settings,subscription_plan')
            .eq('id', tenant_id)
            .single();

        if (!tenantData || tenantData.settings?.booking?.enabled !== true) return NextResponse.json({ error: 'This booking page is not available' }, { status: 404 });
        const { data: meetingType, error: typeError } = await supabase.from('booking_types')
            .select('id,name,duration').eq('tenant_id', tenant_id).eq('id', booking_type_id).eq('is_active', true).maybeSingle();
        if (typeError || !meetingType) return NextResponse.json({ error: 'Meeting type not available for this business' }, { status: 404 });
        const booking_type_name = meetingType.name;
        const startMs = Date.parse(start_time), endMs = Date.parse(end_time);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || endMs - startMs !== meetingType.duration * 60_000)
            return NextResponse.json({ error: 'Invalid booking time or duration' }, { status: 400 });
        const plan = tenantData?.subscription_plan || 'free';
        const { PLAN_PRICING } = await import('@/services/tenancy/types');
        const planFeatures = PLAN_PRICING[plan as keyof typeof PLAN_PRICING]?.features;

        if (!planFeatures) {
            return NextResponse.json({ error: 'Invalid plan configuration' }, { status: 500 });
        }

        // 2. Get Host ID (Tenant Owner)
        // We need a host for the video call.
        const { data: users, error: userError } = await supabase
            .from('tenant_users')
            .select('user_id,role')
            .eq('tenant_id', tenant_id);

        if (userError || !users?.length) {
            console.error('No host found for tenant:', tenant_id, userError);
            return NextResponse.json({ error: 'Configuration Error: Tenant has no active hosts.' }, { status: 500 });
        }
        const host_id = (users.find((user: any) => ['owner', 'admin', 'tenant_admin'].includes(user.role)) || users[0]).user_id;
        const microsoftConnection = await microsoftServerService.getConnection(host_id).catch(() => null);

        const lock = await acquireCronLock(`native-booking-slot:${tenant_id}:${host_id}`, 120);
        if (!lock.acquired) return NextResponse.json({ error: 'Booking is being updated. Please try again.' }, { status: 409 });
        try {
        const { data: prior, error: priorError } = await supabase.from('bookings').select('id,video_call_id,status')
            .eq('tenant_id', tenant_id).eq('client_email', client_email).eq('start_time', start_time).eq('booking_type_id', booking_type_id)
            .not('status', 'in', '(cancelled,canceled,no_show)').maybeSingle();
        if (priorError) throw priorError;
        if (prior) {
            const roomUrl = prior.video_call_id ? publicAppUrl(`/meet/${prior.video_call_id}`) : '';
            const notifications = await confirmNativeBooking(supabase, tenantData.slug, {
                tenantId: tenant_id, bookingId: prior.id, bookingTypeName: booking_type_name,
                clientName: client_name, clientEmail: client_email, clientNotes: client_notes,
                startTime: start_time, endTime: end_time, timeZone: time_zone,
                meetingUrl: roomUrl, hostUserId: host_id, source: 'native',
            });
            return NextResponse.json({ success: true, booking: prior, roomUrl, notifications });
        }

        // 2b. Conflict Check (Harden against Race Conditions)
        const requestedStart = new Date(start_time);
        const requestedEnd = new Date(end_time);

        const { data: overlapping, error: conflictError } = await supabase
            .from('calendar_events')
            .select('id,metadata')
            .eq('tenant_id', tenant_id).eq('user_id', host_id)
            .or(`and(start_time.lt.${requestedEnd.toISOString()},end_time.gt.${requestedStart.toISOString()})`)
            .limit(1);

        if (conflictError) throw new Error('Failed to verify slot availability');
        if (overlapping?.some((event: any) => !['cancelled','canceled','missed','no_show'].includes(event.metadata?.status || event.metadata?.calendly_status || event.metadata?.provider_status))) {
            return NextResponse.json({ error: 'This slot was just taken. Please select another time.' }, { status: 409 });
        }

        if (microsoftConnection) {
            try {
                const externalBusy = await microsoftServerService.getCalendarBusyWindows(
                    host_id,
                    requestedStart.toISOString(),
                    requestedEnd.toISOString()
                );
                const isMicrosoftBlocked = externalBusy.some((event) => {
                    return requestedStart.getTime() < event.end && requestedEnd.getTime() > event.start;
                });

                if (isMicrosoftBlocked) {
                    return NextResponse.json({ error: 'This slot is busy on the host Microsoft calendar.' }, { status: 409 });
                }
            } catch (microsoftError) {
                console.error('Microsoft booking conflict check failed:', microsoftError);
            }
        }

        // 3. Create meeting provider room/link
        const roomName = `booking-${crypto.randomUUID()}`;
        const jitsiRoomName = `alphaclone-${roomName}`;
        let dailyRoomUrl = '';
        let roomId = '';
        const meetingProvider = 'external';
        let providerMetadata: Record<string, unknown> = {
            room_name: jitsiRoomName,
        };

        if (microsoftConnection) {
            const msEvent = await microsoftServerService.createCalendarEvent(host_id, {
                subject: `${booking_type_name || 'Meeting'} with ${client_name}`,
                start: requestedStart.toISOString(),
                end: requestedEnd.toISOString(),
                attendees: [client_email],
                body: client_notes || `Booking created in Alphaclone for ${client_name}.`,
                isOnlineMeeting: true,
            });

            dailyRoomUrl =
                msEvent.onlineMeeting?.joinUrl ||
                msEvent.onlineMeetingUrl ||
                msEvent.webLink ||
                '';
            roomId = msEvent.id || roomName;
            providerMetadata = {
                ...providerMetadata,
                provider: 'teams',
                microsoft_event_id: msEvent.id,
                teams_join_url: dailyRoomUrl,
                web_link: msEvent.webLink || '',
            };
        } else {
            roomId = roomName;
            dailyRoomUrl = `https://meet.jit.si/${jitsiRoomName}`;
            providerMetadata = {
                ...providerMetadata,
                provider: 'jitsi',
                jitsi_url: dailyRoomUrl,
            };
        }

        // 3b. Base URL for the masked meeting link (filled in after we have the
        // video_calls UUID, since /meet/[id] resolves a UUID — not the Daily room name).

        // 4. Insert Video Call
        let videoCallId = null;
        if (roomId) {
            const { data: vCall, error: vError } = await supabase
                .from('video_calls')
                .insert({
                    tenant_id,
                    room_id: roomId,
                    daily_room_url: dailyRoomUrl,
                    daily_room_name: roomId,
                    host_id: host_id,
                    title: `Meeting with ${client_name}`,
                    status: 'scheduled',
                    scheduled_at: start_time,
                    duration_limit_minutes: meetingType.duration,
                    // Public so the booked client can join from the email link without an account.
                    is_public: true,
                    video_provider: meetingProvider,
                    provider_metadata: providerMetadata,
                    metadata: { source: 'booking', start_time, end_time, client_email },
                })
                .select('id')
                .single();

            if (vError) {
                console.error('Video Call Insert Error', vError);
                // Continue? Or fail?
                // Returning error is safer to avoid data inconsistency
                return NextResponse.json({ error: 'Failed to schedule video call record' }, { status: 500 });
            }
            videoCallId = vCall.id;
        }

        let microsoftEventId: string | null = null;
        // The client-facing meeting link MUST point at the video_calls UUID so /meet/[id]
        // resolves the room (a Daily room name would be misread as a tenant slug → "Business not found").
        const maskedUrl = videoCallId ? publicAppUrl(`/meet/${videoCallId}`) : '';

        // 4.5 NATIVE CRM INTEGRATION (Lead, Calendar Event, Task)
        let leadId = null;
        let calendarEventId: string | null = null;
        try {
            // Check if Lead exists
            const { data: lead } = await supabase
                .from('leads')
                .select('id')
                .eq('tenant_id', tenant_id)
                .eq('email', client_email)
                .maybeSingle();

            if (lead?.id) {
                leadId = lead.id;
            } else {
                // Create new Lead
                const { data: newLead } = await supabase
                    .from('leads')
                    .insert({
                        tenant_id,
                        business_name: client_name,
                        email: client_email,
                        phone: client_phone,
                        stage: 'lead',
                        source: 'Inbound Booking',
                        notes: client_notes
                    })
                    .select('id')
                    .single();
                if (newLead) leadId = newLead.id;
            }

            // Create Native Calendar Event
            const calendarInsert = await supabase.from('calendar_events').insert({
                tenant_id,
                user_id: host_id,
                title: `Booking: ${booking_type_name || 'Meeting'} with ${client_name}`,
                description: `Notes: ${client_notes || 'No notes provided.'}`,
                start_time,
                end_time,
                type: 'meeting',
                video_room_id: videoCallId,
                related_to_lead: leadId,
                is_all_day: false,
                reminder_minutes: 15,
                metadata: providerMetadata.provider === 'teams'
                    ? { microsoft_event_id: providerMetadata.microsoft_event_id }
                    : { jitsi_url: dailyRoomUrl }
            }).select('id').single();
            calendarEventId = calendarInsert.data?.id || null;
            if (calendarInsert.error) throw calendarInsert.error;

            microsoftEventId = typeof providerMetadata.microsoft_event_id === 'string'
                ? providerMetadata.microsoft_event_id
                : null;

            // Create Native Task for the Sales Agent
            await supabase.from('tasks').insert({
                tenant_id,
                assigned_to: host_id,
                title: `Prepare for meeting with ${client_name}`,
                description: `Review lead details before the booked session. Notes: ${client_notes || ''}`,
                due_date: start_time, // Due at start time
                status: 'pending',
                priority: 'high',
                related_to_lead: leadId
            });

        } catch (crmErr) {
            console.error('Failed to create native CRM records:', crmErr);
            // Non-fatal, continue with booking creation
        }

        // 5. Insert Booking
        const { data: booking, error: bError } = await supabase
            .from('bookings')
            .insert({
                tenant_id,
                booking_type_id,
                client_name,
                client_email,
                client_phone,
                client_notes,
                start_time,
                end_time,
                time_zone,
                status: 'confirmed',
                video_call_id: videoCallId,
                calendar_event_id: calendarEventId,
                metadata: {
                    meeting_provider: providerMetadata.provider,
                    room_url: dailyRoomUrl,
                    microsoft_event_id: microsoftEventId,
                }
            })
            .select('*')
            .single();

        if (bError) {
            console.error('Booking Insert Error', bError);
            return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 });
        }

        // Durable, tenant-scoped confirmations for both host and customer.
        const notifications = await confirmNativeBooking(supabase, tenantData.slug, {
            tenantId: tenant_id, bookingId: booking.id, bookingTypeName: booking_type_name,
            clientName: client_name, clientEmail: client_email, clientNotes: client_notes,
            startTime: start_time, endTime: end_time, timeZone: time_zone,
            meetingUrl: maskedUrl, hostUserId: host_id, source: 'native',
        });

        return NextResponse.json({ success: true, booking, roomUrl: maskedUrl, notifications });
        } finally { await lock.release(); }
    } catch (err: any) {
        console.error('Booking API Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'booking/create' });
    }
}
