import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getZernioClient, getTenantZernioSettings } from '@/lib/zernio/client';

export interface SendWhatsAppResult {
  success: boolean;
  provider: 'green-api' | 'zernio';
  messageId?: string;
  to?: string;
  error?: string;
}

function cleanPhone(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
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

  // 1. Fetch Zernio settings to check if Zernio WhatsApp is configured
  const zernioSettings = await getTenantZernioSettings(params.tenantId);
  const zernioAccountId = zernioSettings?.whatsappAccountId || zernioSettings?.accountId;

  // 2. Fetch active integration
  let query = supabase
    .from('whatsapp_integrations')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .eq('is_active', true);
  if (params.integrationId) query = query.eq('id', params.integrationId);

  const { data: integration } = await query.maybeSingle();

  const preferGreenApi =
    integration?.metadata?.provider === 'green-api' ||
    (!!integration?.waba_id && !!integration?.metadata?.apiTokenInstance);
  const hasZernioKey = !!process.env.ZERNIO_API_KEY;
  const isZernio =
    !preferGreenApi &&
    hasZernioKey &&
    (!!zernioAccountId || integration?.metadata?.provider === 'zernio' || !!integration?.metadata?.whatsappAccountId);

  if (isZernio) {
    try {
      const activeAccountId = zernioAccountId || integration?.metadata?.whatsappAccountId || integration?.waba_id;
      if (!activeAccountId) {
        throw new Error('Zernio WhatsApp account ID is not configured');
      }

      const zernio = getZernioClient();
      const response = await zernio.messages.createInboxConversation({
        body: {
          accountId: activeAccountId,
          participantId: cleanTo,
          message: params.message,
        },
      });

      const messageId = (response as any).data?.messageId || `wa_out_${Date.now()}`;
      await supabase.from('whatsapp_messages').insert({
        tenant_id: params.tenantId,
        integration_id: integration?.id || null,
        provider_message_id: messageId,
        chat_id: `${cleanTo}@c.us`,
        phone_number: cleanTo,
        direction: 'outbound',
        message_type: 'text',
        body: params.message,
        contact_id: params.contactId || null,
        client_id: params.clientId || null,
        status: 'sent',
        sent_by: 'api',
        needs_response: false,
        sent_at: new Date().toISOString(),
        metadata: { ...(params.metadata || {}), provider: 'zernio' },
      });
      return { success: true, provider: 'zernio', messageId, to: cleanTo };
    } catch (err: any) {
      console.error('[whatsapp/send] Zernio send failed, falling back to Green API:', err);
      // Fall through to Green API when configured.
    }
  }

  // Green API (primary for most tenants)
  if (!integration) {
    return { success: false, provider: 'green-api', error: 'No active WhatsApp integration found' };
  }

  const idInstance = integration.waba_id;
  const apiTokenInstance = integration.metadata?.apiTokenInstance;
  if (!idInstance || !apiTokenInstance) {
    return { success: false, provider: 'green-api', error: 'WhatsApp instance is not fully configured' };
  }

  try {
    const response = await fetch(`https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: `${cleanTo}@c.us`, message: params.message }),
    });
    const bodyText = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      body = { raw: bodyText };
    }
    if (!response.ok) {
      return { success: false, provider: 'green-api', to: cleanTo, error: bodyText || `Green API rejected request (${response.status})` };
    }

    const messageId = String(body.idMessage || body.messageId || `wa_out_${Date.now()}`);
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
      integration_id: integration.id,
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
      metadata: params.metadata || {},
    });

    await supabase.from('whatsapp_outreach_logs').insert({
      tenant_id: params.tenantId,
      lead_id: params.clientId || params.contactId || null,
      phone_number: cleanTo,
      status: 'sent',
      message_content: params.message,
      sent_at: new Date().toISOString(),
    });

    return { success: true, provider: 'green-api', messageId, to: cleanTo };
  } catch (err: any) {
    return { success: false, provider: 'green-api', error: err?.message || 'Green-API request failed' };
  }
}

