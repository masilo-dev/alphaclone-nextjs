import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Initialize Clients
// Initialize Clients inside handler to avoid build-time errors if env vars missing
// const supabase = createClient(...);

const DAILY_API_KEY = process.env.DAILY_API_KEY;

export async function POST(req: Request) {
    try {
        // Initialize Supabase Client
        // Must be inside handler to avoid build-time error if key is missing during static generation
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
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
            booking_type_name // pass explicitly to save query
        } = body;

        // 1. Validation
        if (!tenant_id || !booking_type_id || !start_time || !client_email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

        // 3. Create Daily Room
        // Room name: "booking-{short_random}"
        const roomName = `booking-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // 3a. Enforce Video Duration Limit
        const meetingDurationMinutes = (new Date(end_time).getTime() - new Date(start_time).getTime()) / 60000;
        const maxMinutes = planFeatures.maxVideoMinutesPerMeeting;

        // If plan limit is stricter than requested duration, cap it
        const finalDurationMinutes = maxMinutes === -1 ? meetingDurationMinutes : Math.min(meetingDurationMinutes, maxMinutes);

        const startUnix = Math.floor(new Date(start_time).getTime() / 1000);
        const endUnix = startUnix + (finalDurationMinutes * 60);

        let dailyRoomUrl = '';
        let roomId = '';

        if (DAILY_API_KEY) {
            const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DAILY_API_KEY}`
                },
                body: JSON.stringify({
                    name: roomName,
                    properties: {
                        nbf: startUnix - 600, // 10 mins before
                        exp: endUnix + 3600, // 1 hour after
                        enable_chat: true,
                    }
                })
            });

            if (dailyRes.ok) {
                const roomData = await dailyRes.json();
                dailyRoomUrl = roomData.url;
                roomId = roomData.name;
            } else {
                console.error('Daily API Failed', await dailyRes.text());
                // Fallback? We can continue without video or error.
                // Let's error for now as "video call" is key feature.
                return NextResponse.json({ error: 'Failed to generate video meeting' }, { status: 502 });
            }
        } else {
            console.warn('DAILY_API_KEY missing - skipping video room');
            // Mock for dev if key missing
            if (process.env.NODE_ENV === 'development') {
                roomId = roomName;
                dailyRoomUrl = 'https://demo.daily.co/' + roomName;
            }
        }

        // 3b. Construct Masked URL
        const host = req.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const maskedUrl = roomId ? `${protocol}://${host}/meet/${roomId}` : '';

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
                    is_public: false
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
                video_call_id: videoCallId
            })
            .select('*')
            .single();

        if (bError) {
            console.error('Booking Insert Error', bError);
            return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 });
        }

        // 6. Send Email
        const resendApiKey = process.env.NEXT_PUBLIC_RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            const dateStr = new Date(start_time).toLocaleString('en-US', {
                timeZone: time_zone || 'UTC',
                dateStyle: 'full',
                timeStyle: 'short'
            });

            await resend.emails.send({
                from: 'AlphaClone <bookings@resend.dev>', // Update on prod
                to: client_email,
                subject: `Confirmation: ${booking_type_name || 'Meeting'} on ${dateStr}`,
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
        }

        return NextResponse.json({ success: true, booking, roomUrl: maskedUrl });
    } catch (err: any) {
        console.error('Booking API Error:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
    }
}
