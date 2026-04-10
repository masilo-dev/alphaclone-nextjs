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

        // "?"? SECURITY CHECK "?"?
        // Verifies user is logged in
        const { user } = await requireAuthenticatedUser();

        // Ensure user can only send as themselves
        if (user.id !== userId) {
            return NextResponse.json({ error: 'Forbidden: You can only send emails from your own account' }, { status: 403 });
        }

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        
        let message: string;
        
        if (attachments && attachments.length > 0) {
            // Create multipart message with attachments
            const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const messageParts = [
                `To: ${to}`,
                cc ? `Cc: ${cc}` : null,
                bcc ? `Bcc: ${bcc}` : null,
                `Subject: ${utf8Subject}`,
                `MIME-Version: 1.0`,
                `Content-Type: multipart/mixed; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                `Content-Type: text/plain; charset="UTF-8"`,
                `Content-Transfer-Encoding: 7bit`,
                '',
                messageBody,
            ].filter(Boolean);

            // Add each attachment
            for (const att of attachments) {
                messageParts.push(
                    `--${boundary}`,
                    `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"`,
                    `Content-Disposition: attachment; filename="${att.filename}"`,
                    `Content-Transfer-Encoding: base64`,
                    '',
                    att.data,
                );
            }

            messageParts.push(`--${boundary}--`);
            message = messageParts.join('\n');
        } else {
            // Simple text message
            const messageParts = [
                `To: ${to}`,
                cc ? `Cc: ${cc}` : null,
                bcc ? `Bcc: ${bcc}` : null,
                `Subject: ${utf8Subject}`,
                `Content-Type: text/plain; charset="UTF-8"`,
                '',
                messageBody,
            ].filter(Boolean);
            message = messageParts.join('\n');
        }

        const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const payload: any = { raw: encodedMessage };
        if (threadId) {
            payload.threadId = threadId;
        }

        const data = await gmailServerService.proxyRequest(userId, 'messages/send', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        return NextResponse.json(data);
    } catch (err: any) {
        return routeErrorResponse(err, 'Failed to send message');
    }
}

