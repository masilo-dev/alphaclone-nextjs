import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getZernioClient, getTenantZernioSettings } from '@/lib/zernio/client';

export interface SendWhatsAppResult {
  success: boolean;
  provider: 'zernio';
  messageId?: string;
  to?: string;
  error?: string;
}

function cleanPhone(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

export async function isWhatsAppConfigured(tenantId: string): Promise<boolean> {
  if (!process.env.ZERNIO_API_KEY) return false;
  const zernioSettings = await getTenantZernioSettings(tenantId);
  return !!(zernioSettings?.whatsappAccountId || zernioSettings?.accountId);
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
  const cleanTo = cleanPhone(params.phone);
  if (!params.tenantId || !cleanTo || !params.message.trim()) {
    return { success: false, provider: 'zernio', error: 'tenantId, phone, and message are required' };
  }

  if (!process.env.ZERNIO_API_KEY) {
    return { success: false, provider: 'zernio', error: 'ZERNIO_API_KEY is not configured on the server' };
  }

  const zernioSettings = await getTenantZernioSettings(params.tenantId);
  const zernioAccountId = zernioSettings?.whatsappAccountId || zernioSettings?.accountId;
  if (!zernioAccountId) {
    return {
      success: false,
      provider: 'zernio',
      error: 'WhatsApp is not connected. Add your Zernio account ID under Settings → Integrations → WhatsApp.',
    };
  }

  try {
    const zernio = getZernioClient();
    const response = await zernio.messages.createInboxConversation({
      body: {
        accountId: zernioAccountId,
        participantId: cleanTo,
        message: params.message,
      },
    });

    const messageId = (response as any).data?.messageId || `wa_out_${Date.now()}`;

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
      integration_id: null,
      provider_message_id: messageId,
      chat_id: `${cleanTo}@c.us`,
      phone_number: cleanTo,
      direction: 'outbound',
      message_type: 'text',
      body: params.message,
      contact_id: contact?.id || null,
      client_id: params.clientId || null,
      status: 'sent',
      sent_by: params.metadata?.source === 'auto_outreach' ? 'bot' : params.metadata?.source === 'mcp' ? 'api' : 'human',
      needs_response: false,
      sent_at: new Date().toISOString(),
      metadata: { ...(params.metadata || {}), provider: 'zernio' },
    });

    await supabase.from('whatsapp_outreach_logs').insert({
      tenant_id: params.tenantId,
      lead_id: params.clientId || params.contactId || null,
      phone_number: cleanTo,
      status: 'sent',
      message_content: params.message,
      sent_at: new Date().toISOString(),
    });

    return { success: true, provider: 'zernio', messageId, to: cleanTo };
  } catch (err: any) {
    console.error('[whatsapp/send] Zernio send failed:', err);
    return { success: false, provider: 'zernio', error: err?.message || 'Zernio WhatsApp send failed' };
  }
}
