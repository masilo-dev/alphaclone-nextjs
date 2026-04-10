import { NextRequest, NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const maxResults = searchParams.get('maxResults') || '20';
        const pageToken = searchParams.get('pageToken');
        const labelIds = searchParams.getAll('labelIds');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // "?"? SECURITY CHECK "?"?
        // Verifies user is logged in
        const { user } = await requireAuthenticatedUser();

        // Ensure user can only access their own Gmail data
        if (user.id !== userId) {
            return NextResponse.json({ error: 'Forbidden: You can only access your own Gmail threads' }, { status: 403 });
        }

        let endpoint = `threads?maxResults=${maxResults}`;
        if (pageToken) endpoint += `&pageToken=${pageToken}`;
        if (labelIds.length > 0) {
            labelIds.forEach(label => endpoint += `&labelIds=${label}`);
        }

        const data = await gmailServerService.proxyRequest(userId, endpoint);
        return NextResponse.json(data);
    } catch (err: any) {
        return routeErrorResponse(err, 'Failed to fetch messages');
    }
}

