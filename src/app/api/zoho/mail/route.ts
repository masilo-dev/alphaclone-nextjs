import { NextRequest, NextResponse } from 'next/server';
import { ZohoMailService } from '../../../../services/zoho/ZohoMailService';
import { ZohoAuthExpiredError, ZohoAPIError } from '../../../../services/zoho/ZohoService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

async function getUserId(req: NextRequest): Promise<string | null> {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) return user.id;
    } catch {}

    const { searchParams } = new URL(req.url);
    const userIdFromQuery = searchParams.get('userId');
    if (userIdFromQuery) return userIdFromQuery;

    return req.headers.get('x-user-id');
}

function handleZohoError(err: unknown): NextResponse {
    const isMissingConfig =
        err instanceof Error &&
        (err.message.includes('missing mailApiHost') ||
            err.message.includes('missing accountId') ||
            err.message.includes('is not fully configured'));

    if (err instanceof ZohoAuthExpiredError || isMissingConfig) {
        console.error('[Zoho Mail API] auth/config:', err);
        return NextResponse.json(
            { error: 'Zoho Mail session expired or setup is incomplete.', code: 'ZOHO_RECONNECT', reconnect: true },
            { status: 401 }
        );
    }

    if (err instanceof ZohoAPIError) {
        console.error('[Zoho Mail API] ZohoAPIError', err.status, err.message);
        const status = err.status;
        if (status === 401 || status === 403) {
            return NextResponse.json(
                { error: 'Zoho Mail rejected this request. Reconnect Zoho and try again.', code: 'ZOHO_FORBIDDEN', reconnect: true },
                { status: 401 }
            );
        }
        if (status === 429) {
            return NextResponse.json(
                { error: 'Zoho rate limit reached. Wait a minute and try again.', code: 'ZOHO_RATE_LIMIT' },
                { status: 429 }
            );
        }
        if (status >= 502 && status <= 504) {
            return NextResponse.json(
                {
                    error: 'Zoho Mail is temporarily unavailable. Try again in a few minutes.',
                    code: 'ZOHO_UPSTREAM_UNAVAILABLE',
                },
                { status: 503 }
            );
        }
        const clientErr = status >= 400 && status < 500;
        return NextResponse.json(
            { error: 'Zoho Mail request failed. Try again or reconnect the integration.', code: 'ZOHO_API_ERROR' },
            { status: clientErr ? status : 500 }
        );
    }

    console.error('[Zoho Mail API]', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' }, { status: 500 });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userId = await getUserId(req);

    if (!userId) {
        return NextResponse.json(
            {
                error: 'No active session. Sign in again, then reopen Zoho Mail.',
                code: 'NO_SUPABASE_SESSION',
                reconnect: false,
            },
            { status: 401 }
        );
    }

    const zohoMail = new ZohoMailService(userId);

    try {
        switch (action) {
            case 'folders': {
                const folders = await zohoMail.getFolders();
                return NextResponse.json(folders);
            }
            case 'sender-addresses': {
                const addresses = await zohoMail.getSenderAddresses();
                return NextResponse.json(addresses);
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
                const folderId = searchParams.get('folderId');
                if (!messageId || !folderId) return NextResponse.json({ error: 'Message ID or Folder ID missing' }, { status: 400 });
                const content = await zohoMail.getMessageContent(messageId, folderId);
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
                const archiveFolderId = searchParams.get('folderId');
                if (!archiveMsgId || !archiveFolderId) return NextResponse.json({ error: 'Message ID or Folder ID missing' }, { status: 400 });
                const archiveRes = await zohoMail.archiveMessage(archiveMsgId, archiveFolderId);
                return NextResponse.json(archiveRes);
            }
            case 'markRead': {
                const readMsgId = searchParams.get('messageId');
                const readFolderId = searchParams.get('folderId');
                const isRead = searchParams.get('status') !== 'false';
                if (!readMsgId || !readFolderId) return NextResponse.json({ error: 'Message ID or Folder ID missing' }, { status: 400 });
                const markRes = await zohoMail.markAsRead(readMsgId, readFolderId, isRead);
                return NextResponse.json(markRes);
            }
            case 'proxy-image': {
                const imgPath = searchParams.get('path');
                if (!imgPath) return NextResponse.json({ error: 'Path missing' }, { status: 400 });
                const res = await zohoMail.proxyImage(imgPath);
                const contentType = res.headers.get('content-type') || 'image/jpeg';
                // Return streaming response so Next.js handles proxying the buffer efficiently
                return new NextResponse(res.body, {
                    headers: { 'Content-Type': contentType },
                });
            }
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err) {
        return handleZohoError(err);
    }
}

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userId = await getUserId(req);
    if (!userId) {
        return NextResponse.json(
            {
                error: 'No active session. Sign in again, then reopen Zoho Mail.',
                code: 'NO_SUPABASE_SESSION',
                reconnect: false,
            },
            { status: 401 }
        );
    }

    const zohoMail = new ZohoMailService(userId);

    try {
        if (action === 'subscribe') {
            const result = await zohoMail.subscribeToNotifications();
            return NextResponse.json({ success: true, result });
        }
        
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
    const folderId = searchParams.get('folderId');
    const userId = await getUserId(req);

    if (!userId) {
        return NextResponse.json(
            {
                error: 'No active session. Sign in again, then reopen Zoho Mail.',
                code: 'NO_SUPABASE_SESSION',
                reconnect: false,
            },
            { status: 401 }
        );
    }
    if (!messageId || !folderId) return NextResponse.json({ error: 'Message ID or Folder ID missing' }, { status: 400 });

    const zohoMail = new ZohoMailService(userId);

    try {
        const result = await zohoMail.deleteMessage(messageId, folderId);
        return NextResponse.json(result);
    } catch (err) {
        return handleZohoError(err);
    }
}
