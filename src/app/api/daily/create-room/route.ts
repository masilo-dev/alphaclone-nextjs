import { NextResponse } from 'next/server';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

export async function POST(req: Request) {
    if (!DAILY_API_KEY) {
        console.error('[Daily] DAILY_API_KEY is not set; room creation disabled');
        return NextResponse.json(
            {
                error: 'Daily API key not configured',
                code: 'DAILY_NOT_CONFIGURED',
                details:
                    'Set DAILY_API_KEY in Vercel Project Settings (or local .env). Optional: NEXT_PUBLIC_DAILY_DOMAIN for your *.daily.co subdomain.',
                setup_guide: 'https://docs.daily.co/reference/rest-api',
            },
            { status: 422 }
        );
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
        return NextResponse.json(room);

    } catch (error) {
        console.error('Unhandled error in Daily room creation:', error);
        // Explicitly log this so the user can see it in terminal
        console.error('Error details:', error instanceof Error ? error.stack : String(error));

        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
