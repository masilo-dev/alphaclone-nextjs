import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminSupabaseClientOrThrow,
    requireAuthenticatedUser,
    requireTenantAccess,
    routeErrorResponse,
} from '@/lib/apiAuth';
import { facebookService } from '@/services/facebookService';
import { instagramService } from '@/services/instagramService';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

export async function POST(req: NextRequest) {
    try {
        await requireAuthenticatedUser();
        const { conversationId, text } = await req.json();

        if (!conversationId || !text) {
            return NextResponse.json({ error: 'Conversation ID and text are required' }, { status: 400 });
        }

        const supabase = createAdminSupabaseClientOrThrow();

        // 1. Get conversation details (to get page_id, sender_id, tenant_id)
        const { data: conversation, error: convError } = await supabase
            .from('messenger_conversations')
            .select('tenant_id, page_id, sender_id, metadata')
            .eq('id', conversationId)
            .single();

        if (convError || !conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        await requireTenantAccess(conversation.tenant_id);

        // 2. Send the message via Facebook or Instagram
        const isInstagram = conversation.metadata?.platform === 'instagram';
        
        const result = isInstagram 
            ? await instagramService.sendInstagramMessage(
                conversation.tenant_id,
                conversation.page_id,
                conversation.sender_id,
                text
            )
            : await facebookService.sendMessengerMessage(
                conversation.tenant_id,
                conversation.page_id,
                conversation.sender_id,
                text
            );

        // 3. Record the message in our DB as a 'page' message
        const { error: msgError } = await supabase
            .from('messenger_messages')
            .insert({
                conversation_id: conversationId,
                mid: result.message_id,
                sender_id: conversation.page_id,
                recipient_id: conversation.sender_id,
                text,
                sender_type: 'page',
                created_at: new Date().toISOString(),
            });

        if (msgError) {
            console.error('Error recording sent message in DB:', msgError);
        }

        await captureUnifiedMessageFromWebhook({
            supabase: supabase as any,
            tenantId: conversation.tenant_id,
            source: isInstagram ? 'instagram' : 'facebook',
            channel: 'chat',
            direction: 'outbound',
            externalId: result.message_id || null,
            threadId: conversationId,
            from: conversation.page_id,
            to: conversation.sender_id,
            subject: null,
            text,
            html: null,
            sentAt: new Date().toISOString(),
            metadata: {
                conversationId,
            },
        });

        return NextResponse.json({ success: true, messageId: result.message_id });
    } catch (err: unknown) {
        return routeErrorResponse(err, 'Failed to send message.', req);
    }
}
