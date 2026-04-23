import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

const normalizeOrigin = (value: string | null | undefined): string | null => {
    if (!value) return null;
    return value.replace(/\/+$/, '');
};

const resolveAppOrigin = (req: Request): string => {
    const fromOrigin = normalizeOrigin(req.headers.get('origin'));
    if (fromOrigin) return fromOrigin;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`;
    return normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) || 'https://alphaclonesystems.com';
};

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
        const appOrigin = resolveAppOrigin(req);

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
                    start_audio_off: false,
                    meeting_join_hook: `${appOrigin}/api/meetings/hooks/join`,
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
