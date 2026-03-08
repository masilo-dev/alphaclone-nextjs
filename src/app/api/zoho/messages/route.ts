import { NextRequest, NextResponse } from 'next/server';
import { zohoServerService } from '@/services/server/zohoServerService';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const folderId = searchParams.get('folderId') || 'inbox';
    const messageId = searchParams.get('messageId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        // If messageId is provided, fetch specific message details
        if (messageId) {
            const endpoint = `messages/${messageId}`;
            const data = await zohoServerService.proxyRequest(userId, endpoint);

            // Map Zoho detail response
            const msg = data.data || {};
            return NextResponse.json({
                message: {
                    id: msg.messageId,
                    subject: msg.subject,
                    content: msg.content,
                    from: msg.sender,
                    to: msg.toAddress,
                    date: msg.sentTime
                }
            });
        }

        // If we have a string like 'inbox', 'sent', etc, we need to map it to the actual Zoho folder ID
        let actualFolderId = folderId;
        if (['inbox', 'sent', 'starred', 'trash'].includes(folderId.toLowerCase())) {
            // Fetch folders from Zoho
            const foldersData = await zohoServerService.proxyRequest(userId, 'folders');
            const folders = foldersData.data || [];

            // Map our UI names to typical Zoho folder names
            const nameToMatch = folderId.toLowerCase() === 'inbox' ? 'Inbox'
                : folderId.toLowerCase() === 'sent' ? 'Sent'
                    : folderId.toLowerCase() === 'trash' ? 'Trash'
                        : 'Inbox'; // Default to inbox for starred or unknown for now (Zoho handles starred via flags, not folders typically, but we'll fallback)

            const targetFolder = folders.find((f: any) => f.folderName?.toLowerCase() === nameToMatch.toLowerCase());
            if (targetFolder && targetFolder.folderId) {
                actualFolderId = targetFolder.folderId;
            }
        }

        const endpoint = `messages/view?folderId=${actualFolderId}`;
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

        // Use the dedicated sendMessage method which handles mailFormat: 'html' and proper endpoint structure
        const data = await zohoServerService.sendMessage(userId, {
            toAddress: to,
            subject: subject,
            content: content
        });

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('Zoho Send Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
