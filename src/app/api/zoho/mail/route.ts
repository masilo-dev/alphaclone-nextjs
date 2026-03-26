import { NextRequest, NextResponse } from 'next/server';
import { ZohoMailService } from '../../../../services/zoho/ZohoMailService';
import { ZohoAuthExpiredError } from '../../../../services/zoho/ZohoService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

async function getUserId(req: NextRequest): Promise<string | null> {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) return user.id;
    } catch {}
    return req.headers.get('x-user-id');
}

function handleZohoError(err: unknown): NextResponse {
    if (err instanceof ZohoAuthExpiredError) {
        return NextResponse.json(
            { error: err.message, reconnect: true },
            { status: 401 }
        );
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Zoho Mail API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userId = await getUserId(req);

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const zohoMail = new ZohoMailService(userId);

    try {
        switch (action) {
            case 'folders': {
                const folders = await zohoMail.getFolders();
                return NextResponse.json(folders);
            }
            case 'messages': {
                const folderId = searchParams.get('folderId') || '1';
                const limit = parseInt(searchParams.get('limit') || '20');
                const start = parseInt(searchParams.get('start') || '1');
                const messages = await zohoMail.getMessages(folderId, limit, start);
                return NextResponse.json(messages);
            }
            case 'content': {
                const messageId = searchParams.get('messageId');
                if (!messageId) return NextResponse.json({ error: 'Message ID missing' }, { status: 400 });
                const content = await zohoMail.getMessageContent(messageId);
                return NextResponse.json(content);
            }
            case 'search': {
                const query = searchParams.get('q');
                if (!query) return NextResponse.json({ error: 'Query missing' }, { status: 400 });
                const results = await zohoMail.searchMessages(query);
                return NextResponse.json(results);
            }
            case 'archive': {
                const archiveMsgId = searchParams.get('messageId');
                if (!archiveMsgId) return NextResponse.json({ error: 'Message ID missing' }, { status: 400 });
                const archiveRes = await zohoMail.archiveMessage(archiveMsgId);
                return NextResponse.json(archiveRes);
            }
            case 'markRead': {
                const readMsgId = searchParams.get('messageId');
                const isRead = searchParams.get('status') !== 'false';
                if (!readMsgId) return NextResponse.json({ error: 'Message ID missing' }, { status: 400 });
                const markRes = await zohoMail.markAsRead(readMsgId, isRead);
                return NextResponse.json(markRes);
            }
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err) {
        return handleZohoError(err);
    }
}

export async function POST(req: NextRequest) {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const zohoMail = new ZohoMailService(userId);

    try {
        const data = await req.json();
        const result = await zohoMail.sendEmail(data);
        return NextResponse.json(result);
    } catch (err) {
        return handleZohoError(err);
    }
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');
    const userId = await getUserId(req);

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!messageId) return NextResponse.json({ error: 'Message ID missing' }, { status: 400 });

    const zohoMail = new ZohoMailService(userId);

    try {
        const result = await zohoMail.deleteMessage(messageId);
        return NextResponse.json(result);
    } catch (err) {
        return handleZohoError(err);
    }
}
