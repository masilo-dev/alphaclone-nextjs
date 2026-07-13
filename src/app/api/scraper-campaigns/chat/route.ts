import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { callScraperService } from '@/lib/scraper/scraperServiceClient';
import { parseLeadIntentFromChat, type ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';
import { filterSmbLeads } from '@/lib/scraper/smbLeadFilters';
import {
  broadenIntentForRetry,
  getNicheSearchAdvice,
} from '@/lib/scraper/nicheSearchAdvisor';
import {
  fallbackLocalSearch,
  logLeadRun,
  scraperRunAccepted,
  saveLeadsToCrm,
  startLeadOutreachAutomation,
  triggerNexusAutomation,
  prepareLeadsForOutreach,
  markLeadsAsContacted,
} from '@/lib/scraper/leadFinderAutomation';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

async function createAndRunCampaign(
  tenantId: string,
  userId: string,
  intent: ParsedLeadIntent
) {
  const supabase = createSupabaseAdminClient();

  const { data: campaign, error } = await supabase
    .from('scraper_campaigns')
    .insert({
      tenant_id: tenantId,
      name: intent.name,
      status: 'active',
      source: intent.sources[0],
      sources: intent.sources,
      location: intent.location,
      industry: intent.industry,
      title_keywords: intent.title_keywords,
      company_size_range: intent.company_size_range,
      exclude_domains: intent.exclude_domains,
      daily_limit: intent.daily_limit,
      min_score_threshold: intent.min_score_threshold,
      enrichment_level: intent.enrichment_level,
      scoring_rules: {
        target_language: intent.target_language,
        exclude_keywords: intent.exclude_keywords,
        smb_only: intent.smb_only,
        niche: intent.niche,
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
    market: formatSearchLocation(intent),
    category: formatSearchNiche(intent),
    status: 'running',
    sourceCount: 0,
    enrichedCount: 0,
    createdCount: 0,
  });

  let scraperStarted = false;
  try {
    const scraperRes = await callScraperService('/api/scraper/campaign/run', {
      method: 'POST',
      body: {
        campaign_id: campaign.id,
        tenant_id: tenantId,
        user_id: userId,
      },
    });
    scraperStarted = await scraperRunAccepted(scraperRes);
    if (!scraperStarted) {
      console.warn('[chat] Scraper service unavailable or invalid response');
    }
  } catch (err) {
    console.warn('[chat] Scraper service call failed:', err);
  }

  let fallbackCount = 0;
  try {
    fallbackCount = await fallbackLocalSearch(tenantId, campaign.id, intent);
  } catch (err) {
    console.warn('[chat] Local fallback search failed:', err);
  }

  const completed = fallbackCount > 0 && !scraperStarted;
  await logLeadRun({
    tenantId,
    campaignId: campaign.id,
    market: formatSearchLocation(intent),
    category: formatSearchNiche(intent),
    status: completed ? 'completed' : 'running',
    sourceCount: fallbackCount,
    enrichedCount: fallbackCount,
    createdCount: fallbackCount,
  });
  await supabase.from('lead_campaign_runs').insert({
    campaign_id: campaign.id,
    tenant_id: tenantId,
    status: completed ? 'completed' : scraperStarted ? 'running' : fallbackCount > 0 ? 'completed' : 'running',
    current_step: fallbackCount > 0 ? (scraperStarted ? 'scraping' : 'done') : 'scraping',
    progress: fallbackCount > 0 ? (scraperStarted ? 40 : 100) : scraperStarted ? 15 : 10,
    source_count: fallbackCount,
    enriched_count: fallbackCount,
  });

  return campaign;
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

    const { user } = await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

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
      const broadened = broadenIntentForRetry(providedIntent, retryAttempt);
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
      const intent = providedIntent;
      if (!intent) return NextResponse.json({ error: 'Missing intent' }, { status: 400 });
      const campaign = await createAndRunCampaign(tenantId, user.id, intent);
      return NextResponse.json({
        reply: `Searching SMB ${intent.niche || intent.industry?.[0] || 'businesses'} — skipping big corporations. Sources: ${intent.sources.join(', ')}.`,
        campaignId: campaign.id,
        intent,
        status: 'running',
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
