import { NextRequest, NextResponse } from 'next/server';
import { gmailServerService } from '@/services/server/gmailServerService';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, to, subject, messageBody, threadId } = body;

        if (!userId || !to || !subject || !messageBody) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${to}`,
            `Subject: ${utf8Subject}`,
            `Content-Type: text/plain; charset="UTF-8"`,
            '',
            messageBody,
        ];

        const message = messageParts.join('\n');
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
        console.error('Gmail Send Proxy Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
