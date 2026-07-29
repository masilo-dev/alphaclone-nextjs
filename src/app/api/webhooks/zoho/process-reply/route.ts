import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { isProduction } from '@/lib/security/productionGuard';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { Receiver } from '@upstash/qstash';
<<<<<<< HEAD
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { extractEmailAddress } from '@/lib/email/parseEmailHeader';
=======
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
>>>>>>> origin/main

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

export async function POST(req: NextRequest) {
    const signature = req.headers.get('upstash-signature');
    const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    if (isProduction() && (!signature || !signingKey)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let data: any;
    if (signature && signingKey) {
        const body = await req.text();
        const isValid = await receiver.verify({
            signature,
            body,
        }).catch(() => false);
        
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
        // Re-parse body
        data = JSON.parse(body);
    } else {
        data = await req.json();
    }

<<<<<<< HEAD
    const { userId, tenantId, messageId, folderId, replyText, senderEmail, originalSubject, logId } = data;
=======
    const { userId, messageId, folderId, replyText, senderEmail, originalSubject, logId } = data;
>>>>>>> origin/main

    if (!userId || !tenantId || !messageId || !replyText) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const zohoMail = new ZohoMailService(userId, tenantId);
    const supabase = createSupabaseAdminClient();

    try {
        const normalizedSubject = String(originalSubject || '').trim() || 'Re: Conversation';
        const normalizedReply = String(replyText || '').trim();
        if (!normalizedReply) {
            return NextResponse.json({ error: 'Reply text is empty' }, { status: 400 });
        }
<<<<<<< HEAD

        const recipientEmail = extractEmailAddress(senderEmail || '');
        if (!recipientEmail.includes('@')) {
            if (logId) {
                await supabase
                    .from('zoho_auto_responder_logs')
                    .update({
                        triage_status: 'error',
                        error_message: 'invalid_recipient_email',
                    })
                    .eq('id', logId);
            }
            console.warn('[Zoho Auto-Responder Worker] Skipping reply: invalid recipient email', {
                senderEmail,
                messageId,
                logId,
            });
            return NextResponse.json({ success: false, skipped: true, reason: 'invalid_recipient_email' });
        }
        
        // 2. Send the reply
        await zohoMail.sendEmail({
            toAddress: recipientEmail,
=======
        
        // 2. Send the reply
        await zohoMail.sendEmail({
            toAddress: senderEmail,
>>>>>>> origin/main
            subject: normalizedSubject,
            content: normalizedReply,
        });

        const admin = createSupabaseAdminClient();
        const { data: zohoIntegration } = await admin
            .from('integrations')
            .select('tenant_id')
<<<<<<< HEAD
            .eq('tenant_id', tenantId)
=======
>>>>>>> origin/main
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .eq('enabled', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (zohoIntegration?.tenant_id) {
            await captureUnifiedMessageFromWebhook({
                supabase: admin as any,
                tenantId: zohoIntegration.tenant_id,
                source: 'zoho',
                channel: 'email',
                direction: 'outbound',
                externalId: messageId || null,
                threadId: messageId || null,
                from: `zoho:${userId}`,
<<<<<<< HEAD
                to: recipientEmail,
=======
                to: senderEmail || '',
>>>>>>> origin/main
                subject: normalizedSubject,
                text: normalizedReply,
                html: null,
                sentAt: new Date().toISOString(),
                metadata: {
                    logId,
                    folderId,
                    originalMessageId: messageId,
                },
            });
        }

        // 3. Update log
        if (logId) {
            await supabase
                .from('zoho_auto_responder_logs')
                .update({ 
                    triage_status: 'replied', 
                    replied_at: new Date().toISOString() 
                })
                .eq('id', logId);
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('[Zoho Auto-Responder Worker] Failed to send reply:', err);

        if (logId) {
            await supabase
                .from('zoho_auto_responder_logs')
                .update({
                    triage_status: 'error',
                    error_message: 'Auto-reply failed',
                })
                .eq('id', logId);
        }

        return clientErrorResponse(err, { request: req, scope: 'webhooks/zoho/process-reply' });
    }
}
