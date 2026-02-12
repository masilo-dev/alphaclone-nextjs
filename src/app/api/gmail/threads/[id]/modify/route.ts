import { NextRequest, NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: threadId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const { addLabelIds, removeLabelIds } = body;

        const data = await gmailServerService.proxyRequest(userId, `threads/${threadId}/modify`, {
            method: 'POST',
            body: JSON.stringify({ addLabelIds, removeLabelIds }),
        });

        return NextResponse.json(data);
    } catch (err: any) {
        console.error('Gmail Modify Proxy Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
