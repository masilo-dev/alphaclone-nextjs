import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

export async function POST(req: Request) {
    if (!DAILY_API_KEY) {
        console.error('[Daily] DAILY_API_KEY is not set; room creation disabled');
        return NextResponse.json(
            {
                error: 'Video rooms are not configured for this environment.',
                code: 'DAILY_NOT_CONFIGURED',
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
            return NextResponse.json(
                {
                    error: 'Failed to create video room. Please try again.',
                    code: 'DAILY_API_ERROR',
                },
                { status: response.status >= 400 && response.status < 600 ? response.status : 502 }
            );
        }

        const room = await response.json();
        return NextResponse.json(room);

    } catch (error) {
        console.error('Unhandled error in Daily room creation:', error);
        console.error('Error details:', error instanceof Error ? error.stack : String(error));
        return clientErrorResponse(error, { request: req, scope: 'daily/create-room.POST' });
    }
}
