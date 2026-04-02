import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import crypto from 'crypto';

const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'alphaclone_fb_verify';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';

/**
 * Facebook Page Webhook Verification (GET)
 * Used when connecting the webhook in the Meta App Dashboard
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    console.log(`[Facebook Page Webhook] Incoming verification request: mode=${mode}, token=${token}`);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Facebook Page Webhook] Verification successful!');
        return new Response(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
    
    console.warn(`[Facebook Page Webhook] Verification failed. Expected token: ${VERIFY_TOKEN}, Received: ${token}`);
    return new Response('Forbidden', { status: 403 });
}

/**
 * Facebook Page Webhook Events (POST)
 * Processes "Page" object events like feed, status, mention, etc.
 */
export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const signatureHeader = req.headers.get('x-hub-signature-256');

        // Optional Signature Verification
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
                console.warn('[Facebook Page Webhook] Rejected: invalid HMAC signature');
                return new NextResponse('Unauthorized', { status: 401 });
            }
        }

        const body = JSON.parse(bodyText);

        // Ensure we are processing Page-level objects
        if (body.object !== 'page') {
            return NextResponse.json({ status: 'ignored' });
        }

        const supabaseAdmin = createSupabaseAdminClient();

        for (const entry of body.entry || []) {
            const pageId = entry.id;

            // 1. Identify context (Tenant/User)
            const { data: integration } = await supabaseAdmin
                .from('facebook_integrations')
                .select('tenant_id, user_id, page_name')
                .eq('page_id', pageId)
                .eq('is_active', true)
                .single();

            if (!integration) {
                console.warn(`[Facebook Page Webhook] No active integration found for pageId: ${pageId}`);
                continue;
            }

            // 2. Process Changes (Feed, Mentions, etc.)
            for (const change of entry.changes || []) {
                const field = change.field;
                const value = change.value;

                console.log(`[Facebook Page Webhook] Received change on field "${field}" for page ${integration.page_name}`);

                // Example: Handle new posts or comments in the Feed
                if (field === 'feed') {
                    const { item, verb, comment_id, post_id, message, sender_name, sender_id } = value;

                    // Log identifying information
                    const eventData = {
                        tenant_id: integration.tenant_id,
                        page_id: pageId,
                        event_type: `feed_${item}_${verb}`,
                        source_id: item === 'post' ? post_id : comment_id,
                        parent_id: item === 'comment' ? post_id : null,
                        sender_name,
                        sender_id,
                        content: message || '',
                        raw_payload: value,
                        created_at: new Date().toISOString()
                    };

                    // Insert into a general "facebook_activity_logs" or similar
                    // Using a general 'social_activity' table if it exists, otherwise logging to console/audit
                    const { error: logErr } = await supabaseAdmin
                        .from('messenger_conversations') // Reusing table or creating a new generic activity table
                        .upsert({
                            tenant_id: integration.tenant_id,
                            page_id: pageId,
                            sender_id: sender_id || 'system',
                            last_message_preview: `Page ${item}: ${message?.substring(0, 50) || 'No text'}`,
                            last_message_at: new Date().toISOString(),
                            is_read: false
                        }, { onConflict: 'tenant_id,page_id,sender_id' });

                    if (logErr) console.error('[Facebook Page Webhook] Error recording activity:', logErr);
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (err) {
        console.error('[Facebook Page Webhook] Error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
