import { NextRequest, NextResponse } from 'next/server';
import { ZohoMailService } from '../../../../services/zoho/ZohoMailService';
// import { getAuthSession } from '@/lib/auth-server'; // Mock or actual auth helper

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userId = req.headers.get('x-user-id'); // In production, get from session

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const zohoMail = new ZohoMailService(userId);

    try {
        switch (action) {
            case 'folders':
                const folders = await zohoMail.getFolders();
                return NextResponse.json(folders);
            case 'messages':
                const folderId = searchParams.get('folderId') || '1'; // Default inbox usually 1
                const limit = parseInt(searchParams.get('limit') || '20');
                const start = parseInt(searchParams.get('start') || '1');
                const messages = await zohoMail.getMessages(folderId, limit, start);
                return NextResponse.json(messages);
            case 'content':
                const messageId = searchParams.get('messageId');
                if (!messageId) return NextResponse.json({ error: 'Message ID missing' }, { status: 400 });
                const content = await zohoMail.getMessageContent(messageId);
                return NextResponse.json(content);
            case 'search':
                const query = searchParams.get('q');
                if (!query) return NextResponse.json({ error: 'Query missing' }, { status: 400 });
                const results = await zohoMail.searchMessages(query);
                return NextResponse.json(results);
            case 'archive':
                const archiveMsgId = searchParams.get('messageId');
                if (!archiveMsgId) return NextResponse.json({ error: 'Message ID missing' }, { status: 400 });
                const archiveRes = await zohoMail.archiveMessage(archiveMsgId);
                return NextResponse.json(archiveRes);
            case 'markRead':
                const readMsgId = searchParams.get('messageId');
                const status = searchParams.get('status') !== 'false';
                if (!readMsgId) return NextResponse.json({ error: 'Message ID missing' }, { status: 400 });
                const markRes = await zohoMail.markAsRead(readMsgId, status);
                return NextResponse.json(markRes);
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const zohoMail = new ZohoMailService(userId);
    const data = await req.json();

    try {
        const result = await zohoMail.sendEmail(data);
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!messageId) return NextResponse.json({ error: 'Message ID missing' }, { status: 400 });

    const zohoMail = new ZohoMailService(userId);

    try {
        const result = await zohoMail.deleteMessage(messageId);
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
