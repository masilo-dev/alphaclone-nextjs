import { NextRequest, NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: threadId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const data = await gmailServerService.proxyRequest(userId, `threads/${threadId}`);
        return NextResponse.json(data);
    } catch (err: any) {
        console.error('Gmail Detail Proxy Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
