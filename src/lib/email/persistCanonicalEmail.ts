import type { SupabaseClient } from '@supabase/supabase-js';
import type { UnifiedEmailProvider } from '@/lib/email/unifiedEmailDomain';

type PersistCanonicalOutboundParams = {
  supabase: SupabaseClient;
  tenantId: string;
  userId?: string | null;
  provider: UnifiedEmailProvider;
  providerMessageId: string;
  fromEmail: string;
  recipients: string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  hasAttachments: boolean;
  metadata?: Record<string, unknown>;
};

function normalizedSubject(subject: string): string {
  return subject.trim().replace(/^((re|fw|fwd):\s*)+/gi, '').toLowerCase();
}

function stringValue(value: unknown): string | null {
  const result = typeof value === 'string' ? value.trim() : '';
  return result || null;
}

const EMAIL_PURPOSES = new Set([
  'personal', 'crm', 'transactional', 'marketing', 'invoice',
  'contract', 'project', 'calendar', 'automation',
]);

/**
 * Persist the provider-independent record that powers Sent, CRM history and
 * cross-provider threading. This deliberately throws: provider acceptance is
 * not reported as a complete AlphaClone send when local history was not saved.
 */
export async function persistCanonicalOutboundEmail(
  params: PersistCanonicalOutboundParams,
): Promise<string> {
  const { supabase, metadata = {} } = params;
  const provider = params.provider === 'zoho' ? 'zoho' : params.provider;

  let accountQuery = supabase
    .from('email_provider_accounts')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('provider', provider)
    .eq('connection_status', 'connected')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (params.userId) accountQuery = accountQuery.eq('owner_user_id', params.userId);

  let { data: account, error: accountError } = await accountQuery.maybeSingle();
  if (accountError) throw new Error(`Canonical email account lookup failed: ${accountError.message}`);

  if (!account) {
    const { data: created, error } = await supabase
      .from('email_provider_accounts')
      .insert({
        tenant_id: params.tenantId,
        owner_user_id: params.userId || null,
        provider,
        account_type: 'platform',
        email_address: params.fromEmail.toLowerCase(),
        display_name: provider,
        connection_status: 'connected',
        sync_status: 'not_started',
        capabilities: {},
        allowed_purposes: ['personal', 'crm', 'transactional', 'marketing', 'automation'],
        created_by: params.userId || null,
      })
      .select('id')
      .single();
    if (error || !created) throw new Error(`Canonical email account creation failed: ${error?.message || 'no row returned'}`);
    account = created;
  }

  const existing = await supabase
    .from('email_messages')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('provider_account_id', account.id)
    .eq('provider_message_id', params.providerMessageId)
    .maybeSingle();
  if (existing.error) throw new Error(`Canonical email deduplication failed: ${existing.error.message}`);
  if (existing.data?.id) return String(existing.data.id);

  const { data: thread, error: threadError } = await supabase
    .from('email_threads')
    .insert({
      tenant_id: params.tenantId,
      subject_normalized: normalizedSubject(params.subject),
      latest_message_at: new Date().toISOString(),
      status: 'open',
    })
    .select('id')
    .single();
  if (threadError || !thread) throw new Error(`Canonical email thread creation failed: ${threadError?.message || 'no row returned'}`);

  const now = new Date().toISOString();
  const requestedPurpose = stringValue(metadata.purpose);
  const purpose = requestedPurpose && EMAIL_PURPOSES.has(requestedPurpose) ? requestedPurpose : 'crm';
  const executionSource = stringValue(metadata.executionSource)
    || stringValue(metadata.execution_source)
    || 'AlphaClone UI';
  const { data: message, error: messageError } = await supabase
    .from('email_messages')
    .insert({
      tenant_id: params.tenantId,
      thread_id: thread.id,
      provider_account_id: account.id,
      provider_message_id: params.providerMessageId,
      provider_thread_id: stringValue(metadata.providerThreadId) || stringValue(metadata.provider_thread_id),
      direction: 'outbound',
      purpose,
      subject: params.subject,
      body_preview: (params.text || params.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
      sent_at: now,
      application_status: 'sent',
      delivery_status: 'accepted',
      has_attachments: params.hasAttachments,
      created_by: params.userId || null,
      metadata: {
        ...metadata,
        provider: params.provider,
        sender: params.fromEmail,
        execution_source: executionSource,
        body_html: params.html || null,
        body_text: params.text || null,
      },
    })
    .select('id')
    .single();
  if (messageError || !message) throw new Error(`Canonical email message creation failed: ${messageError?.message || 'no row returned'}`);

  const recipientRows = [
    ...params.recipients.map((email) => ({
      tenant_id: params.tenantId,
      message_id: message.id,
      recipient_type: 'to',
      email_address: email.trim().toLowerCase(),
      contact_id: stringValue(metadata.contactId) || stringValue(metadata.contact_id),
      company_id: stringValue(metadata.companyId) || stringValue(metadata.company_id),
      delivery_status: 'accepted',
    })),
    ...(params.replyTo ? [{
      tenant_id: params.tenantId,
      message_id: message.id,
      recipient_type: 'reply_to',
      email_address: params.replyTo.trim().toLowerCase(),
      contact_id: null,
      company_id: null,
      delivery_status: null,
    }] : []),
  ];
  const { error: recipientError } = await supabase.from('email_message_recipients').insert(recipientRows);
  if (recipientError) throw new Error(`Canonical email recipients creation failed: ${recipientError.message}`);

  await supabase.from('business_automation_events').insert({
    tenant_id: params.tenantId,
    event_type: 'email_sent',
    payload: {
      canonicalMessageId: message.id,
      threadId: thread.id,
      provider: params.provider,
      providerMessageId: params.providerMessageId,
      recipients: params.recipients,
      executionSource,
      contactId: stringValue(metadata.contactId) || stringValue(metadata.contact_id),
      companyId: stringValue(metadata.companyId) || stringValue(metadata.company_id),
      dealId: stringValue(metadata.dealId) || stringValue(metadata.deal_id),
      projectId: stringValue(metadata.projectId) || stringValue(metadata.project_id),
      campaignId: stringValue(metadata.campaignId) || stringValue(metadata.campaign_id),
    },
  });

  return String(message.id);
}
