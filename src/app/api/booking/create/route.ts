import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createClient } from '@supabase/supabase-js';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { microsoftServerService } from '@/services/server/microsoftServerService';

// Initialize Clients
// Initialize Clients inside handler to avoid build-time errors if env vars missing
// const supabase = createClient(...);

import { ENV } from '@/config/env';
import { isTurnstileEnforced, verifyTurnstileToken } from '@/lib/verifyTurnstile';

export async function POST(req: Request) {
    try {
        // Initialize Supabase Client
        const supabase = createClient(
            ENV.VITE_SUPABASE_URL,
            ENV.SUPABASE_SERVICE_ROLE_KEY
        );

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
            booking_type_name,
            turnstile_token,
        } = body;

        if (!tenant_id || !booking_type_id || !start_time || !client_email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (isTurnstileEnforced()) {
            if (!turnstile_token?.trim()) {
                return NextResponse.json({ error: 'Security verification required' }, { status: 400 });
            }
            const ok = await verifyTurnstileToken(turnstile_token);
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
            .select('subscription_plan')
            .eq('id', tenant_id)
            .single();

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
            .select('user_id')
            .eq('tenant_id', tenant_id)
            .limit(1);

        if (userError || !users?.length) {
            console.error('No host found for tenant:', tenant_id, userError);
            return NextResponse.json({ error: 'Configuration Error: Tenant has no active hosts.' }, { status: 500 });
        }
        const host_id = users[0].user_id;
        const microsoftConnection = await microsoftServerService.getConnection(host_id).catch(() => null);

        // 2b. Conflict Check (Harden against Race Conditions)
        const requestedStart = new Date(start_time);
        const requestedEnd = new Date(end_time);

        const { data: overlapping, error: conflictError } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('user_id', host_id)
            .or(`and(start_time.lt.${requestedEnd.toISOString()},end_time.gt.${requestedStart.toISOString()})`)
            .limit(1);

        if (conflictError) throw new Error('Failed to verify slot availability');
        if (overlapping && overlapping.length > 0) {
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
        const roomName = `booking-${Date.now()}-${Math.random().toString(36).substring(7)}`;
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
        const host = req.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';

        // 4. Insert Video Call
        let videoCallId = null;
        if (roomId) {
            const { data: vCall, error: vError } = await supabase
                .from('video_calls')
                .insert({
                    room_id: roomId,
                    daily_room_url: dailyRoomUrl,
                    daily_room_name: roomId,
                    host_id: host_id,
                    title: `Meeting with ${client_name}`,
                    status: 'scheduled',
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
        const maskedUrl = videoCallId ? `${protocol}://${host}/meet/${videoCallId}` : '';

        // 4.5 NATIVE CRM INTEGRATION (Lead, Calendar Event, Task)
        let leadId = null;
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
                video_room_id: roomId,
                related_to_lead: leadId,
                is_all_day: false,
                reminder_minutes: 15,
                metadata: providerMetadata.provider === 'teams'
                    ? { microsoft_event_id: providerMetadata.microsoft_event_id }
                    : { jitsi_url: dailyRoomUrl }
            });
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

        // 6. Send Email
        if (tenant_id) {
            const dateStr = new Date(start_time).toLocaleString('en-US', {
                timeZone: time_zone || 'UTC',
                dateStyle: 'full',
                timeStyle: 'short'
            });

            const emailResult = await sendEmailServer({
                tenantId: tenant_id,
                to: client_email,
                subject: `Confirmation: ${booking_type_name || 'Meeting'} on ${dateStr}`,
                templateName: 'bookingConfirmation',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 20px;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 20px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">

                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, #14b8a6 0%, #0f766e 100%); padding: 40px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Meeting Confirmed</h1>
                            </div>

                            <!-- Content -->
                            <div style="padding: 40px;">
                                <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                                    Hi <strong>${client_name}</strong>,<br><br>
                                    Your session for <strong>${booking_type_name || 'Meeting'}</strong> has been successfully scheduled. We are looking forward to speaking with you.
                                </p>

                                <!-- Details Card -->
                                <div style="background-color: #0f172a; border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #334155;">
                                    <div style="margin-bottom: 20px;">
                                        <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin: 0 0 5px 0;">DATE & TIME</p>
                                        <p style="color: #f8fafc; font-size: 18px; font-weight: 600; margin: 0;">${dateStr}</p>
                                        ${time_zone ? `<p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">(${time_zone})</p>` : ''}
                                    </div>
                                    <div>
                                         <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin: 0 0 5px 0;">VIDEO LINK</p>
                                         <p style="color: #2dd4bf; font-size: 14px; margin: 0; word-break: break-all;">${maskedUrl}</p>
                                    </div>
                                </div>

                                <!-- CTA -->
                                ${maskedUrl ? `
                                    <div style="text-align: center;">
                                        <a href="${maskedUrl}" style="background-color: #14b8a6; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; transition: background-color 0.2s; box-shadow: 0 10px 15px -3px rgba(20, 184, 166, 0.3);">
                                            Join Video Call
                                        </a>
                                        <p style="color: #64748b; font-size: 13px; margin-top: 20px;">
                                            Please click the button above at the scheduled time to join.
                                        </p>
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Footer -->
                            <div style="background-color: #020617; padding: 30px; text-align: center; border-top: 1px solid #334155;">
                                <p style="color: #475569; font-size: 12px; margin: 0;">
                                    © ${new Date().getFullYear()} AlphaClone Systems. All rights reserved.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                 `
            });
            if (!emailResult.success) {
                console.error('Booking confirmation email failed:', emailResult.error);
            }

            // Notify host + follow-up task so the owner sees the booking off-platform too
            try {
                const { data: hostProfile } = await supabase
                    .from('profiles')
                    .select('email, name')
                    .eq('id', host_id)
                    .maybeSingle();

                if (hostProfile?.email) {
                    await sendEmailServer({
                        tenantId: tenant_id,
                        to: hostProfile.email,
                        subject: `New booking: ${client_name} — ${booking_type_name || 'Meeting'}`,
                        html: `
                            <div style="font-family:sans-serif;padding:20px;color:#333;">
                                <h2 style="color:#0d9488;">New client booking</h2>
                                <p><strong>${client_name}</strong> (${client_email}) booked <strong>${booking_type_name || 'Meeting'}</strong>.</p>
                                <p><strong>When:</strong> ${dateStr}</p>
                                ${maskedUrl ? `<p><a href="${maskedUrl}" style="display:inline-block;padding:10px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px;">Join meeting</a></p>` : ''}
                                ${client_notes ? `<p><strong>Notes:</strong> ${client_notes}</p>` : ''}
                            </div>
                        `,
                        isPlatformNotification: true,
                    });
                }
            } catch (hostEmailErr) {
                console.error('Host booking notification failed:', hostEmailErr);
            }
        }

        return NextResponse.json({ success: true, booking, roomUrl: maskedUrl });
    } catch (err: any) {
        console.error('Booking API Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'booking/create' });
    }
}
