import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { Receiver } from '@upstash/qstash';

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

export async function POST(req: NextRequest) {
    // 1. Verify QStash signature (Optional but recommended for security)
    const signature = req.headers.get('upstash-signature');
    let data: any;
    if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
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

    const { userId, messageId, folderId, replyText, senderEmail, logId } = data;

    if (!userId || !messageId || !replyText) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const zohoMail = new ZohoMailService(userId);
    const supabase = await createSupabaseServerClient();

    try {
        // Fetch message content to get subject etc. correctly if needed, 
        // but we usually have it from the previous step.
        const msgContent = await zohoMail.getMessageContent(messageId, folderId);
        
        // 2. Send the reply
        await zohoMail.sendEmail({
            toAddress: senderEmail,
            subject: `Re: ${msgContent.content ? 'Inquiry' : 'Message'}`, // Ideally pass subject in data
            content: replyText,
        });

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
