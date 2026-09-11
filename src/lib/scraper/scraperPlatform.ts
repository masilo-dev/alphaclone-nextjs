/**
 * In-platform lead scraper — runs inside alphaclone-web on Railway (no separate scraper URL).
 */
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';
import {
  fallbackLocalSearch,
  runInProcessLeadCampaign,
} from '@/lib/scraper/leadFinderAutomation';
import { recordLeadFinderSearch } from '@/lib/scraper/leadFinderLearning';

export function intentFromCampaign(campaign: Record<string, unknown>): ParsedLeadIntent {
  const scoring = (campaign.scoring_rules as Record<string, unknown>) || {};
  const location = (campaign.location as ParsedLeadIntent['location']) || {};
  const industry = campaign.industry as string[] | undefined;
  return {
    name: String(campaign.name || 'Campaign run'),
    sources: (campaign.sources as string[]) || ['directory', 'website'],
    industry: industry || [],
    location,
    title_keywords: (campaign.title_keywords as string[]) || [],
    company_size_range:
      (campaign.company_size_range as ParsedLeadIntent['company_size_range']) || { min: 1, max: 200 },
    exclude_domains: (campaign.exclude_domains as string[]) || [],
    exclude_keywords: (scoring.exclude_keywords as string[]) || [],
    min_score_threshold: Number(campaign.min_score_threshold) || 45,
    daily_limit: Number(campaign.daily_limit) || 40,
    enrichment_level: campaign.enrichment_level === 'basic' ? 'basic' : 'full',
    target_language: String(scoring.target_language || 'en'),
    summary: String(campaign.name || 'Lead search'),
    search_query: String(campaign.name || ''),
    niche: String(scoring.niche || (Array.isArray(industry) ? industry[0] : '') || ''),
    smb_only: scoring.smb_only !== false,
  };
}

export type PlatformCampaignRunResult = {
  status: 'completed' | 'started' | 'failed';
  campaignId: string;
  leadCount: number;
  mode: 'in-process';
};

export async function runCampaignOnPlatform(
  tenantId: string,
  userId: string,
  campaignId: string
): Promise<PlatformCampaignRunResult> {
  const supabase = createSupabaseAdminClient();

  const { data: campaign, error } = await supabase
    .from('scraper_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !campaign) {
    throw new Error('Campaign not found');
  }

  const intent = intentFromCampaign(campaign as Record<string, unknown>);
  let leadCount = 0;

  try {
    const result = await runInProcessLeadCampaign(tenantId, campaignId, intent);
    leadCount = result.count;
  } catch (err) {
    console.warn('[scraperPlatform] In-process search failed, directory fallback:', err);
    try {
      leadCount = await fallbackLocalSearch(tenantId, campaignId, intent);
    } catch (fallbackErr) {
      console.warn('[scraperPlatform] Directory fallback failed:', fallbackErr);
    }
  }

  // Final status row (step progress is already streamed by runInProcessLeadCampaign)
  const runPayload = {
    campaign_id: campaignId,
    tenant_id: tenantId,
    status: leadCount > 0 ? 'completed' : 'failed',
    current_step: leadCount > 0 ? 'done' : 'failed',
    progress: leadCount > 0 ? 100 : 0,
    source_count: leadCount,
    enriched_count: leadCount,
    created_count: leadCount,
    run_at: new Date().toISOString(),
  };
  await supabase.from('lead_campaign_runs').insert(runPayload);
  await supabase.from('lead_run_log').insert(runPayload).then((r: { error: { message: string } | null }) => {
    if (r.error) console.warn('[lead_run_log] insert failed:', r.error.message);
  });

  void userId;

  const loc = intent.location;
  const locationLabel = [loc?.city, loc?.country].filter(Boolean).join(', ') || loc?.city || '';
  await recordLeadFinderSearch(tenantId, {
    niche: intent.niche || intent.industry?.[0] || '',
    location: locationLabel,
    leadCount,
    campaignId,
    intent,
  }).catch((err) => console.warn('[scraperPlatform] learn record failed:', err));

  return {
    status: leadCount > 0 ? 'completed' : 'started',
    campaignId,
    leadCount,
    mode: 'in-process',
  };
}

export async function getCampaignStatusOnPlatform(tenantId: string, campaignId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: run } = await supabase
    .from('lead_campaign_runs')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('tenant_id', tenantId)
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: leadCount } = await supabase
    .from('scraper_leads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('campaign_id', campaignId);

  if (leadCount && leadCount > 0) {
    return {
      ...(run || {}),
      status: 'completed',
      progress: 100,
      current_step: 'done',
      source_count: leadCount,
      enriched_count: leadCount,
      mode: 'in-process',
    };
  }

  return {
    ...(run || { status: 'unknown', progress: 0, current_step: 'init' }),
    mode: 'in-process',
  };
}
