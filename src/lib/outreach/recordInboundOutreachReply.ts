import { classifyOutreachReply } from '@/lib/outreach/outreachIntelligence';
import { normalizeOutreachRecipient } from '@/lib/revenue/connectedLifecycle';

export async function recordInboundOutreachReply(options: { admin: any; tenantId: string; channel: 'email'|'sms'|'whatsapp'; sender: string; text: string; provider: string; providerEventId?: string | null }) {
  const sender = options.channel === 'email' ? options.sender.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || options.sender : options.sender;
  const normalized = normalizeOutreachRecipient(options.channel, sender);
  const { data: enrollment, error } = await options.admin.from('outreach_sequence_enrollments').select('*').eq('tenant_id', options.tenantId).eq('normalized_recipient', normalized).in('status', ['active','waiting']).order('enrolled_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!enrollment) return { matched: false };
  const classification = classifyOutreachReply(options.text || '');
  const eventType = classification === 'positive' ? 'positive_reply' : classification === 'unsubscribe' ? 'unsubscribed' : classification === 'neutral' ? 'replied' : classification;
  const providerEventId = options.providerEventId || `${options.provider}:${enrollment.id}:${Date.now()}`;
  const { data: sequence } = await options.admin.from('outreach_sequences').select('campaign_id,stop_on_reply').eq('tenant_id', options.tenantId).eq('id', enrollment.sequence_id).maybeSingle();
  const { data: event, error: eventError } = await options.admin.from('outreach_events').upsert({ tenant_id: options.tenantId, campaign_id: sequence?.campaign_id || null, sequence_id: enrollment.sequence_id, contact_id: enrollment.contact_id || null, lead_id: enrollment.lead_id || null, channel: options.channel, event_type: eventType, provider: options.provider, provider_event_id: providerEventId, variant: enrollment.metadata?.variant || null, metadata: { enrollment_id: enrollment.id, experiment_id: enrollment.metadata?.experiment_id || null, reply_text: options.text.slice(0, 100_000), reply_classification: classification, sender: options.sender } }, { onConflict: 'tenant_id,provider,provider_event_id', ignoreDuplicates: true }).select('id').maybeSingle();
  if (eventError) throw eventError;
  if (sequence?.stop_on_reply !== false) await options.admin.from('outreach_sequence_enrollments').update({ status: 'stopped', last_event_type: eventType, updated_at: new Date().toISOString() }).eq('tenant_id', options.tenantId).eq('id', enrollment.id);
  if (classification === 'unsubscribe') await options.admin.from('outreach_suppressions').upsert({ tenant_id: options.tenantId, channel: options.channel, normalized_recipient: normalized, reason: 'Inbound unsubscribe request', source: options.provider }, { onConflict: 'tenant_id,channel,normalized_recipient' });
  let dealId: string | null = null;
  const sourceType = enrollment.lead_id ? 'lead' : enrollment.contact_id ? 'contact' : enrollment.client_id ? 'client' : null;
  const sourceId = enrollment.lead_id || enrollment.contact_id || enrollment.client_id || null;
  if (classification === 'positive' && sourceType && sourceId) {
    const sourceTable = sourceType === 'lead' ? 'leads' : sourceType === 'contact' ? 'contacts' : 'business_clients';
    const sourceFields = sourceType === 'lead' ? 'business_name,contact_name,assigned_to' : sourceType === 'contact' ? 'full_name,owner_id' : 'name';
    const { data: sourceRecord } = await options.admin.from(sourceTable).select(sourceFields).eq('tenant_id', options.tenantId).eq('id', sourceId).maybeSingle();
    let ownerId = sourceRecord?.assigned_to || sourceRecord?.owner_id || null;
    if (!ownerId) { const { data: member } = await options.admin.from('tenant_users').select('user_id').eq('tenant_id', options.tenantId).in('role', ['owner','admin','sales']).order('created_at').limit(1).maybeSingle(); ownerId = member?.user_id || null; }
    if (sourceType === 'lead') await options.admin.from('leads').update({ status: 'qualified', assigned_to: ownerId, updated_at: new Date().toISOString() }).eq('tenant_id', options.tenantId).eq('id', sourceId);
    const { data: existingLink } = await options.admin.from('revenue_lifecycle_links').select('target_id').eq('tenant_id', options.tenantId).eq('source_type', sourceType).eq('source_id', sourceId).eq('target_type', 'deal').eq('relationship', 'converted_to').limit(1).maybeSingle();
    dealId = existingLink?.target_id || null;
    if (!dealId) {
      const sourceName = sourceRecord?.business_name || sourceRecord?.contact_name || sourceRecord?.full_name || sourceRecord?.name || options.sender;
      const { data: deal, error: dealError } = await options.admin.from('deals').insert({ tenant_id: options.tenantId, name: `${sourceName} — outreach opportunity`, value: 0, currency: 'USD', stage: 'qualification', owner_id: ownerId, source: 'outreach', metadata: { lead_id: enrollment.lead_id || null, contact_id: enrollment.contact_id || null, client_id: enrollment.client_id || null, outreach_event_id: event?.id || null, sequence_id: enrollment.sequence_id } }).select('id').single();
      if (dealError) throw dealError;
      dealId = deal.id;
      await options.admin.from('revenue_lifecycle_links').insert({ tenant_id: options.tenantId, source_type: sourceType, source_id: sourceId, target_type: 'deal', target_id: dealId, relationship: 'converted_to', metadata: { outreach_event_id: event?.id || null } });
    }
  }
  return { matched: true, classification, eventType, dealId };
}
