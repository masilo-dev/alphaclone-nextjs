import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveTenantByZernioAccountId } from '@/lib/zernio/resolveTenant';
import { persistInboundWhatsAppMessage } from '@/lib/whatsapp/webhookProcessing';

function cleanPhone(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function firstText(message: Record<string, any>): string {
  return (
    message?.text ||
    message?.body ||
    message?.content ||
    message?.message ||
    message?.caption ||
    ''
  );
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Authenticate Zernio webhooks.
 * Accepts Authorization: Bearer <secret> or x-zernio-webhook-secret.
 * In production the secret is required.
 */
function assertZernioWebhookAuthorized(req: NextRequest): NextResponse | null {
  const secret = (process.env.ZERNIO_WEBHOOK_SECRET || process.env.ZERNIO_API_KEY || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProd) {
      return NextResponse.json(
        { success: false, error: 'Zernio webhook secret not configured' },
        { status: 503 }
      );
    }
    return null;
  }

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = (req.headers.get('x-zernio-webhook-secret') || '').trim();
  const provided = bearer || headerSecret;
  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/** Never trust client-supplied tenantId — resolve only from Zernio account mapping. */
async function resolveTrustedTenant(accountId: string): Promise<string | null> {
  const id = String(accountId || '').trim();
  if (!id) return null;
  return resolveTenantByZernioAccountId(id);
}

export async function POST(request: NextRequest) {
  const denied = assertZernioWebhookAuthorized(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const event = String(body?.event || '').trim();
    const supabase = createSupabaseAdminClient();

    if (['message.sent', 'message.delivered', 'message.read', 'message.failed'].includes(event)) {
      const message = body?.message || {};
      const account = body?.account || {};
      const platformMessageId = String(message?.platformMessageId || message?.id || '').trim();
      const accountId = String(account?.id || '').trim();
      const tenantId = await resolveTrustedTenant(accountId);

      if (platformMessageId && tenantId) {
        await supabase
          .from('whatsapp_messages')
          .update({ status: event.split('.')[1] })
          .eq('provider_message_id', platformMessageId)
          .eq('tenant_id', tenantId);
      }
      return NextResponse.json({ success: true });
    }

    if (event === 'message.received') {
      const message = body?.message || {};
      const account = body?.account || {};
      const accountId = String(account?.id || '').trim();
      const tenantId = await resolveTrustedTenant(accountId);

      if (!tenantId) {
        return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 400 });
      }

      const { data: integration } = await supabase
        .from('whatsapp_integrations')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('waba_id', accountId)
        .maybeSingle();

      const senderPhone = cleanPhone(message?.sender?.phoneNumber || message?.sender?.id || '');
      const conversationId = String(message?.conversationId || '').trim();
      const platformMessageId = String(
        message?.platformMessageId || message?.id || `zernio-${createHash('sha256').update(`${accountId}-${Date.now()}`).digest('hex').slice(0, 16)}`
      );
      const text = firstText(message) || `[WhatsApp ${message?.attachments?.[0]?.type || 'message'}]`;

      if (integration?.id) {
        await persistInboundWhatsAppMessage({
          supabase: supabase as any,
          tenantId,
          integrationId: integration.id,
          provider: 'zernio',
          providerMessageId: platformMessageId,
          chatId: conversationId || senderPhone || platformMessageId,
          from: senderPhone || String(message?.sender?.id || ''),
          to: accountId,
          messageType: message?.attachments?.[0]?.type || (text ? 'text' : 'message'),
          body: text,
          rawPayload: body,
          media: message?.attachments?.length
            ? {
                attachments: message.attachments,
              }
            : null,
          metadata: {
            zernio_account_id: accountId,
            zernio_conversation_id: conversationId || null,
            zernio_message_id: String(message?.id || ''),
            platform: message?.platform || 'whatsapp',
          },
          receivedAt: body?.timestamp || new Date().toISOString(),
        });
      }

      return NextResponse.json({ success: true });
    }

    if (event === 'conversation.started') {
      const conversation = body?.conversation || {};
      const account = body?.account || {};
      const accountId = String(account?.id || '').trim();
      const tenantId = await resolveTrustedTenant(accountId);

      if (!tenantId) {
        return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 400 });
      }

      const { data: integration } = await supabase
        .from('whatsapp_integrations')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('waba_id', accountId)
        .maybeSingle();

      if (integration?.id) {
        await persistInboundWhatsAppMessage({
          supabase: supabase as any,
          tenantId,
          integrationId: integration.id,
          provider: 'zernio',
          providerMessageId: String(body?.id || `conversation-started-${Date.now()}`),
          chatId: String(conversation?.id || conversation?.platformConversationId || body?.id || ''),
          from: String(
            conversation?.participantId ||
              conversation?.participantUsername ||
              conversation?.participantName ||
              ''
          ),
          to: accountId,
          messageType: 'event',
          body: '[Conversation started]',
          rawPayload: body,
          metadata: {
            zernio_account_id: accountId,
            zernio_conversation_id: String(conversation?.id || ''),
            zernio_event: 'conversation.started',
          },
          receivedAt: body?.timestamp || new Date().toISOString(),
          autoReply: false,
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported Zernio webhook event' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Zernio WhatsApp Webhook] Error:', error?.message || 'Internal error');
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
