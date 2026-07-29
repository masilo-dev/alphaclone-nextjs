import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminMessageSource =
  | 'internal'
  | 'gmail'
  | 'zoho'
  | 'sms'
  | 'slack'
  | 'teams'
  | 'brevo'
  | 'resend'
  | 'sendgrid'
  | 'facebook'
  | 'whatsapp'
  | 'linkedin'
  | 'instagram'
  | 'mcp';

export type AdminMessageDirection = 'inbound' | 'outbound';
export type AdminMessageChannel = 'email' | 'chat' | 'sms' | 'call';

export type AdminUnifiedMessageParams = {
  tenant_id: string;
  company_id?: string | null;
  contact_id?: string | null;
  opportunity_id?: string | null;
  source: AdminMessageSource;
  external_id?: string | null;
  thread_id?: string | null;
  direction: AdminMessageDirection;
  channel: AdminMessageChannel;
  subject?: string | null;
  body?: string | null;
  html_body?: string | null;
  attachments?: any[] | null;
  from_address?: string | null;
  from_name?: string | null;
  to_address?: string | null;
  to_name?: string | null;
  cc_address?: string | null;
  bcc_address?: string | null;
  sentiment?: 'positive' | 'neutral' | 'negative' | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null;
  category?: string | null;
  intent?: string | null;
  needs_response?: boolean | null;
  auto_replied?: boolean | null;
  sent_at?: string | null;
  received_at?: string | null;
  read_at?: string | null;
  replied_at?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, any> | null;
};

export async function syncExternalMessageAdmin(
  supabase: SupabaseClient,
  params: AdminUnifiedMessageParams
) {
  const base = {
    tenant_id: params.tenant_id,
    priority: params.priority ?? 'normal',
    folder: 'inbox',
    read: false,
    replied: false,
    starred: false,
    archived: false,
    needs_response: params.needs_response ?? true,
    auto_replied: params.auto_replied ?? false,
    synced_at: new Date().toISOString(),
  };

  if (params.external_id && params.source) {
    const { data: existing } = await supabase
      .from('unified_messages')
      .select('id')
      .eq('tenant_id', params.tenant_id)
      .eq('source', params.source)
      .eq('external_id', params.external_id)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase
        .from('unified_messages')
        .update({ ...base, ...params })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  const { data, error } = await supabase
    .from('unified_messages')
    .insert({ ...base, ...params })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolveContactByEmailAdmin(
  supabase: SupabaseClient,
  tenantId: string,
  email: string
): Promise<{ contact_id: string | null; company_id: string | null }> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return { contact_id: null, company_id: null };

  const { data, error } = await supabase
    .from('contacts')
    .select('id, company_id')
    .eq('tenant_id', tenantId)
    .eq('email', normalized)
<<<<<<< HEAD
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return { contact_id: row?.id ?? null, company_id: (row as { company_id?: string | null } | undefined)?.company_id ?? null };
=======
    .maybeSingle();

  if (error) throw error;
  return { contact_id: data?.id ?? null, company_id: (data as any)?.company_id ?? null };
>>>>>>> origin/main
}

