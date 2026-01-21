import { NextResponse } from 'next/server';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

export async function POST(req: Request) {
    if (!DAILY_API_KEY) {
        return NextResponse.json({ error: 'Daily API key not configured' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { name, properties } = body;

        const response = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                name,
                properties: {
                    ...properties,
                    // Enforce some defaults if needed
                    enable_chat: true, // We might disable this if doing custom chat, but enabling for now as fallback
                    start_video_off: false,
                    start_audio_off: false
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json({ error: error.info || 'Failed to create room' }, { status: response.status });
        }

        const room = await response.json();
        return NextResponse.json(room);

    } catch (error) {
        console.error('Error creating Daily room:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
