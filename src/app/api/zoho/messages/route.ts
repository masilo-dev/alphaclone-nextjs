import { NextRequest, NextResponse } from 'next/server';
import { zohoServerService } from '@/services/server/zohoServerService';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const folderId = searchParams.get('folderId') || 'inbox';

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const endpoint = `messages/view?folderId=${folderId}`;
        const data = await zohoServerService.proxyRequest(userId, endpoint);

        // Map Zoho response to internal ZohoMessage format
        const messages = (data.data || []).map((msg: any) => ({
            id: msg.messageId,
            threadId: msg.threadId,
            subject: msg.subject,
            snippet: msg.summary,
            from: msg.sender,
            to: msg.toAddress,
            date: msg.sentTime,
            hasAttachments: msg.hasAttachment === '1'
        }));

        return NextResponse.json({ messages });
    } catch (err: any) {
        console.error('Zoho Messages Fetch Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, to, subject, content } = await req.json();

        if (!userId || !to || !subject || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const endpoint = 'messages';
        const body = {
            toAddress: to,
            subject: subject,
            content: content
        };

        const data = await zohoServerService.proxyRequest(userId, endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('Zoho Send Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
