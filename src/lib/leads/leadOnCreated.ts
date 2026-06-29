import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Post-create pipeline: enrich, log first touchpoint, schedule 2-day follow-up.
 */
export async function onLeadCreated(options: {
  tenantId: string;
  userId: string;
  leadId: string;
  businessName?: string;
}): Promise<{ enriched: boolean; followUpScheduled: boolean }> {
  const admin = createSupabaseAdminClient();
  let enriched = false;
  let followUpScheduled = false;

  try {
    const { enrichLeadWebsite } = await import('@/lib/scraper/enrichmentPipeline');
    const { data: lead } = await admin
      .from('leads')
      .select('id, website, business_name, email, phone, notes')
      .eq('id', options.leadId)
      .eq('tenant_id', options.tenantId)
      .maybeSingle();

    if (lead?.website) {
      const result = await enrichLeadWebsite(String(lead.website), 15000);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (result.emails?.length && !lead.email) patch.email = result.emails[0];
      if (result.phone && !lead.phone) patch.phone = result.phone;
      const enrichmentNote = [
        lead.notes,
        result.emails?.length ? `Enriched emails: ${result.emails.join(', ')}` : null,
        result.phone ? `Enriched phone: ${result.phone}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      if (enrichmentNote) patch.notes = enrichmentNote;

      if (Object.keys(patch).length > 1) {
        await admin.from('leads').update(patch).eq('id', options.leadId);
        enriched = true;
      }
    }

    await admin.from('activity_logs').insert({
      tenant_id: options.tenantId,
      user_id: options.userId,
      action: 'lead_momentum_started',
      entity_type: 'lead',
      entity_id: options.leadId,
      metadata: { source: 'auto_on_create', business_name: options.businessName || lead?.business_name },
    });

    const followUpAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const { error: taskErr } = await admin.from('tasks').insert({
      tenant_id: options.tenantId,
      title: `Follow up: ${options.businessName || lead?.business_name || 'new lead'}`,
      description: 'Auto-scheduled 2-day follow-up from lead creation.',
      related_to_lead: options.leadId,
      priority: 'medium',
      status: 'todo',
      due_date: followUpAt,
      created_by: options.userId,
      metadata: { auto_follow_up: true, sequence_step: 2 },
    });
    followUpScheduled = !taskErr;
  } catch (err) {
    console.error('[onLeadCreated]', options.leadId, err);
  }

  return { enriched, followUpScheduled };
}
