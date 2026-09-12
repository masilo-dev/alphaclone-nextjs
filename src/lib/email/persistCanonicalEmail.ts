import type { SupabaseClient } from '@supabase/supabase-js';
import type { UnifiedEmailProvider } from '@/lib/email/unifiedEmailDomain';

type PersistCanonicalOutboundParams = {
  supabase: SupabaseClient;
  tenantId: string;
  userId?: string | null;
  provider: UnifiedEmailProvider;
  providerAccountId: string;
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

async function tenantEntityExists(
  supabase: SupabaseClient,
  tenantId: string,
  table: string,
  id: string | null,
): Promise<boolean> {
  if (!id) return false;
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`EMAIL_CRM_ENTITY_LOOKUP_FAILED:${table}:${error.message}`);
  return Boolean(data?.id);
}

async function resolveCrmRecipient(
  supabase: SupabaseClient,
  tenantId: string,
  email: string,
  metadata: Record<string, unknown>,
): Promise<{ contactId: string | null; leadId: string | null; companyId: string | null; clientId: string | null }> {
  const explicitContactId = stringValue(metadata.contactId) || stringValue(metadata.contact_id);
  const explicitLeadId = stringValue(metadata.leadId) || stringValue(metadata.lead_id);
  const explicitCompanyId = stringValue(metadata.companyId) || stringValue(metadata.company_id);
  const explicitClientId = stringValue(metadata.clientId) || stringValue(metadata.client_id);

  const [contactOk, leadOk, companyOk, clientOk] = await Promise.all([
    tenantEntityExists(supabase, tenantId, 'contacts', explicitContactId),
    tenantEntityExists(supabase, tenantId, 'leads', explicitLeadId),
    tenantEntityExists(supabase, tenantId, 'companies', explicitCompanyId),
    tenantEntityExists(supabase, tenantId, 'business_clients', explicitClientId),
  ]);

  // Foreign IDs never become links. We intentionally do not reveal whether a
  // supplied identifier exists in another workspace.
  const safeExplicit = {
    contactId: contactOk ? explicitContactId : null,
    leadId: leadOk ? explicitLeadId : null,
    companyId: companyOk ? explicitCompanyId : null,
    clientId: clientOk ? explicitClientId : null,
  };
  if (safeExplicit.contactId || safeExplicit.leadId || safeExplicit.companyId || safeExplicit.clientId) return safeExplicit;

  const normalized = email.trim().toLowerCase();
  const [{ data: contact }, { data: lead }, { data: client }] = await Promise.all([
    supabase.from('contacts').select('id, company_id').eq('tenant_id', tenantId).ilike('email', normalized).is('deleted_at', null).limit(1).maybeSingle(),
    supabase.from('leads').select('id').eq('tenant_id', tenantId).ilike('email', normalized).limit(1).maybeSingle(),
    supabase.from('business_clients').select('id').eq('tenant_id', tenantId).ilike('email', normalized).limit(1).maybeSingle(),
  ]);

  return {
    contactId: contact?.id ? String(contact.id) : null,
    leadId: lead?.id ? String(lead.id) : null,
    companyId: contact?.company_id ? String(contact.company_id) : null,
    clientId: client?.id ? String(client.id) : null,
  };
}

async function persistOutboundCrmActivity(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    userId?: string | null;
    contactId?: string | null;
    companyId?: string | null;
    leadId?: string | null;
    clientId?: string | null;
    subject: string;
    provider: UnifiedEmailProvider;
    providerMessageId: string;
    canonicalMessageId: string;
    recipient: string;
  },
) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('activities').insert({
    tenant_id: params.tenantId,
    type: 'email',
    subject: params.subject,
    description: `Outbound email accepted by ${params.provider}`,
    contact_id: params.contactId || null,
    company_id: params.companyId || null,
    created_by: params.userId || null,
    status: 'completed',
    priority: 'normal',
    is_automated: true,
    source: 'email:provider_accepted',
    metadata: {
      direction: 'outbound', provider: params.provider,
      provider_message_id: params.providerMessageId,
      canonical_message_id: params.canonicalMessageId,
      status: 'provider_accepted', recipient: params.recipient,
      lead_id: params.leadId || null, client_id: params.clientId || null,
    },
    completed_at: now,
  });
  if (error) {
    console.warn('[persistCanonicalEmail] CRM activity insert failed:', error.message);
    return;
  }
  if (params.contactId) {
    await supabase.from('contacts').update({ last_contacted_at: now, last_activity_at: now, updated_at: now })
      .eq('tenant_id', params.tenantId).eq('id', params.contactId);
  }
  if (params.companyId) {
    await supabase.from('companies').update({ last_activity_at: now, updated_at: now })
      .eq('tenant_id', params.tenantId).eq('id', params.companyId);
  }
}

export async function persistCanonicalOutboundEmail(params: PersistCanonicalOutboundParams): Promise<string> {
  const { supabase, metadata = {} } = params;
  if (!params.tenantId || !params.providerAccountId || !params.providerMessageId) {
    throw new Error('EMAIL_CANONICAL_EVIDENCE_REQUIRED');
  }

  const provider = params.provider;
  const { data: account, error: accountError } = await supabase
    .from('email_provider_accounts')
    .select('id, tenant_id, provider, email_address, owner_user_id, account_type')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.providerAccountId)
    .eq('provider', provider)
    .eq('connection_status', 'connected')
    .is('deleted_at', null)
    .maybeSingle();
  if (accountError) throw new Error(`Canonical email account lookup failed: ${accountError.message}`);
  if (!account) throw new Error('EMAIL_PROVIDER_ACCOUNT_TENANT_MISMATCH');

  const existing = await supabase.from('email_messages').select('id')
    .eq('tenant_id', params.tenantId)
    .eq('provider_account_id', params.providerAccountId)
    .eq('provider_message_id', params.providerMessageId)
    .maybeSingle();
  if (existing.error) throw new Error(`Canonical email deduplication failed: ${existing.error.message}`);
  if (existing.data?.id) return String(existing.data.id);

  const { data: thread, error: threadError } = await supabase.from('email_threads').insert({
    tenant_id: params.tenantId,
    subject_normalized: normalizedSubject(params.subject),
    latest_message_at: new Date().toISOString(),
    status: 'open',
  }).select('id').single();
  if (threadError || !thread) throw new Error(`Canonical email thread creation failed: ${threadError?.message || 'no row returned'}`);

  const now = new Date().toISOString();
  const requestedPurpose = stringValue(metadata.purpose);
  const purpose = requestedPurpose && EMAIL_PURPOSES.has(requestedPurpose) ? requestedPurpose : 'crm';
  const executionSource = stringValue(metadata.executionSource) || stringValue(metadata.execution_source) || 'server';
  const sourceModule = stringValue(metadata.source_module) || executionSource.split('.')[0] || 'email';
  const sourceAction = stringValue(metadata.source_action) || executionSource.split('.').slice(1).join('.') || 'send';
  const actorId = stringValue(metadata.actor_id) || params.userId || null;
  const idempotencyKey = stringValue(metadata.idempotency_key) || stringValue(metadata.idempotencyKey);

  const crmByRecipient = new Map<string, Awaited<ReturnType<typeof resolveCrmRecipient>>>();
  for (const email of params.recipients) {
    crmByRecipient.set(email.trim().toLowerCase(), await resolveCrmRecipient(supabase, params.tenantId, email, metadata));
  }
  const primaryCrm = crmByRecipient.get(params.recipients[0]?.trim().toLowerCase() || '');

  const { data: message, error: messageError } = await supabase.from('email_messages').insert({
    tenant_id: params.tenantId,
    thread_id: thread.id,
    provider_account_id: params.providerAccountId,
    provider_message_id: params.providerMessageId,
    provider_thread_id: stringValue(metadata.providerThreadId) || stringValue(metadata.provider_thread_id),
    direction: 'outbound',
    purpose,
    subject: params.subject,
    body_preview: (params.text || params.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
    sent_at: null,
    provider_accepted_at: now,
    application_status: 'provider_accepted',
    delivery_status: 'accepted',
    has_attachments: params.hasAttachments,
    created_by: params.userId || null,
    actor_id: actorId,
    lead_id: primaryCrm?.leadId || null,
    contact_id: primaryCrm?.contactId || null,
    client_id: primaryCrm?.clientId || null,
    campaign_id: stringValue(metadata.campaignId) || stringValue(metadata.campaign_id),
    sequence_id: stringValue(metadata.sequenceId) || stringValue(metadata.sequence_id),
    sequence_step_id: stringValue(metadata.sequenceStepId) || stringValue(metadata.sequence_step_id),
    outreach_attempt_id: stringValue(metadata.outreachAttemptId) || stringValue(metadata.outreach_attempt_id),
    source_module: sourceModule,
    source_action: sourceAction,
    idempotency_key: idempotencyKey,
    headers_safe: {},
    metadata: {
      ...metadata,
      provider: params.provider,
      provider_account_id: params.providerAccountId,
      provider_accepted_at: now,
      provider_message_id: params.providerMessageId,
      sender: params.fromEmail,
      execution_source: executionSource,
      body_html: params.html || null,
      body_text: params.text || null,
    },
  }).select('id').single();
  if (messageError || !message) throw new Error(`Canonical email message creation failed: ${messageError?.message || 'no row returned'}`);

  const recipientRows = [
    ...params.recipients.map((email) => {
      const crm = crmByRecipient.get(email.trim().toLowerCase());
      return {
        tenant_id: params.tenantId,
        message_id: message.id,
        recipient_type: 'to',
        email_address: email.trim().toLowerCase(),
        contact_id: crm?.contactId || null,
        company_id: crm?.companyId || null,
        delivery_status: 'accepted',
      };
    }),
    ...(params.replyTo ? [{
      tenant_id: params.tenantId, message_id: message.id, recipient_type: 'reply_to',
      email_address: params.replyTo.trim().toLowerCase(), contact_id: null, company_id: null, delivery_status: null,
    }] : []),
  ];
  const { error: recipientError } = await supabase.from('email_message_recipients').insert(recipientRows);
  if (recipientError) throw new Error(`Canonical email recipients creation failed: ${recipientError.message}`);

  const { error: deliveryError } = await supabase.from('email_delivery_events').insert({
    tenant_id: params.tenantId,
    message_id: message.id,
    provider_account_id: params.providerAccountId,
    provider: params.provider,
    provider_message_id: params.providerMessageId,
    provider_event_id: `accepted:${params.provider}:${params.providerMessageId}`,
    event_type: 'provider_accepted',
    recipient_email: params.recipients.length === 1 ? params.recipients[0].trim().toLowerCase() : null,
    occurred_at: now,
    received_at: now,
    payload_safe: { provider: params.provider, provider_message_id: params.providerMessageId, source: 'provider_send_response' },
    signature_verified: true,
    processed_at: now,
  });
  if (deliveryError) throw new Error(`Canonical provider acceptance event failed: ${deliveryError.message}`);

  for (const email of params.recipients) {
    const crm = crmByRecipient.get(email.trim().toLowerCase());
    if (!crm?.contactId && !crm?.companyId && !crm?.leadId && !crm?.clientId) continue;
    await persistOutboundCrmActivity(supabase, {
      tenantId: params.tenantId, userId: params.userId,
      contactId: crm.contactId, companyId: crm.companyId, leadId: crm.leadId, clientId: crm.clientId,
      subject: params.subject, provider: params.provider, providerMessageId: params.providerMessageId,
      canonicalMessageId: String(message.id), recipient: email.trim().toLowerCase(),
    });
  }

  await supabase.from('business_automation_events').insert({
    tenant_id: params.tenantId,
    event_type: 'email_sent',
    payload: {
      canonicalMessageId: message.id,
      threadId: thread.id,
      provider: params.provider,
      providerAccountId: params.providerAccountId,
      providerMessageId: params.providerMessageId,
      recipients: params.recipients,
      executionSource,
      contactId: primaryCrm?.contactId || null,
      leadId: primaryCrm?.leadId || null,
      clientId: primaryCrm?.clientId || null,
      companyId: primaryCrm?.companyId || null,
      campaignId: stringValue(metadata.campaignId) || stringValue(metadata.campaign_id),
    },
  });

  return String(message.id);
}
