import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { customer360Service } from '@/services/intelligence/customer360Service';
import { searchEmailContext } from '@/lib/scraper/emailLeadAutoSearch';
import { processContent } from '@/services/engine/ProcessingEngine';
import { callScraperService } from '@/lib/scraper/scraperServiceClient';
import { parseLeadIntentFromChat } from '@/lib/scraper/parseLeadIntent';
import { upsertMemory } from '@/services/nexusMemoryService';
import { qualifyLead, type QualityTier } from '@/lib/leadQualification';

export async function bonnieGetCustomer360(tenantId: string, email: string) {
  const admin = createSupabaseAdminClient();
  const profile = await customer360Service.buildProfile(admin, tenantId, email.trim());
  return profile;
}

export async function bonnieGetIntegrationHealth(tenantId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const checks = await Promise.all([
    admin.from('facebook_integrations').select('page_name,is_active,updated_at').eq('tenant_id', tenantId),
    admin.from('whatsapp_integrations').select('phone_number_id,is_active,updated_at').eq('tenant_id', tenantId),
    admin.from('microsoft_connections').select('microsoft_email,updated_at').eq('user_id', userId).maybeSingle(),
    admin.from('linkedin_integrations').select('linkedin_member_id,is_active').eq('tenant_id', tenantId).limit(3),
    admin.from('tenants').select('stripe_connect_id,stripe_connect_onboarded').eq('id', tenantId).maybeSingle(),
  ]);

  const [fb, wa, ms, li, tenantRow] = checks;
  const issues: string[] = [];

  type ActiveIntegrationRow = { is_active?: boolean | null; page_name?: string | null };

  if (!((fb.data || []) as ActiveIntegrationRow[]).some((r) => r.is_active)) {
    issues.push('Facebook not connected — lead ads and social publish limited.');
  }
  if (!((wa.data || []) as ActiveIntegrationRow[]).some((r) => r.is_active)) {
    issues.push('WhatsApp not connected — messaging unavailable.');
  }
  if (!ms.data?.microsoft_email) issues.push('Microsoft 365 not connected — mail/calendar tools limited.');
  if (!((li.data || []) as ActiveIntegrationRow[]).some((r) => r.is_active)) {
    issues.push('LinkedIn not connected — LinkedIn post tools limited.');
  }

  return {
    facebook: {
      connected: ((fb.data || []) as ActiveIntegrationRow[])
        .filter((r) => r.is_active)
        .map((r) => r.page_name),
    },
    whatsapp: { connected: ((wa.data || []) as ActiveIntegrationRow[]).some((r) => r.is_active) },
    microsoft: { connected: Boolean(ms.data?.microsoft_email), email: ms.data?.microsoft_email || null },
    linkedin: { connected: ((li.data || []) as ActiveIntegrationRow[]).some((r) => r.is_active) },
    stripe: {
      connected: Boolean(tenantRow.data?.stripe_connect_id),
      onboarded: Boolean(tenantRow.data?.stripe_connect_onboarded),
    },
    issues,
    healthy: issues.length === 0,
  };
}

export async function bonnieListScraperCampaigns(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('scraper_campaigns')
    .select('id,name,status,industry,location,min_score_threshold,daily_limit,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function bonnieRunScraperCampaign(tenantId: string, userId: string, campaignId: string) {
  const admin = createSupabaseAdminClient();
  const { data: campaign, error } = await admin
    .from('scraper_campaigns')
    .select('id,name,status')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .single();
  if (error || !campaign) throw new Error('Campaign not found');

  const scraperRes = await callScraperService('/api/scraper/campaign/run', {
    method: 'POST',
    body: { campaign_id: campaignId, tenant_id: tenantId, user_id: userId },
  });
  if (!scraperRes.ok) {
    const text = await scraperRes.text();
    throw new Error(`Scraper run failed: ${text.slice(0, 200)}`);
  }
  const result = await scraperRes.json();
  return { campaign, ...result };
}

export async function bonnieCreateScraperCampaignFromChat(
  tenantId: string,
  userId: string,
  message: string
) {
  const { intent } = await parseLeadIntentFromChat(message);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('scraper_campaigns')
    .insert({
      tenant_id: tenantId,
      name: intent.name || 'Bonnie lead campaign',
      status: 'paused',
      source: intent.sources[0] || 'website',
      sources: intent.sources,
      location: intent.location,
      industry: intent.industry,
      title_keywords: intent.title_keywords,
      company_size_range: intent.company_size_range,
      exclude_domains: intent.exclude_domains,
      daily_limit: intent.daily_limit,
      enrichment_level: intent.enrichment_level,
      scoring_rules: { exclude_keywords: intent.exclude_keywords },
      min_score_threshold: intent.min_score_threshold,
      created_by: userId,
    })
    .select('id,name,status,min_score_threshold')
    .single();
  if (error) throw new Error(error.message);

  await upsertMemory(tenantId, {
    category: 'workflow',
    key: 'last_scraper_campaign',
    value: { campaign_id: data.id, intent: intent as unknown as Record<string, unknown> },
    source: 'agent',
  });

  return { campaign: data, intent };
}

export async function bonnieSearchEmailLeadContext(
  tenantId: string,
  fromEmail: string,
  subject?: string
) {
  return searchEmailContext(tenantId, fromEmail, { subject, queueEnrichment: true });
}

export async function bonnieIngestContentToLead(
  tenantId: string,
  rawContent: string,
  opts: { source?: string; author_name?: string; author_contact?: string } = {}
) {
  const admin = createSupabaseAdminClient();
  const processed = processContent(rawContent);
  const structured = processed.structured_data as Record<string, unknown>;

  const { data: event, error } = await admin
    .from('ingestion_events')
    .insert({
      tenant_id: tenantId,
      source: opts.source || 'bonnie_paste',
      raw_content: rawContent.slice(0, 8000),
      structured_data: structured,
      author_name: opts.author_name,
      author_contact: opts.author_contact || structured.email || structured.phone,
      intent_score: processed.intent_score,
      intent_label: processed.intent_label,
      keywords_found: processed.keywords_found,
      processed: true,
    })
    .select('id,intent_score,intent_label')
    .single();
  if (error) throw new Error(error.message);

  let leadId: string | null = null;
  const intentLabel = processed.intent_label;
  if (intentLabel === 'high' || intentLabel === 'urgent') {
    const businessName = String(structured.company || structured.business_name || opts.author_name || 'Inbound lead');
    const { data: lead } = await admin
      .from('leads')
      .insert({
        tenant_id: tenantId,
        business_name: businessName,
        email: structured.email ? String(structured.email) : null,
        phone: structured.phone ? String(structured.phone) : null,
        source: 'bonnie_ingest',
        stage: 'lead',
        metadata: { ingestion_event_id: event.id, qualification: qualifyLead(structured, 'general') },
      })
      .select('id')
      .single();
    leadId = lead?.id || null;
  }

  return { event, leadId, processed };
}

export async function bonnieGetAutonomousRules(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('autonomous_runner_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data;
}

export async function bonnieGetProactiveBrief(tenantId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const [overdueInvoices, openTickets, hotLeads, staleDeals, needsResponseMessages] = await Promise.all([
    admin
      .from('business_invoices')
      .select('id,total,client_name,due_date')
      .eq('tenant_id', tenantId)
      .eq('status', 'overdue')
      .limit(5),
    admin
      .from('tickets')
      .select('id,title,priority,status')
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'in_progress', 'waiting'])
      .limit(5),
    admin
      .from('leads')
      .select('id,business_name,stage')
      .eq('tenant_id', tenantId)
      .eq('stage', 'qualified')
      .order('updated_at', { ascending: false })
      .limit(5),
    admin
      .from('deals')
      .select('id,title,value,stage,updated_at')
      .eq('tenant_id', tenantId)
      .in('stage', ['lead', 'qualified', 'proposal', 'negotiation'])
      .order('updated_at', { ascending: true })
      .limit(5),
    admin
      .from('unified_messages')
      .select('id,from_name,subject')
      .eq('tenant_id', tenantId)
      .eq('needs_response', true)
      .eq('archived', false)
      .limit(10),
  ]);

  const items: string[] = [];
  if ((overdueInvoices.data || []).length) {
    items.push(`${overdueInvoices.data!.length} overdue invoice(s) need attention`);
  }
  if ((openTickets.data || []).length) {
    items.push(`${openTickets.data!.length} open support ticket(s)`);
  }
  if ((hotLeads.data || []).length) {
    items.push(`${hotLeads.data!.length} qualified lead(s) ready for outreach`);
  }
  if ((staleDeals.data || []).length) {
    items.push(`${staleDeals.data!.length} deal(s) may be going stale`);
  }
  if ((needsResponseMessages.data || []).length) {
    items.push(`${needsResponseMessages.data!.length} customer message(s) waiting for reply`);
  }

  const integration = await bonnieGetIntegrationHealth(tenantId, userId);

  return {
    attention_items: items,
    overdue_invoices: overdueInvoices.data || [],
    open_tickets: openTickets.data || [],
    qualified_leads: hotLeads.data || [],
    stale_deals: staleDeals.data || [],
    needs_response_messages: needsResponseMessages.data || [],
    integration_issues: integration.issues,
  };
}
