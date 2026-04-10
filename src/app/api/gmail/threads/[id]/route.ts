import { NextRequest, NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: threadId } = await params;
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

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

        const data = await gmailServerService.proxyRequest(userId, `threads/${threadId}`);
        return NextResponse.json(data);
    } catch (err: any) {
        return routeErrorResponse(err, 'Failed to fetch thread detail');
    }
}
