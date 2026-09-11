import { NextRequest, NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const maxResults = parseInt(searchParams.get('maxResults') || '20');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const { user } = await requireAuthenticatedUser();
        if (user.id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Check if we're asking for a specific thread via sub-path or query
        const pathParts = req.nextUrl.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        
        if (lastPart !== 'threads' && lastPart !== '') {
            const data = await gmailServerService.getThread(userId, lastPart);
            return NextResponse.json(data);
        }

        const data = await gmailServerService.listThreads(userId, maxResults);
        return NextResponse.json(data);
    } catch (err: any) {
        return routeErrorResponse(err, 'Failed to fetch messages');
    }
}


