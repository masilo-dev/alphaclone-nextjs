import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { ENV } from '@/config/env';
import { getZernioClient, getTenantZernioSettings } from '@/lib/zernio/client';
import {
  getActiveWhatsAppIntegration,
  getWhatsAppAccessToken,
  getWhatsAppIntegrationProvider,
  type WhatsAppProvider,
} from '@/services/whatsapp/whatsappIntegrationService';

const META_GRAPH_VERSION = 'v18.0';

function cleanPhone(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

async function resolveProvider(
  tenantId: string
): Promise<{ provider: WhatsAppProvider; integrationId: string | null; phoneNumberId: string | null; accessToken: string | null }> {
  const supabase = createSupabaseAdminClient();
  const active = await getActiveWhatsAppIntegration(supabase, tenantId);
  const provider = getWhatsAppIntegrationProvider(active);

  if (provider === 'zernio') {
    return {
      provider,
      integrationId: active?.id || null,
      phoneNumberId: null,
      accessToken: null,
    };
  }

  const token = active ? await getWhatsAppAccessToken(supabase, active) : null;
  return {
    provider,
    integrationId: active?.id || null,
    phoneNumberId: active?.phone_number_id || ENV.WHATSAPP_PHONE_NUMBER_ID || null,
    accessToken: token || ENV.WHATSAPP_ACCESS_TOKEN || null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      phone,
      messageType,
      message,
      documentUrl,
      documentName,
      referenceType,
      referenceId,
    } = body;

    if (!tenantId || !phone || !message) {
      return NextResponse.json({ error: 'tenantId, phone, and message are required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();
    const cleanTo = cleanPhone(phone);
    const providerState = await resolveProvider(tenantId);
    const type = messageType || 'text';

    if (providerState.provider === 'zernio') {
      const tenantSettings = await getTenantZernioSettings(tenantId);
      const accountId = tenantSettings?.whatsappAccountId?.trim() || null;
      if (!accountId) {
        return NextResponse.json(
          { error: 'Zernio WhatsApp is not configured. Add a WhatsApp account ID in tenant Zernio settings.' },
          { status: 503 }
        );
      }

      const zernio = getZernioClient();
      const conversationLookup = await zernio.messages.listInboxConversations({
        query: {
          accountId,
          limit: 100,
          sortOrder: 'desc',
        },
      });
      const conversationId =
        (conversationLookup.data || []).find((item: { participantId?: string; id?: string }) => String(item.participantId || '').replace(/[^0-9]/g, '') === cleanTo)?.id || null;

      if (conversationId) {
        const response =
          type === 'document' && documentUrl
            ? await zernio.messages.sendInboxMessage({
                path: { conversationId },
                body: {
                  accountId,
                  attachmentUrl: documentUrl,
                  attachmentType: 'file',
                  message,
                },
              })
            : type === 'image' && documentUrl
              ? await zernio.messages.sendInboxMessage({
                  path: { conversationId },
                  body: {
                    accountId,
                    attachmentUrl: documentUrl,
                    attachmentType: 'image',
                    message,
                  },
                })
              : await zernio.messages.sendInboxMessage({
                  path: { conversationId },
                  body: {
                    accountId,
                    message: documentUrl ? `${message}\n\n${documentUrl}` : message,
                  },
                });

        const messageId = response.data?.messageId || `wa_doc_${Date.now()}`;
        await supabase.from('whatsapp_messages').insert({
          tenant_id: tenantId,
          integration_id: providerState.integrationId,
          provider: 'zernio-whatsapp',
          provider_message_id: messageId,
          chat_id: cleanTo,
          phone_number: cleanTo,
          direction: 'outbound',
          message_type: type,
          body: message,
          status: 'sent',
          sent_by: 'human',
          needs_response: false,
          sent_at: new Date().toISOString(),
          metadata: {
            provider: 'zernio-whatsapp',
            reference_type: referenceType || 'custom',
            reference_id: referenceId || null,
            document_url: documentUrl || null,
            document_name: documentName || null,
            zernio_account_id: accountId,
            zernio_conversation_id: conversationId,
          },
        });

        return NextResponse.json({
          success: true,
          provider: 'zernio-whatsapp',
          messageId,
          to: cleanTo,
          type,
        });
      }

      const response = await zernio.messages.createInboxConversation({
        body: {
          accountId,
          participantId: cleanTo,
          message: message,
        },
      });

      const messageId = response.data?.messageId || `wa_doc_${Date.now()}`;
      await supabase.from('whatsapp_messages').insert({
        tenant_id: tenantId,
        integration_id: providerState.integrationId,
        provider: 'zernio-whatsapp',
        provider_message_id: messageId,
        chat_id: cleanTo,
        phone_number: cleanTo,
        direction: 'outbound',
        message_type: type,
        body: message,
        status: 'sent',
        sent_by: 'human',
        needs_response: false,
        sent_at: new Date().toISOString(),
        metadata: {
          provider: 'zernio-whatsapp',
          reference_type: referenceType || 'custom',
          reference_id: referenceId || null,
          document_url: documentUrl || null,
          document_name: documentName || null,
          zernio_account_id: accountId,
          zernio_conversation_id: response.data?.conversationId || null,
        },
      });

      return NextResponse.json({
        success: true,
        provider: 'zernio-whatsapp',
        messageId,
        to: cleanTo,
        type,
      });
    }

    if (!providerState.phoneNumberId || !providerState.accessToken) {
      return NextResponse.json(
        { error: 'No active WhatsApp integration found. Please connect Meta WhatsApp in Integration Settings.' },
        { status: 404 }
      );
    }

    let metaPayload: Record<string, any>;
    const basePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
    };

    if (type === 'document' && documentUrl) {
      metaPayload = {
        ...basePayload,
        type: 'document',
        document: {
          link: documentUrl,
          caption: message,
          filename: documentName || 'Document.pdf',
        },
      };
    } else if (type === 'image' && documentUrl) {
      metaPayload = {
        ...basePayload,
        type: 'image',
        image: {
          link: documentUrl,
          caption: message,
        },
      };
    } else {
      metaPayload = {
        ...basePayload,
        type: 'text',
        text: {
          preview_url: !!documentUrl,
          body: documentUrl ? `${message}\n\n${documentUrl}` : message,
        },
      };
    }

    const metaRes = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${providerState.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${providerState.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const metaData = await metaRes.json();
    if (!metaRes.ok) {
      console.error('[WhatsApp send-document] Meta error:', metaData);
      return NextResponse.json(
        { error: metaData?.error?.message || 'Failed to send WhatsApp message' },
        { status: 502 }
      );
    }

    const metaMessageId = metaData.messages?.[0]?.id;

    await supabase.from('whatsapp_messages').insert({
      tenant_id: tenantId,
      integration_id: providerState.integrationId,
      provider: 'meta-whatsapp',
      provider_message_id: metaMessageId || `wa_doc_${Date.now()}`,
      chat_id: cleanTo,
      phone_number: cleanTo,
      direction: 'outbound',
      message_type: type,
      body: message,
      status: 'sent',
      sent_by: 'human',
      needs_response: false,
      sent_at: new Date().toISOString(),
      metadata: {
        provider: 'meta-whatsapp',
        reference_type: referenceType || 'custom',
        reference_id: referenceId || null,
        document_url: documentUrl || null,
        document_name: documentName || null,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: metaMessageId,
      to: cleanTo,
      type,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send WhatsApp document', request);
  }
}
