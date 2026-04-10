import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { verifyFacebookSignature } from '@/lib/webhookUtils';

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

        if (!verifyFacebookSignature(bodyText, signature, APP_SECRET)) {
            console.warn('[Facebook Messenger Webhook] Rejected: invalid HMAC signature');
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = JSON.parse(bodyText);

        if (body.object === 'page') {
            const supabaseAdmin = createSupabaseAdminClient();
            
            for (const entry of body.entry) {
                const pageId = entry.id;
                
                // Fetch integration to find tenant
                const { data: integration } = await supabaseAdmin
                    .from('tenant_integrations')
                    .select('tenant_id, user_id')
                    .eq('type', 'facebook')
                    .eq('external_id', pageId)
                    .single();

                if (!integration) continue;

                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        if (event.message) {
                            const senderId = event.sender.id;
                            
                            // Upsert/Insert message into the database
                            const { error: msgError } = await supabaseAdmin
                                .from('messenger_messages')
                                .insert({
                                    tenant_id: integration.tenant_id,
                                    message_id: event.message.mid,
                                    sender_id: senderId,
                                    recipient_id: event.recipient.id,
                                    page_id: pageId,
                                    text: event.message.text || null,
                                    timestamp: event.timestamp,
                                    received_at: new Date().toISOString()
                                });

                            if (msgError) {
                                console.error('[Messenger Webhook] DB Error:', msgError);
                            }
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
