import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';

/**
 * Resolve tenant ID from WhatsApp webhook payload.
 * Uses phone_number_id from the webhook to look up the correct tenant's integration.
 */
async function resolveTenantFromWebhook(admin: any, value: any): Promise<string | null> {
  try {
    // Get the phone number ID from the webhook payload
    const phoneNumberId = value?.metadata?.phone_number_id;

    if (phoneNumberId) {
      // Look up integration by phone number ID in settings
      const { data: integration } = await admin
        .from('integrations')
        .select('tenant_id')
        .eq('type', 'whatsapp')
        .contains('settings', { phone_number_id: phoneNumberId })
        .maybeSingle();

      if (integration?.tenant_id) {
        return integration.tenant_id;
      }
    }

    // Fallback: try to find any active WhatsApp integration
    // This is a last resort and should be improved with proper phone number mapping
    const { data: fallbackIntegration } = await admin
      .from('integrations')
      .select('tenant_id')
      .eq('type', 'whatsapp')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (fallbackIntegration?.tenant_id) {
      console.warn('[WhatsApp Webhook] Using fallback tenant resolution - consider adding phone_number_id mapping');
      return fallbackIntegration.tenant_id;
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
 * Receives incoming message events from Meta WhatsApp Cloud API.
 * Creates support tickets from inbound messages.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[WhatsApp Webhook] Incoming payload:', JSON.stringify(body, null, 2));

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
          // Try clients table
          const { data: client } = await admin
            .from('clients')
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
            contact_id: contactId,
            client_id: clientId,
            direction: 'inbound',
            message_body: messageBody,
            message_id: messageId,
            received_at: timestamp,
            status: 'received',
          })
          .select('id')
          .single();

        // 3. Auto-create support ticket
        if (savedMessage) {
          await admin
            .from('support_tickets')
            .insert({
              tenant_id: tenantId,
              title: `WhatsApp message from ${senderName}`,
              description: messageBody,
              status: 'open',
              priority: 'medium',
              category: 'general',
              source: 'whatsapp',
              contact_id: contactId,
              client_id: clientId,
              message_id: savedMessage.id,
            });
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
          // Send auto-reply via WhatsApp Cloud API
          const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
          const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

          if (whatsappToken && phoneNumberId) {
            const autoReplyBody = `Hi ${senderName}! 👋\n\nThanks for reaching out to AlphaClone Systems. I'm Bonnie, your AI business assistant.\n\nI've noted your message and created a support ticket. Our team will follow up within 24 hours.\n\nIn the meantime, feel free to:\n• Ask about pricing (Starter $15/mo, Pro $45/mo, Enterprise $80/mo)\n• Request a demo at alphaclonesystems.com\n• Ask about features\n\nBonnie | AlphaClone Systems`;

            await fetch(
              `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${whatsappToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: fromPhone,
                  type: 'text',
                  text: { body: autoReplyBody },
                }),
              }
            );
          }
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
