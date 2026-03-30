import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { facebookService } from '@/services/facebookService';

export async function POST(req: NextRequest) {
    try {
        const { conversationId, text } = await req.json();

        if (!conversationId || !text) {
            return NextResponse.json({ error: 'Conversation ID and text are required' }, { status: 400 });
        }

        const supabase = createSupabaseAdminClient();

        // 1. Get conversation details (to get page_id, sender_id, tenant_id)
        const { data: conversation, error: convError } = await supabase
            .from('messenger_conversations')
            .select('tenant_id, page_id, sender_id')
            .eq('id', conversationId)
            .single();

        if (convError || !conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // 2. Send the message via Facebook
        const result = await facebookService.sendMessengerMessage(
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

        return NextResponse.json({ success: true, messageId: result.message_id });
    } catch (err: any) {
        console.error('Send Messenger message error:', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
