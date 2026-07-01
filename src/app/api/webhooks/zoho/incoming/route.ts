import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { isProduction } from '@/lib/security/productionGuard';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';

function matchesWebhookSecret(header: string | null, secrets: string[]): boolean {
    if (!header) return false;
    return secrets.some((secret) => {
        try {
            const a = Buffer.from(header);
            const b = Buffer.from(secret);
            return a.length === b.length && timingSafeEqual(a, b);
        } catch {
            return false;
        }
    });
}

export async function POST(req: NextRequest) {
    if (isProduction()) {
        const expected = [process.env.ZOHO_WEBHOOK_SECRET, process.env.INTERNAL_API_KEY].filter(
            (s): s is string => !!s
        );
        if (expected.length === 0) {
            return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 503 });
        }
        const secret = req.headers.get('x-zoho-webhook-secret');
        if (!matchesWebhookSecret(secret, expected)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const body = await req.json();
        console.log('[ZohoIncomingWebhook] Received:', JSON.stringify(body));

        // Zoho Push Notification Body for NEW_MAIL:
        // { "messageId": "...", "folderId": "...", "resource": "...", "event": "NEW_MAIL", "channelId": "user-{userId}" }
        // Note: Zoho might use "channelId" to help us identify the user!
        
        const { messageId, folderId, channelId } = body;
        if (!messageId || !folderId || !channelId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const userId = channelId.replace('user-', '');
        if (!userId) {
            return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 });
        }

        // Initialize service for this user
        const zohoService = new ZohoMailService(userId);
        
        // Triage the email (this will schedule the reply via QStash if qualified)
        await zohoService.triageIncomingEmail(messageId, folderId);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[ZohoIncomingWebhook] Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'webhooks/zoho/incoming' });
    }
}
