import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { callScraperService } from '@/lib/scraper/scraperServiceClient';
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
import { runCampaignOnPlatform } from '@/lib/scraper/scraperPlatform';

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

  // Prefer full in-process free search (OSM / Wikidata / DuckDuckGo / Foursquare).
  // External scraper is optional — never block product UX on it.
  let leadCount = 0;
  let mode: 'in-process' | 'external' = 'in-process';
  try {
    const platform = await runCampaignOnPlatform(tenantId, userId, campaign.id);
    leadCount = platform.leadCount;
    mode = platform.mode;
  } catch (err) {
    console.warn('[chat] In-process lead search failed:', err);
    try {
      const scraperRes = await callScraperService('/api/scraper/campaign/run', {
        method: 'POST',
        body: {
          campaign_id: campaign.id,
          tenant_id: tenantId,
          user_id: userId,
        },
      });
      if (scraperRes.ok) {
        mode = 'external';
      }
    } catch (externalErr) {
      console.warn('[chat] External scraper also failed:', externalErr);
    }
  }

  return {
    ...campaign,
    leadCount,
    mode,
    searchStatus: leadCount > 0 ? 'completed' : 'running',
  };
}

async function fetchCampaignLeads(tenantId: string, campaignId: string, minScore?: number) {
  const supabase = createSupabaseAdminClient();
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
      try {
        const scraperRes = await callScraperService(`/api/scraper/status/${campaignId}`);
        if (scraperRes.ok) {
          return NextResponse.json({ status: await scraperRes.json() });
        }
      } catch {
        // DB fallback
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
      const { error } = await supabase
        .from('scraper_leads')
        .update({ status: 'qualified' })
        .eq('tenant_id', tenantId)
        .in('id', leadIds);
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
        message: `Automation queued: ${channel} outreach via Nexus + event bus (works on Vercel & Railway crons)`,
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
