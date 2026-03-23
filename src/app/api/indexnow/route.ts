import { NextRequest, NextResponse } from 'next/server';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY;
const BASE_URL = 'https://alphaclone.tech';

// IndexNow protocol — real-time notification to Bing and AI search partners
// POST with JSON body: { urls: string[] }
// Notifies search engines of new or updated content immediately
export async function POST(request: NextRequest) {
    try {
        if (!INDEXNOW_KEY) {
            return NextResponse.json({ error: 'INDEXNOW_KEY is not configured' }, { status: 500 });
        }

        const body = await request.json();
        const { urls } = body as { urls: string[] };

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: 'urls array is required' }, { status: 400 });
        }

        const payload = {
            host: 'alphaclone.tech',
            key: INDEXNOW_KEY,
            keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
            urlList: urls,
        };

        const response = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(payload),
        });

        if (response.ok || response.status === 202) {
            return NextResponse.json({
                success: true,
                message: `Successfully pinged IndexNow for ${urls.length} URL(s)`,
                urls,
            });
        }

        return NextResponse.json({
            success: false,
            status: response.status,
            message: 'IndexNow ping failed',
        }, { status: 500 });

    } catch (error) {
        console.error('IndexNow error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET handler — ping all core marketing pages
export async function GET() {
    if (!INDEXNOW_KEY) {
        return NextResponse.json({ error: 'INDEXNOW_KEY is not configured' }, { status: 500 });
    }

    const coreUrls = [
        `${BASE_URL}/`,
        `${BASE_URL}/services`,
        `${BASE_URL}/about`,
        `${BASE_URL}/guide`,
        `${BASE_URL}/docs`,
        `${BASE_URL}/pricing`,
        `${BASE_URL}/ecosystem`,
        `${BASE_URL}/who-we-serve`,
        `${BASE_URL}/blog`,
        `${BASE_URL}/contact`,
    ];

    const payload = {
        host: 'alphaclone.tech',
        key: INDEXNOW_KEY,
        keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: coreUrls,
    };

    try {
        const response = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload),
        });

        return NextResponse.json({
            success: response.ok || response.status === 202,
            pingedUrls: coreUrls.length,
            status: response.status,
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
