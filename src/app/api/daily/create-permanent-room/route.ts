import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
    if (!DAILY_API_KEY) {
        return NextResponse.json({ error: 'Daily API key not configured' }, { status: 500 });
    }

    try {
        const { userId, userName } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Check if user already has a permanent room
        const { data: existingRoom } = await supabase
            .from('video_calls')
            .select('*')
            .eq('host_id', userId)
            .eq('is_permanent', true)
            .single();

        if (existingRoom) {
            return NextResponse.json({
                id: existingRoom.id,
                name: existingRoom.daily_room_name,
                url: existingRoom.daily_room_url,
                title: existingRoom.title
            });
        }

        // 2. Create new Daily room
        const roomName = `perm-${userId.substring(0, 8)}-${Math.random().toString(36).substring(7)}`;

        const response = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                name: roomName,
                properties: {
                    enable_chat: true,
                    enable_screenshare: true,
                    max_participants: 10,
                    // Permanent rooms shouldn't expire soon
                    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year expiry
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json({ error: error.info || 'Failed to create Daily room' }, { status: response.status });
        }

        const dailyRoom = await response.json();

        // 3. Save to database
        const { data: newDbRoom, error: dbError } = await supabase
            .from('video_calls')
            .insert({
                room_id: dailyRoom.name,
                daily_room_url: dailyRoom.url,
                daily_room_name: dailyRoom.name,
                host_id: userId,
                title: `${userName}'s Permanent Office`,
                status: 'active',
                is_permanent: true,
                is_public: true, // Permanent rooms are typically joinable via link
                max_participants: 10,
                chat_enabled: true,
                screen_share_enabled: true
            })
            .select()
            .single();

        if (dbError) {
            return NextResponse.json({ error: 'Failed to save room to database', details: dbError }, { status: 500 });
        }

        return NextResponse.json({
            id: newDbRoom.id,
            name: newDbRoom.daily_room_name,
            url: newDbRoom.daily_room_url,
            title: newDbRoom.title
        });

    } catch (error) {
        console.error('Error creating permanent room:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
