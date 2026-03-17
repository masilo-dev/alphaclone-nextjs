import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Email service not configured on server' }, { status: 500 });
        }

        const payload = await req.json();

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: payload.from || `${payload.fromName || 'AlphaClone Systems'} <onboarding@resend.dev>`,
                to: payload.to,
                subject: payload.subject,
                html: payload.html,
                text: payload.text,
                reply_to: payload.replyTo
            }),
        });

        const data = await response.json();

        if (response.ok) {
            return NextResponse.json({ success: true, id: data.id });
        } else {
            return NextResponse.json({ success: false, error: data.message || 'Failed to send email' }, { status: response.status });
        }
    } catch (error) {
        console.error('Error in /api/email/send:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
