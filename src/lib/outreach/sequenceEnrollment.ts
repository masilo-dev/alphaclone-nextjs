type AudienceRules = { source?: 'leads'|'contacts'|'clients'; rules?: { status?: string; industry?: string; country?: string; search?: string } };

export async function enrollSequenceAudience(admin: any, tenantId: string, sequenceId: string, segmentId: string) {
  const { data: sequenceSteps, error: stepError } = await admin.from('outreach_sequence_steps').select('delay_minutes,channel')
    .eq('tenant_id', tenantId).eq('sequence_id', sequenceId).eq('status', 'active').order('step_order', { ascending: true });
  if (stepError) throw stepError;
  if (!sequenceSteps?.length) throw new Error('At least one active sequence step is required');
  const firstStepAt = new Date(Date.now() + Math.max(0, Number(sequenceSteps[0].delay_minutes || 0)) * 60_000).toISOString();
  const channels = new Set(sequenceSteps.map((step: { channel: string }) => step.channel));
  const { data: segment, error } = await admin.from('marketing_segments').select('rules,status').eq('tenant_id', tenantId).eq('id', segmentId).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  if (!segment || segment.status !== 'active') throw new Error('An active audience is required before sequence activation');
  const definition = (segment.rules || {}) as AudienceRules;
  const rules = definition.rules || {};
  const source = definition.source || 'leads';
  const table = source === 'contacts' ? 'contacts' : source === 'clients' ? 'business_clients' : 'leads';
  const fields = source === 'contacts' ? 'id,email,phone,linkedin_url,full_name,status' : source === 'clients' ? 'id,email,phone,name,industry' : 'id,email,phone,linkedin_url,business_name,status,industry';
  let query = admin.from(table).select(fields).eq('tenant_id', tenantId).limit(10_000);
  if (source === 'contacts') query = query.is('deleted_at', null).neq('status', 'unsubscribed').neq('status', 'bounced');
  if (source === 'clients') query = query.eq('is_active', true);
  if (rules.status && source !== 'clients') query = query.eq('status', rules.status);
  if (rules.industry && source !== 'contacts') query = query.ilike('industry', `%${rules.industry}%`);
  if (rules.country && source === 'leads') query = query.ilike('location', `%${rules.country}%`);
  if (rules.search) { const term = rules.search.replace(/[,%()]/g, ' ').trim(); const columns = source === 'contacts' ? ['full_name','email'] : source === 'clients' ? ['name','email'] : ['business_name','email']; query = query.or(columns.map((column) => `${column}.ilike.%${term}%`).join(',')); }
  const { data: recipients, error: recipientError } = await query;
  if (recipientError) throw recipientError;
  const rows = (recipients || []).filter((recipient: any) => {
    const hasEmail = Boolean(String(recipient.email || '').trim());
    const hasPhone = Boolean(String(recipient.phone || '').trim());
    const hasLinkedIn = Boolean(String(recipient.linkedin_url || '').trim());
    return (channels.has('email') && hasEmail) || ((channels.has('sms') || channels.has('whatsapp') || channels.has('call')) && hasPhone) || (channels.has('linkedin') && hasLinkedIn) || channels.has('task');
  }).map((recipient: any) => {
    const email = String(recipient.email || '').trim().toLowerCase() || null;
    const phone = String(recipient.phone || '').trim() || null;
    const linkedin = String(recipient.linkedin_url || '').trim() || null;
    return { tenant_id: tenantId, sequence_id: sequenceId, contact_id: source === 'contacts' ? recipient.id : null, lead_id: source === 'leads' ? recipient.id : null, client_id: source === 'clients' ? recipient.id : null, normalized_recipient: email || phone?.replace(/[^\d+]/g, '') || linkedin?.toLowerCase() || `${source}:${recipient.id}`, email, phone, linkedin_url: linkedin, current_step_order: 0, status: 'active', next_step_at: firstStepAt, metadata: { source, source_name: recipient.full_name || recipient.name || recipient.business_name || null } };
  });
  if (!rows.length) return { enrolled: 0 };
  const { data, error: enrollmentError } = await admin.from('outreach_sequence_enrollments').upsert(rows, { onConflict: 'tenant_id,sequence_id,normalized_recipient', ignoreDuplicates: true }).select('id');
  if (enrollmentError) throw enrollmentError;
  return { enrolled: data?.length || 0 };
}
