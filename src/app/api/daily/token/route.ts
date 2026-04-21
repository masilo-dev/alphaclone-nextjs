import { NextResponse } from 'next/server';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

async function ensureDailyRoomExists(roomName: string): Promise<void> {
    const checkResponse = await fetch(`${DAILY_API_URL}/rooms/${encodeURIComponent(roomName)}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`
        }
    });

    if (checkResponse.ok) {
        return;
    }

    if (checkResponse.status !== 404) {
        const checkError = await checkResponse.json().catch(() => ({}));
        throw new Error(checkError?.info || 'Failed to validate Daily room');
    }

    const createResponse = await fetch(`${DAILY_API_URL}/rooms`, {
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
                start_video_off: false,
                start_audio_off: false
            }
        })
    });

    if (!createResponse.ok) {
        const createError = await createResponse.json().catch(() => ({}));
        throw new Error(createError?.info || 'Failed to recreate Daily room');
    }
}

export async function POST(req: Request) {
    if (!DAILY_API_KEY) {
        return NextResponse.json({ error: 'Daily API key not configured' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { roomName, userName, isOwner } = body;
        if (!roomName || typeof roomName !== 'string') {
            return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
        }

        await ensureDailyRoomExists(roomName);

        const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                properties: {
                    room_name: roomName,
                    user_name: userName,
                    is_owner: isOwner || false,
                    // Token expires in 24 hours
                    exp: Math.floor(Date.now() / 1000) + 86400
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json({ error: error.info || 'Failed to create token' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({ token: data.token });

    } catch (error) {
        console.error('Error creating Daily token:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
