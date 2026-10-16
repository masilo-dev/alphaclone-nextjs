import { classifyOutreachReply } from '@/lib/outreach/outreachIntelligence';
import { normalizeOutreachRecipient } from '@/lib/revenue/connectedLifecycle';

export async function recordInboundOutreachReply(options: { admin: any; tenantId: string; channel: 'email'|'sms'|'whatsapp'; sender: string; text: string; provider: string; providerEventId?: string | null }) {
  const sender = options.channel === 'email' ? options.sender.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || options.sender : options.sender;
  const normalized = normalizeOutreachRecipient(options.channel, sender);
  const { data: enrollment, error } = await options.admin.from('outreach_sequence_enrollments').select('*').eq('tenant_id', options.tenantId).eq('normalized_recipient', normalized).in('status', ['active','waiting']).order('enrolled_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;

  let campaignRecipient: any = null;
  let leadOutreachLog: any = null;
  let leadBySender: any = null;

  if (!enrollment) {
    if (options.channel === 'email') {
      const { data: cr } = await options.admin
        .from('campaign_recipients')
        .select('*')
        .eq('tenant_id', options.tenantId)
        .ilike('email', sender)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      campaignRecipient = cr;

      const { data: logRow } = await options.admin
        .from('lead_outreach_log')
        .select('*')
        .eq('tenant_id', options.tenantId)
        .ilike('lead_email', sender)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      leadOutreachLog = logRow;
    }

    const { data: leadRow } = await options.admin
      .from('leads')
      .select('id, business_name, contact_name, email, phone, assigned_to')
      .eq('tenant_id', options.tenantId)
      .or(options.channel === 'email' ? `email.ilike.${sender}` : `phone.ilike.%${normalized.slice(-8)}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    leadBySender = leadRow;
  }

  if (!enrollment && !campaignRecipient && !leadOutreachLog && !leadBySender) {
    return { matched: false as const, sourceType: null, sourceId: null };
  }

  const classification = classifyOutreachReply(options.text || '');
  const eventType = classification === 'positive' ? 'positive_reply' : classification === 'unsubscribe' ? 'unsubscribed' : classification === 'neutral' ? 'replied' : classification;

  const matchKey = enrollment?.id || campaignRecipient?.id || leadOutreachLog?.id || leadBySender?.id;
  const providerEventId = options.providerEventId || `${options.provider}:${matchKey}:${Date.now()}`;

  let sequence: any = null;
  if (enrollment?.sequence_id) {
    const { data: seq } = await options.admin.from('outreach_sequences').select('campaign_id,stop_on_reply').eq('tenant_id', options.tenantId).eq('id', enrollment.sequence_id).maybeSingle();
    sequence = seq;
  }

  const campaignId = enrollment ? (sequence?.campaign_id || null) : (campaignRecipient?.campaign_id || leadOutreachLog?.campaign_id || null);
  const contactId = enrollment?.contact_id || campaignRecipient?.contact_id || leadOutreachLog?.contact_id || null;
  const leadId = enrollment?.lead_id || leadOutreachLog?.lead_id || leadBySender?.id || null;
  const clientId = enrollment?.client_id || null;

  const outreachEvent = {
    tenant_id: options.tenantId,
    campaign_id: campaignId,
    sequence_id: enrollment?.sequence_id || null,
    contact_id: contactId,
    lead_id: leadId,
    client_id: clientId,
    channel: options.channel,
    event_type: eventType,
    provider: options.provider,
    provider_event_id: providerEventId,
    variant: enrollment?.metadata?.variant || campaignRecipient?.metadata?.abVariant || null,
    metadata: {
      enrollment_id: enrollment?.id || null,
      campaign_recipient_id: campaignRecipient?.id || null,
      lead_outreach_log_id: leadOutreachLog?.id || null,
      experiment_id: enrollment?.metadata?.experiment_id || campaignRecipient?.metadata?.experimentId || null,
      reply_text: options.text.slice(0, 100_000),
      reply_classification: classification,
      sender: options.sender,
      email: enrollment?.recipient_email || enrollment?.email || campaignRecipient?.email || leadOutreachLog?.lead_email || sender,
      recipient: enrollment?.recipient_email || enrollment?.email || campaignRecipient?.email || leadOutreachLog?.lead_email || sender,
      normalized_recipient: normalized,
      recipient_name: enrollment?.recipient_name || enrollment?.contact_name || enrollment?.lead_name || leadBySender?.contact_name || leadBySender?.business_name || null,
      contact_name: enrollment?.recipient_name || enrollment?.contact_name || leadBySender?.contact_name || null,
      lead_name: enrollment?.lead_name || leadBySender?.business_name || null,
    },
  };

  const { data: event, error: eventError } = await options.admin
    .from('outreach_events')
    .upsert(outreachEvent, { onConflict: 'tenant_id,provider,provider_event_id', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();
  if (eventError) throw eventError;

  if (enrollment) {
    if (sequence?.stop_on_reply !== false) {
      await options.admin.from('outreach_sequence_enrollments').update({ status: 'stopped', last_event_type: eventType, updated_at: new Date().toISOString() }).eq('tenant_id', options.tenantId).eq('id', enrollment.id);
    }
  }

  if (campaignRecipient) {
    await options.admin.from('campaign_recipients').update({ status: 'replied', updated_at: new Date().toISOString() }).eq('tenant_id', options.tenantId).eq('id', campaignRecipient.id);
  }

  if (leadOutreachLog) {
    await options.admin.from('lead_outreach_log').update({ status: 'replied', replied_at: new Date().toISOString() }).eq('tenant_id', options.tenantId).eq('id', leadOutreachLog.id);
  }

  if (leadId) {
    await options.admin.from('leads').update({ outreach_status: 'replied', updated_at: new Date().toISOString() }).eq('tenant_id', options.tenantId).eq('id', leadId);
  }

  if (classification === 'unsubscribe') {
    await options.admin.from('outreach_suppressions').upsert({ tenant_id: options.tenantId, channel: options.channel, normalized_recipient: normalized, reason: 'Inbound unsubscribe request', source: options.provider }, { onConflict: 'tenant_id,channel,normalized_recipient' });
  }

  let dealId: string | null = null;
  const sourceType = leadId ? 'lead' : contactId ? 'contact' : clientId ? 'client' : null;
  const sourceId = leadId || contactId || clientId || null;

  if (classification === 'positive' && sourceType && sourceId) {
    const sourceTable = sourceType === 'lead' ? 'leads' : sourceType === 'contact' ? 'contacts' : 'business_clients';
    const sourceFields = sourceType === 'lead' ? 'business_name,contact_name,assigned_to' : sourceType === 'contact' ? 'full_name,owner_id' : 'name';
    const { data: sourceRecord } = await options.admin.from(sourceTable).select(sourceFields).eq('tenant_id', options.tenantId).eq('id', sourceId).maybeSingle();
    let ownerId = sourceRecord?.assigned_to || sourceRecord?.owner_id || null;
    if (!ownerId) {
      const { data: member } = await options.admin.from('tenant_users').select('user_id').eq('tenant_id', options.tenantId).in('role', ['owner','admin','sales']).order('created_at').limit(1).maybeSingle();
      ownerId = member?.user_id || null;
    }
    if (sourceType === 'lead') {
      await options.admin.from('leads').update({ status: 'qualified', assigned_to: ownerId, updated_at: new Date().toISOString() }).eq('tenant_id', options.tenantId).eq('id', sourceId);
    }
    const { data: existingLink } = await options.admin.from('revenue_lifecycle_links').select('target_id').eq('tenant_id', options.tenantId).eq('source_type', sourceType).eq('source_id', sourceId).eq('target_type', 'deal').eq('relationship', 'converted_to').limit(1).maybeSingle();
    dealId = existingLink?.target_id || null;
    if (!dealId) {
      const sourceName = sourceRecord?.business_name || sourceRecord?.contact_name || sourceRecord?.full_name || sourceRecord?.name || options.sender;
      const { data: deal } = await options.admin.from('deals').insert({
        tenant_id: options.tenantId,
        name: `${sourceName} — outreach opportunity`,
        value: 0,
        currency: 'USD',
        stage: 'qualification',
        owner_id: ownerId,
        source: 'outreach',
        metadata: {
          lead_id: leadId,
          contact_id: contactId,
          client_id: clientId,
          outreach_event_id: event?.id || null,
          sequence_id: enrollment?.sequence_id || null,
        },
      }).select('id').single();
      if (deal?.id) {
        dealId = deal.id;
        await options.admin.from('revenue_lifecycle_links').insert({
          tenant_id: options.tenantId,
          source_type: sourceType,
          source_id: sourceId,
          target_type: 'deal',
          target_id: deal.id,
          relationship: 'converted_to',
        });
      }
    }
  }

  return { matched: true as const, classification, eventType, dealId, sourceType, sourceId };
}
