import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfInboxTestDisabled } from '@/lib/security/productionGuard';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';

export async function POST(req: NextRequest) {
  const denied = denyIfInboxTestDisabled();
  if (denied) return denied;

  try {
    const body = await req.json();
    console.log('[UnifiedInboxZohoWebhook] Received payload:', JSON.stringify(body));

    const { messageId, folderId, channelId, tenantId, from, to, subject, text } = body;

    // 1. Simplified testing payload
    if (tenantId && from && text) {
      const admin = createSupabaseAdminClient();
      const { message } = await captureUnifiedMessageFromWebhook({
        supabase: admin as any,
        tenantId,
        source: 'zoho',
        channel: 'email',
        direction: 'inbound',
        externalId: body.externalId || `zoho-test-${Date.now()}`,
        threadId: body.threadId || `zoho-thread-${Date.now()}`,
        from,
        to: to || 'support@alphaclonesystems.com',
        subject: subject || 'New Zoho Conversation',
        text,
        receivedAt: new Date().toISOString()
      });
      return NextResponse.json({ success: true, messageId: message.id });
    }

    // 2. Production Zoho push notification
    if (messageId && folderId && channelId) {
      const userId = channelId.replace('user-', '');
      if (!userId) {
        return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 });
      }

      const admin = createSupabaseAdminClient();
      const { data: zohoIntegration } = await admin
        .from('integrations')
        .select('tenant_id')
        .eq('user_id', userId)
        .eq('type', 'zoho')
        .eq('enabled', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!zohoIntegration?.tenant_id) {
        return NextResponse.json({ error: 'No active Zoho integration found' }, { status: 400 });
      }

      const zohoService = new ZohoMailService(userId, zohoIntegration.tenant_id);
      await zohoService.triageIncomingEmail(messageId, folderId);
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid payload parameters' }, { status: 400 });
  } catch (err: any) {
    console.error('[UnifiedInboxZohoWebhook] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
