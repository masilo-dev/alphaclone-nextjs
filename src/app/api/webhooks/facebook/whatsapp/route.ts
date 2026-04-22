import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { ENV } from '@/config/env';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

const VERIFY_TOKEN = ENV.FACEBOOK_VERIFY_TOKEN;
const APP_SECRET = ENV.FACEBOOK_APP_SECRET;

/**
 * Facebook/WhatsApp Webhook Verification (GET)
 * 
 * Meta sends a GET request with the following query parameters:
 * - hub.mode: "subscribe"
 * - hub.verify_token: The verify token you set in the Meta App Dashboard
 * - hub.challenge: A random string that must be echoed back
 * 
 * To verify the webhook, respond with the challenge value as plain text.
 */
export async function GET(req: NextRequest) {
    try {
        if (!VERIFY_TOKEN) {
            console.error('[Facebook/WhatsApp Webhook] Verification token is not configured');
            return new NextResponse('Webhook not configured', { status: 503 });
        }

        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('hub.mode');
        const token = searchParams.get('hub.verify_token');
        const challenge = searchParams.get('hub.challenge');

        console.log('[Facebook/WhatsApp Webhook] Verification request received:', {
            mode,
            token: token ? '***' : 'missing',
            challenge: challenge ? 'present' : 'missing'
        });

        // Verify the mode and token match
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[Facebook/WhatsApp Webhook] ✓ Verification successful');
            // Respond with the challenge value
            return new NextResponse(challenge, { 
                status: 200,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
        }

        console.warn('[Facebook/WhatsApp Webhook] ✗ Verification failed:', {
            expectedToken: VERIFY_TOKEN ? '***' : 'not set',
            receivedToken: token || 'none'
        });

        return new NextResponse('Forbidden', { status: 403 });
    } catch (err) {
        console.error('[Facebook/WhatsApp Webhook] GET error:', err);
        return new NextResponse('Internal error', { status: 500 });
    }
}

/**
 * Facebook/WhatsApp Webhook Events (POST)
 * 
 * Handles incoming webhook events from Facebook/WhatsApp.
 * Verifies the signature using HMAC-SHA256 and processes the event.
 */
export async function POST(req: NextRequest) {
    try {
        if (!APP_SECRET) {
            console.error('[Facebook/WhatsApp Webhook] App secret is not configured');
            return new NextResponse('Webhook not configured', { status: 503 });
        }

        const bodyText = await req.text();
        const signatureHeader = req.headers.get('x-hub-signature-256');

        if (signatureHeader) {
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
                console.warn('[Facebook/WhatsApp Webhook] Rejected: invalid HMAC signature');
                return new NextResponse('Unauthorized', { status: 401 });
            }
        } else {
            console.warn('[Facebook/WhatsApp Webhook] Rejected: missing signature header');
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = JSON.parse(bodyText);

        console.log('[Facebook/WhatsApp Webhook] Event received:', {
            object: body.object,
            entries: body.entry?.length || 0
        });

        // Handle WhatsApp messages
        if (body.object === 'whatsapp_business_account') {
            const supabaseAdmin = createSupabaseAdminClient();

            for (const entry of body.entry || []) {
                const wabaId = String(entry.id || '').trim();
                const { data: waIntegration } = await supabaseAdmin
                    .from('whatsapp_integrations')
                    .select('tenant_id')
                    .eq('waba_id', wabaId)
                    .eq('is_active', true)
                    .maybeSingle();

                for (const change of entry.changes || []) {
                    if (change.field === 'messages') {
                        const messages = change.value?.messages || [];
                        const phoneNumberId = String(change.value?.metadata?.phone_number_id || '').trim();
                        
                        for (const message of messages) {
                            console.log('[WhatsApp] Message received:', {
                                from: message.from,
                                type: message.type,
                                id: message.id
                            });

                            // Store the message in the database
                            // You can customize this to match your database schema
                            await supabaseAdmin.from('whatsapp_messages').insert({
                                message_id: message.id,
                                from_number: message.from,
                                timestamp: message.timestamp,
                                type: message.type,
                                text: message.text?.body || null,
                                media_url: message.image?.id || message.video?.id || message.audio?.id || null,
                                status: 'received',
                                received_at: new Date().toISOString()
                            });

                            if (waIntegration?.tenant_id) {
                                await captureUnifiedMessageFromWebhook({
                                    supabase: supabaseAdmin as any,
                                    tenantId: waIntegration.tenant_id,
                                    source: 'whatsapp',
                                    channel: 'chat',
                                    direction: 'inbound',
                                    externalId: message.id || null,
                                    threadId: phoneNumberId || wabaId || null,
                                    from: String(message.from || ''),
                                    to: phoneNumberId || wabaId || 'whatsapp',
                                    subject: null,
                                    text: message.text?.body || null,
                                    html: null,
                                    receivedAt: new Date().toISOString(),
                                    metadata: {
                                        wabaId,
                                        phoneNumberId,
                                        type: message.type,
                                    },
                                });
                            }

                            // TODO: Add your business logic here
                            // - Auto-reply to messages
                            // - Create leads from WhatsApp conversations
                            // - Trigger workflows
                        }
                    }

                    // Handle message status updates
                    if (change.field === 'message_status') {
                        const statuses = change.value?.statuses || [];
                        
                        for (const status of statuses) {
                            console.log('[WhatsApp] Status update:', {
                                id: status.id,
                                status: status.status
                            });

                            // Update message status in database
                            await supabaseAdmin
                                .from('whatsapp_messages')
                                .update({ status: status.status })
                                .eq('message_id', status.id);
                        }
                    }
                }
            }
        }

        // Handle Facebook Page messages (Messenger)
        if (body.object === 'page') {
            const supabaseAdmin = createSupabaseAdminClient();

            for (const entry of body.entry || []) {
                const pageId = entry.id;

                for (const event of entry.messaging || []) {
                    if (event.message) {
                        console.log('[Messenger] Message received:', {
                            senderId: event.sender.id,
                            pageId,
                            messageId: event.message.mid
                        });

                        // Store messenger message
                        // You can customize this to match your database schema
                        await supabaseAdmin.from('messenger_messages').insert({
                            message_id: event.message.mid,
                            sender_id: event.sender.id,
                            recipient_id: event.recipient.id,
                            page_id: pageId,
                            text: event.message.text || null,
                            timestamp: event.timestamp,
                            received_at: new Date().toISOString()
                        });

                        // TODO: Add your business logic here
                    }
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (err) {
        console.error('[Facebook/WhatsApp Webhook] Error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
