import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[UnifiedInboxInstagramWebhook] Received payload:', JSON.stringify(body));

    const { tenantId, from, to, text, externalId, threadId } = body;

    // Support both simplified testing payload and structured webhook entries
    if (tenantId && from && text) {
      const admin = createSupabaseAdminClient();
      const { message } = await captureUnifiedMessageFromWebhook({
        supabase: admin as any,
        tenantId,
        source: 'instagram',
        channel: 'chat',
        direction: 'inbound',
        externalId: externalId || `instagram-test-${Date.now()}`,
        threadId: threadId || `instagram-thread-${Date.now()}`,
        from,
        to: to || 'instagram-business',
        subject: null,
        text,
        receivedAt: new Date().toISOString()
      });
      return NextResponse.json({ success: true, messageId: message.id });
    }

    // Standard Instagram Direct format (simplified for demo/production)
    if (body.object === 'instagram' && Array.isArray(body.entry)) {
      const admin = createSupabaseAdminClient();
      for (const entry of body.entry) {
        if (Array.isArray(entry.messaging)) {
          for (const msg of entry.messaging) {
            const senderId = msg.sender?.id;
            const recipientId = msg.recipient?.id;
            const textContent = msg.message?.text;
            if (senderId && textContent) {
              // Find matching Instagram integration to determine tenantId
              const { data: integration } = await admin
                .from('integrations')
                .select('tenant_id')
                .eq('type', 'instagram')
                .eq('enabled', true)
                .limit(1)
                .maybeSingle();

              if (integration?.tenant_id) {
                await captureUnifiedMessageFromWebhook({
                  supabase: admin as any,
                  tenantId: integration.tenant_id,
                  source: 'instagram',
                  channel: 'chat',
                  direction: 'inbound',
                  externalId: msg.message.mid || `ig-msg-${Date.now()}`,
                  threadId: msg.thread_id || senderId,
                  from: senderId,
                  to: recipientId || 'ig-business-id',
                  text: textContent,
                  receivedAt: new Date().toISOString()
                });
              }
            }
          }
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid payload parameters' }, { status: 400 });
  } catch (err: any) {
    console.error('[UnifiedInboxInstagramWebhook] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
