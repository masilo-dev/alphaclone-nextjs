import { NextRequest, NextResponse } from 'next/server';
import { ZohoMailService } from '../../../../services/zoho/ZohoMailService';
import { ZohoAuthExpiredError, ZohoAPIError } from '../../../../services/zoho/ZohoService';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

async function getContext(req: NextRequest) {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim() || '';
    const { user } = await requireTenantAccess(tenantId, req);
    return { userId: user.id, tenantId };
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
    return NextResponse.json({ error: 'Zoho Mail request failed on our side. Try again or reconnect Zoho if it repeats.', code: 'INTERNAL_ERROR' }, { status: 500 });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    let context;
    try { context = await getContext(req); } catch (error) {
        return routeErrorResponse(error, 'Zoho Mail access could not be verified', req);
    }
    const zohoMail = new ZohoMailService(context.userId, context.tenantId);

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
                const [content, attachments] = await Promise.all([zohoMail.getMessageContent(messageId, folderId), zohoMail.getAttachmentInfo(messageId, folderId)]);
                return NextResponse.json({ ...content, attachments });
            }
            case 'attachment': {
                const messageId = searchParams.get('messageId');
                const folderId = searchParams.get('folderId');
                const attachmentId = searchParams.get('attachmentId');
                const requestedName = searchParams.get('fileName') || 'attachment';
                if (!messageId || !folderId || !attachmentId) return NextResponse.json({ error: 'Message, folder, and attachment IDs are required' }, { status: 400 });
                const attachment = await zohoMail.downloadAttachment(messageId, folderId, attachmentId);
                const fileName = requestedName.replace(/[\r\n"\\/]/g, '_').slice(0, 240) || 'attachment';
                return new NextResponse(attachment.body, { headers: { 'Content-Type': attachment.headers.get('content-type') || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${fileName}"`, 'Cache-Control': 'private, no-store' } });
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
    let context;
    try { context = await getContext(req); } catch (error) {
        return routeErrorResponse(error, 'Zoho Mail access could not be verified', req);
    }
    const zohoMail = new ZohoMailService(context.userId, context.tenantId);

    try {
        if (action === 'markRead') {
            const readMsgId = searchParams.get('messageId');
            const readFolderId = searchParams.get('folderId');
            const isRead = searchParams.get('status') !== 'false';
            if (!readMsgId || !readFolderId) {
                return NextResponse.json({ error: 'Message ID or Folder ID missing' }, { status: 400 });
            }
            const markRes = await zohoMail.markAsRead(readMsgId, readFolderId, isRead);
            return NextResponse.json(markRes);
        }

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
    let context;
    try { context = await getContext(req); } catch (error) {
        return routeErrorResponse(error, 'Zoho Mail access could not be verified', req);
    }
    if (!messageId || !folderId) return NextResponse.json({ error: 'Message ID or Folder ID missing' }, { status: 400 });

    const zohoMail = new ZohoMailService(context.userId, context.tenantId);

    try {
        const result = await zohoMail.deleteMessage(messageId, folderId);
        return NextResponse.json(result);
    } catch (err) {
        return handleZohoError(err);
    }
}
