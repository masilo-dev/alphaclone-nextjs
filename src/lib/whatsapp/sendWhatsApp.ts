import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { sanitizeBonnieOutboundText } from '@/lib/bonnie/bonnieBannedLanguage';
import { getZernioClient, getTenantZernioSettings } from '@/lib/zernio/client';
import {
  getActiveWhatsAppIntegration,
  getWhatsAppIntegration,
  getWhatsAppIntegrationProvider,
  getWhatsAppIntegrationWithToken,
  type WhatsAppProvider,
} from '@/services/whatsapp/whatsappIntegrationService';

export type SendWhatsAppErrorCode =
  | 'NOT_CONFIGURED'
  | 'VALIDATION_ERROR'
  | 'META_API_ERROR'
  | 'ZERNIO_API_ERROR'
  | 'NETWORK_ERROR';

export interface SendWhatsAppResult {
  success: boolean;
  provider: 'meta-whatsapp' | 'zernio-whatsapp';
  messageId?: string;
  to?: string;
  error?: string;
  code?: SendWhatsAppErrorCode;
}

export interface SendWhatsAppTemplateResult extends SendWhatsAppResult {
  conversationId?: string;
}

function cleanPhone(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function providerCode(provider: WhatsAppProvider): 'meta-whatsapp' | 'zernio-whatsapp' {
  return provider === 'zernio' ? 'zernio-whatsapp' : 'meta-whatsapp';
}

function sentByFromMetadata(metadata?: Record<string, unknown>): 'bot' | 'api' | 'human' {
  if (metadata?.source === 'auto_outreach') return 'bot';
  if (metadata?.source === 'mcp') return 'api';
  return 'human';
}

async function resolveWhatsAppProvider(params: {
  tenantId: string;
  integrationId?: string;
}): Promise<{
  provider: WhatsAppProvider;
  providerCode: 'meta-whatsapp' | 'zernio-whatsapp';
  integration: Awaited<ReturnType<typeof getWhatsAppIntegration>> | null;
  token?: string | null;
}> {
  const supabase = createSupabaseAdminClient();
  const integration = params.integrationId
    ? await getWhatsAppIntegration(supabase, {
        tenantId: params.tenantId,
        integrationId: params.integrationId,
      })
    : await getActiveWhatsAppIntegration(supabase, params.tenantId);

  const provider = getWhatsAppIntegrationProvider(integration);
  const code = providerCode(provider);

  if (provider === 'meta') {
    const tokenRow = integration
      ? await getWhatsAppIntegrationWithToken(supabase, {
          tenantId: params.tenantId,
          integrationId: integration.id,
        })
      : await getWhatsAppIntegrationWithToken(supabase, { tenantId: params.tenantId });
    return { provider, providerCode: code, integration, token: tokenRow?.accessToken || null };
  }

  return { provider, providerCode: code, integration };
}

async function persistOutboundMessage(params: {
  tenantId: string;
  integrationId: string | null;
  providerCode: 'meta-whatsapp' | 'zernio-whatsapp';
  to: string;
  messageId: string;
  messageType: string;
  body: string;
  contactId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: contact } = params.contactId
    ? { data: { id: params.contactId } }
    : await supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', params.tenantId)
        .or(`phone.ilike.%${params.to}%,mobile.ilike.%${params.to}%`)
        .maybeSingle();

  await supabase.from('whatsapp_messages').insert({
    tenant_id: params.tenantId,
    integration_id: params.integrationId,
    provider: params.providerCode,
    provider_message_id: params.messageId,
    chat_id: params.to,
    phone_number: params.to,
    direction: 'outbound',
    message_type: params.messageType,
    body: params.body,
    contact_id: contact?.id || null,
    client_id: params.clientId || null,
    status: 'sent',
    sent_by: sentByFromMetadata(params.metadata),
    needs_response: false,
    sent_at: new Date().toISOString(),
    metadata: { ...(params.metadata || {}), provider: params.providerCode },
  });

  await supabase.from('whatsapp_outreach_logs').insert({
    tenant_id: params.tenantId,
    lead_id: params.clientId || params.contactId || null,
    phone_number: params.to,
    status: 'sent',
    message_content: params.body,
    sent_at: new Date().toISOString(),
  });
}

async function sendViaMeta(params: {
  tenantId: string;
  phone: string;
  message: string;
  integrationId?: string;
  contactId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<SendWhatsAppResult> {
  const supabase = createSupabaseAdminClient();
  const cleanTo = cleanPhone(params.phone);
  const allowTenantEmoji = params.metadata?.allowEmoji === true;
  const skipQuality = params.metadata?.skipBonnieQualityCheck === true;
  const outboundMessage = skipQuality
    ? params.message
    : sanitizeBonnieOutboundText(params.message, { allowEmoji: allowTenantEmoji }).clean;

  const phoneNumberId = ENV.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = ENV.WHATSAPP_ACCESS_TOKEN;
  let activeIntegrationId: string | null = params.integrationId || null;

  const waIntegration = params.integrationId
    ? await getWhatsAppIntegrationWithToken(supabase, {
        tenantId: params.tenantId,
        integrationId: params.integrationId,
      })
    : await getWhatsAppIntegrationWithToken(supabase, { tenantId: params.tenantId });

  if (waIntegration) {
    activeIntegrationId = waIntegration.id;
  }

  const resolvedPhoneNumberId = waIntegration?.phone_number_id || phoneNumberId;
  const resolvedAccessToken = waIntegration?.accessToken || accessToken;

  if (!resolvedPhoneNumberId || !resolvedAccessToken) {
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'NOT_CONFIGURED',
      error:
        'WhatsApp integration is not configured. Add Phone Number ID and Access Token under Integration Settings, or set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in Vercel.',
    };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${resolvedPhoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolvedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: {
          preview_url: false,
          body: outboundMessage,
        },
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const metaCode = result.error?.code;
      const metaMessage = result.error?.message || 'Failed to send WhatsApp message via Meta Cloud API';
      return {
        success: false,
        provider: 'meta-whatsapp',
        code: 'META_API_ERROR',
        error:
          metaCode === 190
            ? 'WhatsApp access token expired or invalid. Reconnect Meta Cloud API credentials under Integration Settings → WhatsApp.'
            : metaMessage,
      };
    }

    const messageId = result.messages?.[0]?.id || `wa_out_${Date.now()}`;
    await persistOutboundMessage({
      tenantId: params.tenantId,
      integrationId: activeIntegrationId,
      providerCode: 'meta-whatsapp',
      to: cleanTo,
      messageId,
      messageType: 'text',
      body: outboundMessage,
      contactId: params.contactId || null,
      clientId: params.clientId || null,
      metadata: params.metadata,
    });

    return { success: true, provider: 'meta-whatsapp', messageId, to: cleanTo };
  } catch (err: any) {
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'NETWORK_ERROR',
      error: err?.message || 'Meta WhatsApp send failed',
    };
  }
}

async function findZernioConversationId(params: {
  accountId: string;
  phone: string;
}): Promise<string | null> {
  const zernio = getZernioClient();
  const { data } = await zernio.messages.listInboxConversations({
    query: {
      accountId: params.accountId,
      limit: 100,
      sortOrder: 'desc',
    },
  });

  const match = (data || []).find((conversation) => {
    const participantId = String(conversation.participantId || '').replace(/[^0-9]/g, '');
    return participantId === params.phone;
  });

  return match?.id || null;
}

async function sendViaZernioText(params: {
  tenantId: string;
  phone: string;
  message: string;
  integrationId?: string;
  contactId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<SendWhatsAppResult> {
  const cleanTo = cleanPhone(params.phone);
  const allowTenantEmoji = params.metadata?.allowEmoji === true;
  const skipQuality = params.metadata?.skipBonnieQualityCheck === true;
  const outboundMessage = skipQuality
    ? params.message
    : sanitizeBonnieOutboundText(params.message, { allowEmoji: allowTenantEmoji }).clean;

  const tenantSettings = await getTenantZernioSettings(params.tenantId);
  const providerAccountId =
    tenantSettings?.whatsappAccountId ||
    (params.integrationId
      ? (await getWhatsAppIntegration(createSupabaseAdminClient(), {
          tenantId: params.tenantId,
          integrationId: params.integrationId,
        }))?.waba_id
      : null);

  if (!providerAccountId) {
    return {
      success: false,
      provider: 'zernio-whatsapp',
      code: 'NOT_CONFIGURED',
      error:
        'Zernio WhatsApp is not configured. Add your WhatsApp account ID to the tenant Zernio settings first.',
    };
  }

  const zernio = getZernioClient();
  const supabase = createSupabaseAdminClient();
  const integration = params.integrationId
    ? await getWhatsAppIntegration(supabase, {
        tenantId: params.tenantId,
        integrationId: params.integrationId,
      })
    : await getActiveWhatsAppIntegration(supabase, params.tenantId, 'zernio');

  try {
    const conversationId =
      (await findZernioConversationId({ accountId: providerAccountId, phone: cleanTo })) || null;

    let messageId: string | undefined;
    let activeConversationId = conversationId;

    if (conversationId) {
      const response = await zernio.messages.sendInboxMessage({
        path: { conversationId },
        body: {
          accountId: providerAccountId,
          message: outboundMessage,
        },
      });
      messageId = response.data?.messageId || undefined;
      activeConversationId = response.data?.conversationId || conversationId;
    } else {
      const response = await zernio.messages.createInboxConversation({
        body: {
          accountId: providerAccountId,
          participantId: cleanTo,
          message: outboundMessage,
        },
      });
      messageId = response.data?.messageId || undefined;
      activeConversationId = response.data?.conversationId || null;
    }

    const finalMessageId = messageId || `wa_zernio_${Date.now()}`;
    await persistOutboundMessage({
      tenantId: params.tenantId,
      integrationId: integration?.id || null,
      providerCode: 'zernio-whatsapp',
      to: cleanTo,
      messageId: finalMessageId,
      messageType: 'text',
      body: outboundMessage,
      contactId: params.contactId || null,
      clientId: params.clientId || null,
      metadata: {
        ...(params.metadata || {}),
        zernio_account_id: providerAccountId,
        zernio_conversation_id: activeConversationId,
      },
    });

    return {
      success: true,
      provider: 'zernio-whatsapp',
      messageId: finalMessageId,
      to: cleanTo,
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'zernio-whatsapp',
      code: 'ZERNIO_API_ERROR',
      error: err?.message || 'Zernio WhatsApp send failed',
    };
  }
}

export async function isWhatsAppConfigured(tenantId: string): Promise<boolean> {
  if (ENV.WHATSAPP_PHONE_NUMBER_ID && ENV.WHATSAPP_ACCESS_TOKEN) return true;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('whatsapp_integrations')
    .select('id, metadata')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(5);

  return Boolean((data || []).length);
}

export async function sendWhatsAppMessage(params: {
  tenantId: string;
  phone: string;
  message: string;
  integrationId?: string;
  contactId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<SendWhatsAppResult> {
  const cleanTo = cleanPhone(params.phone);
  const outboundMessage = String(params.message || '').trim();
  if (!params.tenantId || !cleanTo || !outboundMessage) {
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'VALIDATION_ERROR',
      error: 'tenantId, phone, and message are required',
    };
  }

  const resolved = await resolveWhatsAppProvider({
    tenantId: params.tenantId,
    integrationId: params.integrationId,
  });

  if (resolved.provider === 'zernio') {
    return sendViaZernioText(params);
  }

  return sendViaMeta(params);
}

export async function sendWhatsAppTemplate(params: {
  tenantId: string;
  phone: string;
  templateName: string;
  languageCode?: string;
  templateParams?: string[];
  components?: Record<string, unknown>[];
  integrationId?: string;
  contactId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<SendWhatsAppTemplateResult> {
  const cleanTo = cleanPhone(params.phone);
  if (!params.tenantId || !cleanTo || !params.templateName.trim()) {
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'VALIDATION_ERROR',
      error: 'tenantId, phone, and templateName are required',
    };
  }

  const resolved = await resolveWhatsAppProvider({
    tenantId: params.tenantId,
    integrationId: params.integrationId,
  });

  if (resolved.provider === 'zernio') {
    const supabase = createSupabaseAdminClient();
    const tenantSettings = await getTenantZernioSettings(params.tenantId);
    const providerAccountId =
      tenantSettings?.whatsappAccountId || resolved.integration?.waba_id || null;

    if (!providerAccountId) {
      return {
        success: false,
        provider: 'zernio-whatsapp',
        code: 'NOT_CONFIGURED',
        error:
          'Zernio WhatsApp is not configured. Add your WhatsApp account ID to the tenant Zernio settings first.',
      };
    }

    try {
      const zernio = getZernioClient();
      const conversation = await zernio.messages.createInboxConversation({
        body: {
          accountId: providerAccountId,
          participantId: cleanTo,
          templateName: params.templateName,
          templateLanguage: params.languageCode || 'en_US',
          templateParams: params.templateParams || [],
        },
      });

      const messageId = conversation.data?.messageId || `wa_zernio_tpl_${Date.now()}`;
      await persistOutboundMessage({
        tenantId: params.tenantId,
        integrationId: resolved.integration?.id || null,
        providerCode: 'zernio-whatsapp',
        to: cleanTo,
        messageId,
        messageType: 'template',
        body: params.templateName,
        contactId: params.contactId || null,
        clientId: params.clientId || null,
        metadata: {
          ...(params.metadata || {}),
          zernio_account_id: providerAccountId,
          zernio_conversation_id: conversation.data?.conversationId || null,
          template_name: params.templateName,
          template_language: params.languageCode || 'en_US',
          template_params: params.templateParams || [],
        },
      });

      return {
        success: true,
        provider: 'zernio-whatsapp',
        messageId,
        to: cleanTo,
        conversationId: conversation.data?.conversationId || undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'zernio-whatsapp',
        code: 'ZERNIO_API_ERROR',
        error: err?.message || 'Template send failed',
      };
    }
  }

  const supabase = createSupabaseAdminClient();
  const waIntegration = params.integrationId
    ? await getWhatsAppIntegrationWithToken(supabase, {
        tenantId: params.tenantId,
        integrationId: params.integrationId,
      })
    : await getWhatsAppIntegrationWithToken(supabase, { tenantId: params.tenantId });

  let phoneNumberId = ENV.WHATSAPP_PHONE_NUMBER_ID;
  let accessToken = ENV.WHATSAPP_ACCESS_TOKEN;
  if (waIntegration) {
    phoneNumberId = waIntegration.phone_number_id;
    accessToken = waIntegration.accessToken;
  }

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'NOT_CONFIGURED',
      error: 'WhatsApp integration is not configured',
    };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'template',
        template: {
          name: params.templateName,
          language: { code: params.languageCode || 'en_US' },
          components: params.components || [],
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      return {
        success: false,
        provider: 'meta-whatsapp',
        code: 'META_API_ERROR',
        error: result.error?.message || 'Template send failed',
      };
    }

    const messageId = result.messages?.[0]?.id || `wa_tpl_${Date.now()}`;
    await persistOutboundMessage({
      tenantId: params.tenantId,
      integrationId: waIntegration?.id || null,
      providerCode: 'meta-whatsapp',
      to: cleanTo,
      messageId,
      messageType: 'template',
      body: params.templateName,
      contactId: params.contactId || null,
      clientId: params.clientId || null,
      metadata: {
        ...(params.metadata || {}),
        template_name: params.templateName,
        template_language: params.languageCode || 'en_US',
      },
    });

    return {
      success: true,
      provider: 'meta-whatsapp',
      messageId,
      to: cleanTo,
    };
  } catch (err: unknown) {
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'NETWORK_ERROR',
      error: err instanceof Error ? err.message : 'Template send failed',
    };
  }
}
