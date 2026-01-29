
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { addMinutes } from 'date-fns';


// Helper to get Supabase Admin Client
function getSupabaseAdmin() {
    const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Missing Supabase Service Role credentials');
    }

    return createClient(url, key);
}

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { tenantId, meetingTypeId, startTime, clientDetails } = body;

        if (!tenantId || !meetingTypeId || !startTime || !clientDetails) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log(`[BookingAPI] Creating booking for tenant ${tenantId}`);

        // 1. Get Tenant & Meeting Type
        const supabaseAdmin = getSupabaseAdmin();
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const settings = tenant.settings as any;
        const meetingType = settings?.booking?.meetingTypes?.find((t: any) => t.id === meetingTypeId);

        if (!meetingType) {
            return NextResponse.json({ error: 'Invalid meeting type' }, { status: 400 });
        }

        // 2. Find Host (Admin/Owner)
        const { data: users, error: usersError } = await supabaseAdmin
            .from('tenant_users')
            .select('user_id, role')
            .eq('tenant_id', tenantId);

        if (usersError) return NextResponse.json({ error: 'Failed to fetch host' }, { status: 500 });

        const host = users.find((u: any) => u.role === 'owner' || u.role === 'admin');
        if (!host) return NextResponse.json({ error: 'No host available' }, { status: 404 });

        const hostId = host.user_id;

        // 3. Check Limits (if Trial)
        // Simplified limit check for now
        if (tenant.subscription_status === 'trial') {
            const { count } = await supabaseAdmin
                .from('video_calls')
                .select('*', { count: 'exact', head: true })
                .eq('host_id', hostId);

            // Hardcoded limit from types.ts
            const MAX_MEETINGS = 2;
            if (count && count >= MAX_MEETINGS) {
                return NextResponse.json({ error: 'Trial limit reached' }, { status: 403 });
            }
        }

        // 4. Create Daily Room
        if (!DAILY_API_KEY) {
            return NextResponse.json({ error: 'Server misconfiguration: No Video API Key' }, { status: 500 });
        }

        const roomName = `room-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const duration = meetingType.duration || 30;

        const dailyRes = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                name: roomName,
                properties: {
                    enable_screenshare: true,
                    enable_chat: true,
                    exp: Math.floor((new Date(startTime).getTime() + duration * 60000) / 1000)
                }
            })
        });

        if (!dailyRes.ok) {
            const err = await dailyRes.json();
            console.error('[BookingAPI] Daily API failed:', err);
            return NextResponse.json({ error: 'Failed to create video room' }, { status: 500 });
        }

        const room = await dailyRes.json();

        // 5. Create DB Records (Transactional-like)

        // A. Video Call Record
        const { data: videoCall, error: videoError } = await supabaseAdmin
            .from('video_calls')
            .insert({
                room_id: room.name,
                daily_room_url: room.url,
                daily_room_name: room.name,
                host_id: hostId,
                title: `Meeting with ${clientDetails.name}: ${meetingType.name}`,
                status: 'scheduled',
                participants: [],
                max_participants: 2,
                duration: duration,
                is_public: false,
                scheduled_at: startTime
            })
            .select()
            .single();

        if (videoError) throw new Error('DB Error (Video): ' + videoError.message);

        // B. Calendar Event
        const eventStart = new Date(startTime);
        const eventEnd = addMinutes(eventStart, duration);

        const { data: event, error: calError } = await supabaseAdmin
            .from('calendar_events')
            .insert({
                tenant_id: tenantId, // Important!
                user_id: hostId,
                title: `${meetingType.name} - ${clientDetails.name}`,
                description: `Client: ${clientDetails.name} (${clientDetails.email})\nPhone: ${clientDetails.phone || 'N/A'}\nTopic: ${clientDetails.topic || 'General'}\n\nVideo Link: ${room.url}`,
                start_time: eventStart.toISOString(),
                end_time: eventEnd.toISOString(),
                type: 'meeting',
                video_room_id: videoCall.id, // ID from step A
                attendees: [clientDetails.email],
                is_all_day: false,
                reminder_minutes: 30,
                color: '#8b5cf6',
                metadata: {
                    customFields: clientDetails.customFields || {},
                    topic: clientDetails.topic,
                    phone: clientDetails.phone,
                    // Link back to video call room ID if needed
                }
            })
            .select()
            .single();

        if (calError) throw new Error('DB Error (Calendar): ' + calError.message);

        // Update video call with event ID
        await supabaseAdmin
            .from('video_calls')
            .update({ calendar_event_id: event.id })
            .eq('id', videoCall.id);

        // C. Task
        await supabaseAdmin
            .from('tasks')
            .insert({
                tenant_id: tenantId,
                title: `Meeting: ${meetingType.name} with ${clientDetails.name}`,
                description: `Client: ${clientDetails.name}\nTopic: ${clientDetails.topic || 'N/A'}`,
                due_date: eventStart.toISOString(), // Mapping dueDate to start
                status: 'todo',
                priority: 'medium',
                assigned_to: hostId,
                tags: ['meeting', 'booking'],
                metadata: { is_booking_shadow: true }
            });

        return NextResponse.json({ bookingId: event.id });

    } catch (err) {
        console.error('[BookingAPI] Creation error:', err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
