import { NextRequest, NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const body = await req.json();
        const { to, cc, bcc, subject, messageBody, threadId, attachments } = body;

        if (!userId || !to || !subject || !messageBody) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const { user } = await requireAuthenticatedUser();
        if (user.id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const data = await gmailServerService.sendEmail(userId, {
            to,
            subject,
            messageBody,
            threadId,
            cc,
            bcc,
            attachments: attachments?.map((att: any) => ({
                filename: att.filename,
                content: att.data, // Expected to be base64
                contentType: att.mimeType,
            })),
        });

        return NextResponse.json(data);
    } catch (err: any) {
        return routeErrorResponse(err, 'Failed to send message');
    }
}


