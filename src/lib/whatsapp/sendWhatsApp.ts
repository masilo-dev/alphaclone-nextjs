import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface SendWhatsAppResult {
  success: boolean;
  provider: 'green-api';
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
    return { success: false, provider: 'green-api', error: 'tenantId, phone, and message are required' };
  }

  let query = supabase
    .from('whatsapp_integrations')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .eq('is_active', true);
  if (params.integrationId) query = query.eq('id', params.integrationId);

  const { data: integration, error } = await query.maybeSingle();
  if (error) return { success: false, provider: 'green-api', error: error.message };
  if (!integration) return { success: false, provider: 'green-api', error: 'No active WhatsApp integration found' };

  const idInstance = integration.waba_id;
  const apiTokenInstance = integration.metadata?.apiTokenInstance;
  if (!idInstance || !apiTokenInstance) {
    return { success: false, provider: 'green-api', error: 'WhatsApp instance is not fully configured' };
  }

  const response = await fetch(`https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: `${cleanTo}@c.us`, message: params.message }),
  });
  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : {};
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

  await supabase.from('unified_messages').insert({
    tenant_id: params.tenantId,
    source: 'whatsapp',
    external_id: messageId,
    direction: 'outbound',
    channel: 'chat',
    body: params.message,
    from_address: idInstance,
    to_address: cleanTo,
    contact_id: contact?.id || null,
    read: true,
    replied: true,
    starred: false,
    archived: false,
    folder: 'sent',
    priority: 'normal',
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
}
