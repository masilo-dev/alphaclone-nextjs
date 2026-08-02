import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import { ENV } from '@/config/env';
import { recordInboundOutreachReply } from '@/lib/outreach/recordInboundOutreachReply';

const CANONICAL_WEBHOOK = '/api/webhooks/facebook/whatsapp';

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = ENV.FACEBOOK_APP_SECRET;
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const received = signatureHeader.slice('sha256='.length);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Resolve tenant ID from WhatsApp webhook payload.
 * Uses phone_number_id from the webhook to look up the correct tenant's integration.
 */
async function resolveTenantFromWebhook(admin: ReturnType<typeof createAdminSupabaseClientOrThrow>, value: Record<string, unknown>): Promise<string | null> {
  try {
    const phoneNumberId = String(value?.metadata && typeof value.metadata === 'object'
      ? (value.metadata as Record<string, unknown>).phone_number_id
      : '').trim();

    if (phoneNumberId) {
      const { data: integration } = await admin
        .from('whatsapp_integrations')
        .select('tenant_id')
        .eq('phone_number_id', phoneNumberId)
        .eq('is_active', true)
        .maybeSingle();

      if (integration?.tenant_id) {
        return integration.tenant_id;
      }
    }

    return null;
  } catch (err) {
    console.error('[WhatsApp Webhook] Error resolving tenant:', err);
    return null;
  }
}

/**
 * GET /api/webhooks/whatsapp
 * Meta webhook verification handshake.
 * Meta sends hub.mode, hub.verify_token, hub.challenge as query params.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('[WhatsApp Webhook] Verification failed — token mismatch or wrong mode');
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * @deprecated Use /api/webhooks/facebook/whatsapp — this handler remains for backward-compatible Meta URLs.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
      console.warn(`[WhatsApp Webhook] Invalid signature — configure Meta to use ${CANONICAL_WEBHOOK}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const body = JSON.parse(rawBody);
    console.log('[WhatsApp Webhook] Incoming event received (legacy path)');

    const admin = createAdminSupabaseClientOrThrow();

    // Parse WhatsApp Cloud API payload
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages || [];
    const contacts = value?.contacts || [];

    // Resolve tenant ID from webhook metadata
    const tenantId = await resolveTenantFromWebhook(admin, value);
    if (!tenantId) {
      console.error('[WhatsApp Webhook] Could not resolve tenant ID from webhook payload');
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 400 });
    }

    console.log('[WhatsApp Webhook] Resolved tenant:', tenantId);

    for (const msg of messages) {
      if (msg.type === 'text' || msg.type === 'interactive') {
        const fromPhone = msg.from; // sender phone number
        const messageBody = msg.text?.body || msg.interactive?.button_reply?.title || '';
        const messageId = msg.id;
        const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString();

        // Find contact name from contacts array
        const senderContact = contacts.find((c: any) => c.wa_id === fromPhone);
        const senderName = senderContact?.profile?.name || fromPhone;

        // 1. Try to match phone to existing contact/client
        let contactId: string | null = null;
        let clientId: string | null = null;

        const { data: contact } = await admin
          .from('contacts')
          .select('id, name, client_id')
          .eq('phone', fromPhone)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (contact) {
          contactId = contact.id;
          clientId = contact.client_id;
        } else {
          // Reuse the canonical CRM client; never create or query a parallel client table.
          const { data: client } = await admin
            .from('business_clients')
            .select('id, name')
            .eq('phone', fromPhone)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (client) {
            clientId = client.id;
          } else {
            // Auto-create contact
            const { data: newContact } = await admin
              .from('contacts')
              .insert({
                tenant_id: tenantId,
                name: senderName,
                phone: fromPhone,
                status: 'lead',
                source: 'whatsapp',
              })
              .select('id')
              .single();

            if (newContact) {
              contactId = newContact.id;
            }
          }
        }

        // 2. Save message to whatsapp_messages
        const { data: savedMessage } = await admin
          .from('whatsapp_messages')
          .insert({
            tenant_id: tenantId,
            phone_number: fromPhone,
            chat_id: fromPhone,
            contact_id: contactId,
            client_id: clientId,
            direction: 'inbound',
            body: messageBody,
            message_type: 'text',
            provider_message_id: messageId,
            provider: 'meta-whatsapp',
            received_at: timestamp,
            status: 'received',
          })
          .select('id')
          .single();

        await recordInboundOutreachReply({ admin, tenantId, channel: 'whatsapp', sender: fromPhone, text: messageBody, provider: 'meta-whatsapp', providerEventId: messageId || null })
          .catch((replyError) => console.error('[whatsapp-inbound] outreach reply capture failed', replyError));

        // 3. Reuse the canonical open ticket for this client/channel or create it once.
        if (savedMessage) {
          let existingTicketQuery = admin
            .from('tickets')
            .select('id,status')
            .eq('tenant_id', tenantId)
            .eq('channel', 'whatsapp')
            .in('status', ['new', 'open', 'in_progress', 'waiting_on_customer', 'waiting_on_business', 'escalated', 'reopened', 'resolved', 'closed']);
          if (contactId) {
            existingTicketQuery = existingTicketQuery.eq('contact_id', contactId);
          } else if (clientId) {
            existingTicketQuery = existingTicketQuery.eq('client_id', clientId);
          } else {
            existingTicketQuery = existingTicketQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
          const { data: existingTicket } = await existingTicketQuery
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let ticketId = existingTicket?.id as string | undefined;
          if (!ticketId) {
            const { data: creator } = await admin
              .from('tenant_users')
              .select('user_id')
              .eq('tenant_id', tenantId)
              .order('created_at')
              .limit(1)
              .maybeSingle();
            if (!creator?.user_id) throw new Error('Support workspace has no active member');

            const { data: createdTicket, error: ticketError } = await admin
              .from('tickets')
              .insert({
              tenant_id: tenantId,
              title: `WhatsApp message from ${senderName}`,
              description: messageBody,
              status: 'open',
              priority: 'medium',
              source: 'whatsapp',
              channel: 'whatsapp',
              ticket_type: 'question',
              contact_id: contactId,
              client_id: clientId,
              created_by: creator.user_id,
              metadata: { whatsapp_message_id: savedMessage.id },
            })
              .select('id')
              .single();
            if (ticketError) throw ticketError;
            ticketId = createdTicket.id;
          } else if (
            existingTicket &&
            ['waiting_on_customer', 'resolved', 'closed'].includes(existingTicket.status)
          ) {
            await admin.from('tickets').update({
              status: 'open',
              waiting_on: 'business',
              updated_at: new Date().toISOString(),
            }).eq('tenant_id', tenantId).eq('id', ticketId);
          }

          const { error: messageError } = await admin.from('ticket_messages').insert({
            tenant_id: tenantId,
            ticket_id: ticketId,
            contact_id: contactId,
            message_type: 'customer_message',
            body_text: messageBody,
            visibility: 'external',
            created_at: timestamp,
            metadata: {
              whatsapp_message_id: savedMessage.id,
              provider_message_id: messageId,
            },
          });
          if (messageError) throw messageError;
        }

        // 4. Trigger auto-reply if chatbot enabled
        const { data: integration } = await admin
          .from('integrations')
          .select('settings')
          .eq('tenant_id', tenantId)
          .eq('type', 'whatsapp')
          .maybeSingle();

        const autoReplyEnabled = integration?.settings?.auto_reply_enabled !== false;

        if (autoReplyEnabled) {
          const { sendWhatsAppMessage } = await import('@/lib/whatsapp/sendWhatsApp');
          const autoReplyBody = `Hi ${senderName}! Thanks for reaching out. We've received your message and will follow up shortly.`;
          await sendWhatsAppMessage({
            tenantId,
            phone: fromPhone,
            message: autoReplyBody,
            contactId,
            clientId,
            metadata: { source: 'webhook_auto_reply' },
          });
        }

        // 5. Create in-app notification for Alpha
        await admin
          .from('notifications')
          .insert({
            tenant_id: tenantId,
            title: `New WhatsApp message from ${senderName}`,
            body: messageBody.substring(0, 200),
            type: 'whatsapp_inbound',
            metadata: {
              contact_id: contactId,
              message_id: savedMessage?.id,
              phone: fromPhone,
            },
            created_at: new Date().toISOString(),
          });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('[WhatsApp Webhook] Failed to process:', err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
