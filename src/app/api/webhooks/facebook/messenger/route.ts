import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import crypto from 'crypto';

const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'alphaclone_fb_verify';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';

// Facebook webhook verification (GET)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('hub.mode');
        const token = searchParams.get('hub.verify_token');
        const challenge = searchParams.get('hub.challenge');

        console.log(`[Facebook Messenger Webhook] Incoming verification request: mode=${mode}, token=${token}`);

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[Facebook Messenger Webhook] Verification successful!');
            return new Response(challenge, {
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
            });
        }
        
        console.warn(`[Facebook Messenger Webhook] Verification failed. Expected token: ${VERIFY_TOKEN}, Received: ${token}`);
        return new Response('Forbidden', { status: 403 });
    } catch (err) {
        console.error('[Facebook Messenger Webhook] GET error:', err);
        return new Response('Internal error', { status: 500 });
    }
}

// Messenger webhook events (POST)
export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const signatureHeader = req.headers.get('x-hub-signature-256');

        if (APP_SECRET && signatureHeader) {
            const signature = signatureHeader.replace('sha256=', '');
            const expectedSignature = crypto
                .createHmac('sha256', APP_SECRET)
                .update(bodyText)
                .digest('hex');

            let isValid = false;
            try {
                isValid = crypto.timingSafeEqual(
                    Buffer.from(signature.padEnd(64, '0'), 'hex'),
                    Buffer.from(expectedSignature, 'hex')
                );
            } catch {
                isValid = false;
            }

            if (!isValid) {
                console.warn('[Facebook Messenger Webhook] Rejected: invalid HMAC signature');
                return new NextResponse('Unauthorized', { status: 401 });
            }
        } else if (APP_SECRET && !signatureHeader) {
            console.warn('[Facebook Messenger Webhook] Rejected: missing signature header');
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = JSON.parse(bodyText);

        if (body.object !== 'page') {
            return NextResponse.json({ status: 'ignored' });
        }

        const supabaseAdmin = createSupabaseAdminClient();

        for (const entry of body.entry || []) {
            const pageId = entry.id;
            
            // Find the integration to get the tenant_id
            const { data: integration } = await supabaseAdmin
                .from('facebook_integrations')
                .select('tenant_id, user_id')
                .eq('page_id', pageId)
                .eq('is_active', true)
                .single();

            if (!integration) continue;

            for (const messagingItem of entry.messaging || []) {
                const senderId = messagingItem.sender?.id;
                const recipientId = messagingItem.recipient?.id;
                const message = messagingItem.message;

                if (!senderId || !recipientId) continue;

                // 1. Upsert Conversation
                const { data: conversation, error: convError } = await supabaseAdmin
                    .from('messenger_conversations')
                    .upsert({
                        tenant_id: integration.tenant_id,
                        page_id: pageId,
                        sender_id: senderId,
                        last_message_at: new Date().toISOString(),
                        last_message_preview: message?.text?.substring(0, 100) || 'Attachment',
                        is_read: false,
                    }, { onConflict: 'tenant_id,page_id,sender_id' })
                    .select()
                    .single();

                if (convError || !conversation) {
                    console.error('Error upserting messenger conversation:', convError);
                    continue;
                }

                // 2. Insert Message
                if (message) {
                    const { error: msgError } = await supabaseAdmin
                        .from('messenger_messages')
                        .insert({
                            conversation_id: conversation.id,
                            mid: message.mid,
                            sender_id: senderId,
                            recipient_id: recipientId,
                            text: message.text,
                            attachments: message.attachments || [],
                            sender_type: senderId === pageId ? 'page' : 'user',
                            created_at: new Date(messagingItem.timestamp).toISOString(),
                        });

                    if (msgError) {
                        console.error('Error inserting messenger message:', msgError);
                    }
                }
                
                // TODO: Phase 4 - Auto-Responder Logic
                // if (senderId !== pageId) {
                //     await triggerAiAutoResponse(conversation, message);
                // }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (err) {
        console.error('Messenger webhook error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
