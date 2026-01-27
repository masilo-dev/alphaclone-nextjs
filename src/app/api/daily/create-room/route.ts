import { NextResponse } from 'next/server';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

export async function POST(req: Request) {
    console.debug('POST /api/daily/create-room called');

    if (!DAILY_API_KEY) {
        console.error('DAILY_API_KEY is missing from environment variables');
        return NextResponse.json({
            error: 'Daily API key not configured',
            details: 'The DAILY_API_KEY environment variable is not set on the server.'
        }, { status: 500 });
    }

    try {
        const body = await req.json();
        console.debug('Request body:', body);
        const { name, properties } = body;

        console.debug('Fetching Daily.co API...');
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
                    enable_chat: true,
                    start_video_off: false,
                    start_audio_off: false
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Daily.co API error:', error);
            return NextResponse.json({
                error: error.info || 'Failed to create room',
                details: error
            }, { status: response.status });
        }

        const room = await response.json();
        console.debug('Daily.co room created:', room);
        return NextResponse.json(room);

    } catch (error) {
        console.error('Unhandled error in Daily room creation:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
