import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { sanitizeBonnieOutboundText } from '@/lib/bonnie/bonnieBannedLanguage';
import {
  getWhatsAppIntegrationWithToken,
  getWhatsAppIntegration,
} from '@/services/whatsapp/whatsappIntegrationService';

export type SendWhatsAppErrorCode =
  | 'NOT_CONFIGURED'
  | 'VALIDATION_ERROR'
  | 'META_API_ERROR'
  | 'NETWORK_ERROR';

export interface SendWhatsAppResult {
  success: boolean;
  provider: 'meta-whatsapp';
  messageId?: string;
  to?: string;
  error?: string;
  code?: SendWhatsAppErrorCode;
}

function cleanPhone(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

export async function isWhatsAppConfigured(tenantId: string): Promise<boolean> {
  // Configured if we have global fallback environment variables or active tenant-specific integration
  if (ENV.WHATSAPP_PHONE_NUMBER_ID && ENV.WHATSAPP_ACCESS_TOKEN) return true;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('whatsapp_integrations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .not('phone_number_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (data) return true;
  return false;
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
  const supabase = createSupabaseAdminClient();
  const allowTenantEmoji = params.metadata?.allowEmoji === true;
  const skipQuality = params.metadata?.skipBonnieQualityCheck === true;
  const outboundMessage = skipQuality
    ? params.message
    : sanitizeBonnieOutboundText(params.message, { allowEmoji: allowTenantEmoji }).clean;
  const cleanTo = cleanPhone(params.phone);
  if (!params.tenantId || !cleanTo || !outboundMessage.trim()) {
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'VALIDATION_ERROR',
      error: 'tenantId, phone, and message are required',
    };
  }

  // 1. Resolve credentials (first try DB integrations, then fall back to env vars)
  let phoneNumberId = ENV.WHATSAPP_PHONE_NUMBER_ID;
  let accessToken = ENV.WHATSAPP_ACCESS_TOKEN;
  let activeIntegrationId: string | null = params.integrationId || null;

  const waIntegration = params.integrationId
    ? await getWhatsAppIntegrationWithToken(supabase, {
        tenantId: params.tenantId,
        integrationId: params.integrationId,
      })
    : await getWhatsAppIntegrationWithToken(supabase, { tenantId: params.tenantId });

  if (waIntegration) {
    phoneNumberId = waIntegration.phone_number_id;
    accessToken = waIntegration.accessToken;
    activeIntegrationId = waIntegration.id;
  } else if (params.integrationId) {
    const row = await getWhatsAppIntegration(supabase, {
      tenantId: params.tenantId,
      integrationId: params.integrationId,
      requireActive: false,
    });
    if (row?.phone_number_id) phoneNumberId = row.phone_number_id;
  }

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'NOT_CONFIGURED',
      error: 'WhatsApp integration is not configured. Add Phone Number ID and Access Token under Integration Settings, or set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in Vercel.',
    };
  }

  try {
    // 2. Send request to Meta Cloud API (v18.0)
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
      console.error('[WhatsApp send failed] Meta API response:', result);
      const metaCode = result.error?.code;
      const metaMessage = result.error?.message || 'Failed to send WhatsApp message via Meta Cloud API';
      return {
        success: false,
        provider: 'meta-whatsapp',
        code: 'META_API_ERROR',
        error: metaCode === 190
          ? 'WhatsApp access token expired or invalid. Reconnect Meta Cloud API credentials under Integration Settings → WhatsApp.'
          : metaMessage,
      };
    }

    const messageId = result.messages?.[0]?.id || `wa_out_${Date.now()}`;

    const { data: contact } = params.contactId
      ? { data: { id: params.contactId } }
      : await supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', params.tenantId)
        .or(`phone.ilike.%${cleanTo}%,mobile.ilike.%${cleanTo}%`)
        .maybeSingle();

    await supabase.from('whatsapp_messages').insert({
      tenant_id: params.tenantId,
      integration_id: activeIntegrationId,
      provider: 'meta-whatsapp',
      provider_message_id: messageId,
      chat_id: cleanTo,
      phone_number: cleanTo,
      direction: 'outbound',
      message_type: 'text',
      body: outboundMessage,
      contact_id: contact?.id || null,
      client_id: params.clientId || null,
      status: 'sent',
      sent_by: params.metadata?.source === 'auto_outreach' ? 'bot' : params.metadata?.source === 'mcp' ? 'api' : 'human',
      needs_response: false,
      sent_at: new Date().toISOString(),
      metadata: { ...(params.metadata || {}), provider: 'meta-whatsapp' },
    });

    await supabase.from('whatsapp_outreach_logs').insert({
      tenant_id: params.tenantId,
      lead_id: params.clientId || params.contactId || null,
      phone_number: cleanTo,
      status: 'sent',
      message_content: outboundMessage,
      sent_at: new Date().toISOString(),
    });

    return { success: true, provider: 'meta-whatsapp', messageId, to: cleanTo };
  } catch (err: any) {
    console.error('[whatsapp/send] Meta send failed:', err);
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'NETWORK_ERROR',
      error: err?.message || 'Meta WhatsApp send failed',
    };
  }
}

export async function sendWhatsAppTemplate(params: {
  tenantId: string;
  phone: string;
  templateName: string;
  languageCode?: string;
  components?: Record<string, unknown>[];
  integrationId?: string;
}): Promise<SendWhatsAppResult> {
  const supabase = createSupabaseAdminClient();
  const cleanTo = cleanPhone(params.phone);
  if (!params.tenantId || !cleanTo || !params.templateName.trim()) {
    return {
      success: false,
      provider: 'meta-whatsapp',
      code: 'VALIDATION_ERROR',
      error: 'tenantId, phone, and templateName are required',
    };
  }

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
    return {
      success: true,
      provider: 'meta-whatsapp',
      messageId: result.messages?.[0]?.id,
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
