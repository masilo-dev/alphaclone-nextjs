import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';

export async function POST(req: NextRequest) {
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
