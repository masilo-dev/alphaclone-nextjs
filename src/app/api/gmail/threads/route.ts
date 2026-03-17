import { NextRequest, NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const maxResults = searchParams.get('maxResults') || '20';
    const pageToken = searchParams.get('pageToken');
    const labelIds = searchParams.getAll('labelIds');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        let endpoint = `threads?maxResults=${maxResults}`;
        if (pageToken) endpoint += `&pageToken=${pageToken}`;
        if (labelIds.length > 0) {
            labelIds.forEach(label => endpoint += `&labelIds=${label}`);
        }

        const data = await gmailServerService.proxyRequest(userId, endpoint);
        return NextResponse.json(data);
    } catch (err: any) {
        console.error('Gmail Proxy Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
