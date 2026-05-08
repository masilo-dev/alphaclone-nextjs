import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { verifyFacebookSignature } from '@/lib/webhookUtils';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

const VERIFY_TOKEN = ENV.FACEBOOK_VERIFY_TOKEN;
const APP_SECRET = ENV.FACEBOOK_APP_SECRET;

/**
 * Facebook Messenger Webhook Verification (GET)
 */
export async function GET(req: NextRequest) {
    try {
        if (!VERIFY_TOKEN) {
            console.error('[Facebook Messenger Webhook] Verification token is not configured');
            return new Response('Webhook not configured', { status: 503 });
        }

        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('hub.mode');
        const token = searchParams.get('hub.verify_token');
        const challenge = searchParams.get('hub.challenge');

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            return new Response(challenge, {
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
            });
        }
        
        return new Response('Forbidden', { status: 403 });
    } catch (err) {
        console.error('[Facebook Messenger Webhook] GET error:', err);
        return new Response('Internal error', { status: 500 });
    }
}

/**
 * Facebook Messenger Webhook Events (POST)
 */
export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const signature = req.headers.get('x-hub-signature-256');

        if (!await verifyFacebookSignature(bodyText, signature, APP_SECRET)) {
            console.warn('[Facebook Messenger Webhook] Rejected: invalid HMAC signature');
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = JSON.parse(bodyText);

        if (body.object === 'page' || body.object === 'instagram') {
            const isInstagram = body.object === 'instagram';
            const supabaseAdmin = createSupabaseAdminClient();
            
            for (const entry of body.entry) {
                const pageId = entry.id;
                
                // Fetch integration to find tenant
                // For Instagram, we might need to look up by a linked page or stored IGID
                let integration: any;
                if (isInstagram) {
                    const { data } = await supabaseAdmin
                        .from('instagram_integrations')
                        .select('tenant_id, user_id, facebook_page_id')
                        .eq('instagram_account_id', pageId)
                        .eq('is_active', true)
                        .maybeSingle();
                    if (data) {
                        integration = {
                            tenant_id: data.tenant_id,
                            user_id: data.user_id,
                            page_id: data.facebook_page_id
                        };
                    }
                } else {
                    const { data } = await supabaseAdmin
                        .from('facebook_integrations')
                        .select('tenant_id, user_id, page_id')
                        .eq('page_id', pageId)
                        .eq('is_active', true)
                        .single();
                    integration = data;
                }

                if (!integration) continue;

                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        if (event.message) {
                            const senderId = event.sender.id;
                            const recipientId = event.recipient?.id;
                            const messageText = event.message.text || null;
                            if (!recipientId) continue;

                            // Ensure conversation exists for this sender/page pair.
                            const { data: conversation, error: convError } = await supabaseAdmin
                                .from('messenger_conversations')
                                .upsert(
                                    {
                                        tenant_id: integration.tenant_id,
                                        page_id: pageId,
                                        sender_id: senderId,
                                        last_message_preview: messageText,
                                        last_message_at: new Date().toISOString(),
                                        is_read: false,
                                        metadata: {
                                            source: isInstagram ? 'instagram_webhook' : 'facebook_webhook',
                                            platform: isInstagram ? 'instagram' : 'messenger',
                                        },
                                    },
                                    { onConflict: 'tenant_id,page_id,sender_id' }
                                )
                                .select('id')
                                .single();

                            if (convError || !conversation) {
                                console.error('[Messenger Webhook] Conversation upsert error:', convError);
                                continue;
                            }
                            
                            // Insert inbound message.
                            const { error: msgError } = await supabaseAdmin
                                .from('messenger_messages')
                                .insert({
                                    conversation_id: conversation.id,
                                    mid: event.message.mid,
                                    sender_id: senderId,
                                    recipient_id: recipientId,
                                    text: messageText,
                                    sender_type: 'user',
                                    created_at: new Date().toISOString(),
                                });

                            if (msgError) {
                                console.error('[Messenger Webhook] DB Error:', msgError);
                            }

                            await captureUnifiedMessageFromWebhook({
                                supabase: supabaseAdmin as any,
                                tenantId: integration.tenant_id,
                                source: 'facebook',
                                channel: 'chat',
                                direction: 'inbound',
                                externalId: event.message.mid || null,
                                threadId: conversation.id,
                                from: senderId,
                                to: recipientId,
                                subject: null,
                                text: messageText,
                                html: null,
                                receivedAt: new Date().toISOString(),
                                metadata: {
                                    pageId,
                                    platform: isInstagram ? 'instagram' : 'messenger',
                                    conversationId: conversation.id,
                                },
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (err) {
        console.error('[Facebook Messenger Webhook] POST error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
