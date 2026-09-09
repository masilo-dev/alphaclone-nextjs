import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  parseLeadIntentHeuristic,
  parseLeadIntentFromChat,
  type ParsedLeadIntent,
} from '@/lib/scraper/parseLeadIntent';
import { filterSmbLeads } from '@/lib/scraper/smbLeadFilters';
import {
  broadenIntentForRetry,
  getNicheSearchAdvice,
} from '@/lib/scraper/nicheSearchAdvisor';
import {
  logLeadRun,
  saveLeadsToCrm,
  startLeadOutreachAutomation,
  triggerNexusAutomation,
  prepareLeadsForOutreach,
  markLeadsAsContacted,
  formatSearchLocation,
  formatSearchNiche,
} from '@/lib/scraper/leadFinderAutomation';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function normalizeRunIntent(intent: Partial<ParsedLeadIntent> | undefined): ParsedLeadIntent {
  const seed = parseLeadIntentHeuristic(
    intent?.search_query ||
      intent?.summary ||
      intent?.niche ||
      intent?.industry?.[0] ||
      'local business leads'
  );
  const location = { ...(seed.location || {}), ...(intent?.location || {}) };

  return {
    ...seed,
    ...intent,
    name: intent?.name || seed.name,
    sources: Array.isArray(intent?.sources) && intent.sources.length ? intent.sources : ['website', 'directory'],
    industry: Array.isArray(intent?.industry) ? intent.industry : seed.industry,
    location: {
      ...location,
      radius_km: Math.min(Math.max(Number(location.radius_km || 25), 1), 100),
    },
    title_keywords: Array.isArray(intent?.title_keywords) && intent.title_keywords.length
      ? intent.title_keywords
      : seed.title_keywords,
    company_size_range: intent?.company_size_range || seed.company_size_range,
    exclude_domains: Array.isArray(intent?.exclude_domains) ? intent.exclude_domains : seed.exclude_domains,
    exclude_keywords: Array.isArray(intent?.exclude_keywords) ? intent.exclude_keywords : seed.exclude_keywords,
    min_score_threshold: Number(intent?.min_score_threshold || seed.min_score_threshold || 45),
    daily_limit: Math.min(Math.max(Number(intent?.daily_limit || seed.daily_limit || 40), 1), 80),
    enrichment_level: intent?.enrichment_level === 'basic' ? 'basic' : 'full',
    target_language: intent?.target_language || seed.target_language || 'en',
    summary: intent?.summary || seed.summary,
    search_query: intent?.search_query || seed.search_query,
    niche: intent?.niche || seed.niche,
    smb_only: intent?.smb_only !== false,
  };
}

async function createAndRunCampaign(
  tenantId: string,
  userId: string,
  intent: ParsedLeadIntent
) {
  const supabase = createSupabaseAdminClient();
  const safeIntent = normalizeRunIntent(intent);
  const sources = safeIntent.sources.length ? safeIntent.sources : ['website', 'directory'];

  const { data: campaign, error } = await supabase
    .from('scraper_campaigns')
    .insert({
      tenant_id: tenantId,
      name: safeIntent.name,
      status: 'active',
      source: sources[0] || 'directory',
      sources,
      location: {
        ...safeIntent.location,
        radius_km: safeIntent.location?.radius_km || 25,
      },
      industry: safeIntent.industry,
      title_keywords: safeIntent.title_keywords,
      company_size_range: safeIntent.company_size_range,
      exclude_domains: safeIntent.exclude_domains,
      daily_limit: safeIntent.daily_limit || 40,
      min_score_threshold: safeIntent.min_score_threshold,
      enrichment_level: safeIntent.enrichment_level,
      scoring_rules: {
        target_language: safeIntent.target_language,
        exclude_keywords: safeIntent.exclude_keywords,
        smb_only: safeIntent.smb_only,
        niche: safeIntent.niche,
        free_only: true,
        reach_based: true,
      },
      created_by: userId,
    })
    .select()
    .single();

  if (error || !campaign) {
    throw new Error(error?.message || 'Failed to create campaign');
  }

  await logLeadRun({
    tenantId,
    campaignId: campaign.id,
    market: formatSearchLocation(safeIntent),
    category: formatSearchNiche(safeIntent),
    status: 'running',
    sourceCount: 0,
    enrichedCount: 0,
    createdCount: 0,
  });

  // The chat UI is a compatibility surface, not a second scraper. Its legacy
  // campaign only records the conversation and points at the canonical queue.
  const searchSources = ['openstreetmap', 'wikidata', 'searxng', 'website'] as const;
  const { data: search, error: searchError } = await supabase.from('lead_searches').insert({
    workspace_id: tenantId, created_by: userId, name: safeIntent.name,
    search_type: 'businesses_by_location', query: safeIntent.search_query || safeIntent.niche || safeIntent.name,
    business_keywords: [safeIntent.niche, ...safeIntent.industry].filter(Boolean),
    location: [safeIntent.location?.city, safeIntent.location?.country].filter(Boolean).join(', '),
    city: safeIntent.location?.city || null, country: safeIntent.location?.country || null,
    industry: safeIntent.industry[0] || null, source_filters: searchSources,
    exclusions: { keywords: safeIntent.exclude_keywords, domains: safeIntent.exclude_domains, locations: [] },
    result_limit: safeIntent.daily_limit, status: 'queued',
  }).select().single();
  if (searchError || !search) throw new Error(searchError?.message || 'Failed to queue canonical lead search');
  const { error: jobError } = await supabase.from('lead_search_jobs').insert({
    tenant_id: tenantId, user_id: userId, workspace_id: tenantId, created_by: userId, search_id: search.id,
    niche: safeIntent.niche || safeIntent.name, location: [safeIntent.location?.city, safeIntent.location?.country].filter(Boolean).join(', ') || null,
    sort_by: 'default', use_playwright: false, job_type: 'lead.search.start', source_type: 'orchestrator',
    idempotency_key: `chat.lead.search:${search.id}`, metadata: { source: 'chat_assistant', free_only: true },
  });
  if (jobError) throw new Error(jobError.message);
  await supabase.from('scraper_campaigns').update({ canonical_search_id: search.id, status: 'active' }).eq('id', campaign.id).eq('tenant_id', tenantId);

  return {
    ...campaign,
    leadCount: 0,
    mode: 'queued',
    searchStatus: 'queued',
  };
}

async function fetchCampaignLeads(tenantId: string, campaignId: string, minScore?: number) {
  const supabase = createSupabaseAdminClient();
  const { data: campaign } = await supabase.from('scraper_campaigns').select('canonical_search_id')
    .eq('tenant_id', tenantId).eq('id', campaignId).maybeSingle();
  if (campaign?.canonical_search_id) {
    let canonical = supabase.from('lead_candidates').select('*').eq('workspace_id', tenantId)
      .eq('search_id', campaign.canonical_search_id).order('final_score', { ascending: false }).limit(100);
    if (minScore) canonical = canonical.gte('final_score', minScore);
    const { data, error } = await canonical;
    if (error) throw error;
    return data || [];
  }
  let query = supabase
    .from('scraper_leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('campaign_id', campaignId)
    .order('score', { ascending: false })
    .limit(100);

  if (minScore) query = query.gte('score', minScore);
  const { data, error } = await query;
  if (error) throw error;
  return filterSmbLeads(data || []);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenantId,
      messages = [],
      action = 'chat',
      campaignId,
      intent: providedIntent,
      retryAttempt = 0,
    } = body as {
      tenantId: string;
      messages?: ChatMessage[];
      action?: 'chat' | 'run' | 'status' | 'leads' | 'qualify' | 'retry_niche' | 'save' | 'automate' | 'nexus' | 'prepare_outreach' | 'mark_contacted';
      campaignId?: string;
      intent?: ParsedLeadIntent;
      leadIds?: string[];
      retryAttempt?: number;
      autoSend?: boolean;
    };

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const { user, admin: supabase } = await requireTenantAccess(tenantId);

    if (action === 'status' && campaignId) {
      const { data: bridge } = await supabase.from('scraper_campaigns').select('canonical_search_id')
        .eq('tenant_id', tenantId).eq('id', campaignId).maybeSingle();
      if (bridge?.canonical_search_id) {
        const { data: canonical } = await supabase.from('lead_searches').select('*')
          .eq('workspace_id', tenantId).eq('id', bridge.canonical_search_id).maybeSingle();
        if (canonical) return NextResponse.json({ status: canonical });
      }
      const { data: run } = await supabase
        .from('lead_campaign_runs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('run_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: leadCount } = await supabase
        .from('scraper_leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('campaign_id', campaignId);

      if (leadCount && leadCount > 0) {
        return NextResponse.json({
          status: {
            ...(run || {}),
            status: 'completed',
            progress: 100,
            current_step: 'done',
            source_count: leadCount,
            enriched_count: leadCount,
          },
        });
      }

      return NextResponse.json({ status: run || { status: 'unknown', progress: 0 } });
    }

    if (action === 'leads' && campaignId) {
      const leads = await fetchCampaignLeads(tenantId, campaignId, body.minScore as number | undefined);
      return NextResponse.json({ leads });
    }

    if (action === 'qualify' && campaignId) {
      const leadIds = (body.leadIds as string[]) || [];
      if (!leadIds.length) return NextResponse.json({ error: 'No lead IDs' }, { status: 400 });
      const { data: bridge } = await supabase.from('scraper_campaigns').select('canonical_search_id')
        .eq('tenant_id', tenantId).eq('id', campaignId).maybeSingle();
      const target = bridge?.canonical_search_id
        ? supabase.from('lead_candidates').update({ review_status: 'reviewing', updated_at: new Date().toISOString() }).eq('workspace_id', tenantId).eq('search_id', bridge.canonical_search_id).in('id', leadIds)
        : supabase.from('scraper_leads').update({ status: 'qualified' }).eq('tenant_id', tenantId).in('id', leadIds);
      const { error } = await target;
      if (error) throw error;
      return NextResponse.json({ success: true, qualified: leadIds.length });
    }

    if (action === 'save' && campaignId) {
      const leadIds = (body.leadIds as string[]) || [];
      const allLeads = await fetchCampaignLeads(tenantId, campaignId);
      const toSave = allLeads.filter((l) => l.id && leadIds.includes(l.id));
      const created = await saveLeadsToCrm(
        tenantId,
        user.id,
        toSave as Array<Record<string, unknown>>
      );
      return NextResponse.json({ success: true, created, count: created.filter((c) => c.crm_lead_id).length });
    }

    if (action === 'prepare_outreach' && campaignId) {
      const leadIds = (body.leadIds as string[]) || [];
      if (!leadIds.length) return NextResponse.json({ error: 'No lead IDs' }, { status: 400 });
      const prepared = await prepareLeadsForOutreach(tenantId, user.id, campaignId, leadIds);
      return NextResponse.json({ success: true, prepared, count: prepared.length });
    }

    if (action === 'mark_contacted') {
      const leadIds = (body.leadIds as string[]) || [];
      if (!leadIds.length) return NextResponse.json({ error: 'No lead IDs' }, { status: 400 });
      const result = await markLeadsAsContacted(tenantId, leadIds);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'automate') {
      const leadIds = (body.leadIds as string[]) || [];
      const channel = (body.channel as 'email' | 'sms' | 'both') || 'email';
      const result = await startLeadOutreachAutomation(tenantId, user.id, leadIds, channel);
      return NextResponse.json({
        success: true,
        message: `Automation queued: ${channel} outreach (event bus + cron). Send still requires review unless you approved it.`,
        result,
      });
    }

    if (action === 'nexus') {
      const result = await triggerNexusAutomation(tenantId, user.id, {
        autoSend: body.autoSend === true,
        outreachContext: 'Lead Finder Nexus automation',
      });
      return NextResponse.json({ success: true, result });
    }

    if (action === 'retry_niche' && providedIntent) {
      const broadened = broadenIntentForRetry(normalizeRunIntent(providedIntent), retryAttempt);
      const campaign = await createAndRunCampaign(tenantId, user.id, broadened);
      const advice = getNicheSearchAdvice(broadened, 0, retryAttempt);
      return NextResponse.json({
        reply: advice,
        intent: broadened,
        campaignId: campaign.id,
        status: 'running',
        retryAttempt: retryAttempt + 1,
      });
    }

    if (action === 'run') {
      const intent = normalizeRunIntent(providedIntent);
      if (!intent) return NextResponse.json({ error: 'Missing intent' }, { status: 400 });
      const campaign = await createAndRunCampaign(tenantId, user.id, intent);
      const nicheLabel = intent.niche || intent.industry?.[0] || 'businesses';
      const radius = intent.location?.radius_km || 25;
      const count = campaign.leadCount || 0;
      return NextResponse.json({
        reply:
          count > 0
            ? `Found ${count} contactable ${nicheLabel} leads within ~${radius} km — phone/email required, auto-enriched with decision makers where possible. Select → Save to CRM.`
            : `Searching ${nicheLabel} within ~${radius} km, then auto-enriching websites for emails, phones, and decision makers (Railway Playwright). Vague website-only rows are dropped.`,
        campaignId: campaign.id,
        intent,
        status: campaign.searchStatus || (count > 0 ? 'completed' : 'running'),
        leadCount: count,
        mode: campaign.mode,
        sourceStats: undefined,
      });
    }

    const userMessages = messages.filter((m) => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1]?.content?.trim();
    if (!lastUser) return NextResponse.json({ error: 'No user message' }, { status: 400 });

    const { intent, assistantReply } = await parseLeadIntentFromChat(lastUser, messages.slice(0, -1));

    if (campaignId && action === 'chat') {
      const leads = await fetchCampaignLeads(tenantId, campaignId);
      if (leads.length === 0 && providedIntent) {
        const advice = getNicheSearchAdvice(providedIntent, 0, retryAttempt);
        return NextResponse.json({ reply: advice, intent: providedIntent, suggestRetry: true, retryAttempt });
      }
    }

    return NextResponse.json({
      reply: assistantReply,
      intent,
      status: 'awaiting_confirmation',
    });
  } catch (error) {
    return routeErrorResponse(error, 'Lead finder chat failed');
  }
}
