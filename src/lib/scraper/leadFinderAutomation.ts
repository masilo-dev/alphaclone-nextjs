import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { emitBusinessEvent } from '@/lib/automation/emit-event';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';
import { freePlacesService } from '@/services/freePlacesService';
import { filterSmbLeads } from '@/lib/scraper/smbLeadFilters';
import { runLeadStep, type LeadResult } from '@/lib/scraper/freeLeadSearch';
import type { ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';
import type { GeoPoint } from '@/lib/scraper/freeGeoSources';

export function formatSearchNiche(intent: ParsedLeadIntent): string {
  return (
    intent.niche ||
    intent.industry?.[0] ||
    intent.search_query?.split(/\s+in\s+/i)[0]?.trim() ||
    'business'
  );
}

export function formatSearchLocation(intent: ParsedLeadIntent): string {
  const loc = intent.location || {};
  const parts = [loc.city, loc.country].filter(Boolean);
  if (parts.length) return parts.join(', ');
  const fromQuery = intent.search_query?.match(/\bin\s+([^.!?\n]+)/i)?.[1]?.trim();
  if (fromQuery) return fromQuery;
  return 'United States';
}

function normalizeTraceValue(value: unknown): string {
  return String(value || '').trim();
}

export async function logLeadRun(input: {
  tenantId: string;
  campaignId: string;
  market: string;
  category: string;
  status: 'running' | 'completed' | 'failed';
  sourceCount: number;
  enrichedCount: number;
  createdCount: number;
  errors?: Array<{ stage: string; message: string }>;
}) {
  const supabase = createSupabaseAdminClient();
  const payload = {
    tenant_id: input.tenantId,
    campaign_id: input.campaignId,
    status: input.status,
    source_count: input.sourceCount,
    enriched_count: input.enrichedCount,
    created_count: input.createdCount,
    errors: input.errors || [],
    run_at: new Date().toISOString(),
    message: [input.market, input.category].filter(Boolean).join(' · ') || null,
    metadata: { market: input.market, category: input.category },
  };

  const { error } = await supabase.from('lead_run_log').insert(payload);
  if (error) {
    console.warn('[lead_run_log] insert failed:', error.message);
  }
}

export async function scraperRunAccepted(res: Response): Promise<boolean> {
  if (!res.ok) return false;
  try {
    const body = (await res.json()) as { status?: string; campaign_id?: string };
    return body.status === 'started' || Boolean(body.campaign_id);
  } catch {
    return false;
  }
}

export async function fallbackLocalSearch(
  tenantId: string,
  campaignId: string,
  intent: ParsedLeadIntent
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const niche = formatSearchNiche(intent);
  const location = formatSearchLocation(intent);

  const result = await freePlacesService.searchPlacesForLeads(niche, location, undefined, {
    maxResults: 30,
    radiusKm: intent.location?.radius_km || 25,
  });
  const places = result.places || [];
  const smbPlaces = filterSmbLeads(
    places.map((p) => ({
      name: p.businessName,
      company: p.businessName,
      company_website: p.website,
      email: undefined,
      phone: p.phone,
    }))
  );

  if (!smbPlaces.length) return 0;

  const rows = smbPlaces.slice(0, intent.daily_limit).map((p) => {
    const place = places.find((pl) => pl.businessName === p.company) || places[0];
    const sourceId = normalizeTraceValue(
      place?.placeId || `${place?.source || 'directory'}:${place?.businessName}`
    );
    return {
      campaign_id: campaignId,
      tenant_id: tenantId,
      name: place?.businessName || p.company,
      company: place?.businessName || p.company,
      phone: place?.phone,
      company_website: place?.website,
      industry: niche,
      source_id: sourceId,
      source_url: normalizeTraceValue(place?.website),
      source_label: place?.source || 'directory',
      source: 'directory',
      address: place?.formattedAddress || '',
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      score: place?.phone || place?.website ? 55 : 40,
      grade: 'C',
      status: 'new',
      quality_reason: 'SMB local directory search (free OSM/Foursquare fallback)',
      metadata: { free_source: place?.source || 'directory' },
    };
  });

  const { error } = await supabase.from('scraper_leads').insert(rows);
  if (error) throw error;
  await logLeadRun({
    tenantId,
    campaignId,
    market: location,
    category: niche,
    status: 'completed',
    sourceCount: places.length,
    enrichedCount: rows.length,
    createdCount: rows.length,
  });
  return rows.length;
}

function scoreFromLeadResult(lead: LeadResult, radiusKm: number): { score: number; grade: string } {
  let score = 35;
  if (lead.phone) score += 18;
  if (lead.email) score += 22;
  if (lead.website) score += 12;
  if (lead.rating && lead.rating >= 4) score += 8;
  if (lead.address) score += 4;
  if (lead.lat != null && lead.lng != null) score += 6;

  // Reach-based prediction: closer businesses inside the search radius score higher
  if (typeof lead.reach_km === 'number' && Number.isFinite(lead.reach_km)) {
    const ratio = Math.min(Math.max(lead.reach_km / Math.max(radiusKm, 1), 0), 1.5);
    if (ratio <= 0.25) score += 18;
    else if (ratio <= 0.5) score += 14;
    else if (ratio <= 0.85) score += 8;
    else if (ratio <= 1.1) score += 3;
    else score -= 4;
  }

  score = Math.max(0, Math.min(99, Math.round(score)));
  const grade = score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D';
  return { score, grade };
}

async function updateCampaignRunProgress(
  tenantId: string,
  campaignId: string,
  patch: {
    status?: 'running' | 'completed' | 'failed';
    current_step?: string;
    progress?: number;
    source_count?: number;
    enriched_count?: number;
    created_count?: number;
    errors?: Array<{ stage: string; message: string }>;
  }
) {
  const supabase = createSupabaseAdminClient();
  const payload = {
    campaign_id: campaignId,
    tenant_id: tenantId,
    status: patch.status || 'running',
    current_step: patch.current_step || 'scraping',
    progress: patch.progress ?? 10,
    source_count: patch.source_count ?? 0,
    enriched_count: patch.enriched_count ?? 0,
    created_count: patch.created_count ?? 0,
    errors: patch.errors || [],
    run_at: new Date().toISOString(),
  };
  await supabase.from('lead_campaign_runs').insert(payload);
}

/** Full in-app lead search — free sources only by default (OSM / Wikidata / DuckDuckGo). */
export async function runInProcessLeadCampaign(
  tenantId: string,
  campaignId: string,
  intent: ParsedLeadIntent
): Promise<{
  count: number;
  sourceStats: Record<string, number>;
  sourceErrors: Record<string, string>;
  searchCenter: GeoPoint | null;
}> {
  const supabase = createSupabaseAdminClient();
  const niche = formatSearchNiche(intent);
  const location = formatSearchLocation(intent);
  const radiusKm = intent.location?.radius_km || 25;

  let step: 'init' | 'fallbacks' | 'browser' | 'finalize' = 'init';
  let partial: LeadResult[] = [];
  let sourceStats: Record<string, number> = {};
  let sourceErrors: Record<string, string> = {};
  let finalResults: LeadResult[] = [];
  let searchCenter: GeoPoint | null = null;

  await updateCampaignRunProgress(tenantId, campaignId, {
    status: 'running',
    current_step: 'init',
    progress: 8,
  });

  while (true) {
    const result = await runLeadStep({
      step,
      niche,
      location,
      radiusKm,
      sortBy: 'reach_asc',
      usePlaywright: Boolean(process.env.BROWSERBASE_API_KEY),
      partialResults: partial,
      sourceStats,
      sourceErrors,
      searchCenter,
    });
    partial = result.partialResults;
    sourceStats = result.sourceStats;
    sourceErrors = result.sourceErrors;
    searchCenter = result.searchCenter;
    await updateCampaignRunProgress(tenantId, campaignId, {
      status: 'running',
      current_step: result.stepLabel || result.nextStep,
      progress: result.progress,
      source_count: partial.length,
      enriched_count: partial.filter((l) => l.hasContact).length,
      errors: Object.entries(sourceErrors).map(([stage, message]) => ({ stage, message })),
    });
    if (result.nextStep === 'completed') {
      finalResults = result.finalResults.length ? result.finalResults : result.partialResults;
      break;
    }
    step = result.nextStep;
  }

  if (!finalResults.length) {
    const placesCount = await fallbackLocalSearch(tenantId, campaignId, intent);
    await updateCampaignRunProgress(tenantId, campaignId, {
      status: placesCount > 0 ? 'completed' : 'failed',
      current_step: placesCount > 0 ? 'done' : 'failed',
      progress: placesCount > 0 ? 100 : 0,
      source_count: placesCount,
      created_count: placesCount,
    });
    return {
      count: placesCount,
      sourceStats: { ...sourceStats, directory: placesCount },
      sourceErrors,
      searchCenter,
    };
  }

  const candidates = finalResults.map((lead) => ({
    lead,
    name: lead.business_name,
    company: lead.business_name,
    company_website: lead.website,
    email: lead.email,
    phone: lead.phone,
  }));
  const smb = filterSmbLeads(candidates);

  const rows = smb.slice(0, intent.daily_limit || 40).map((entry) => {
    const lead = entry.lead;
    const { score, grade } = scoreFromLeadResult(lead, radiusKm);
    const sourceId =
      normalizeTraceValue(lead.source_id) ||
      normalizeTraceValue(`${lead.source}:${lead.business_name}:${lead.lat},${lead.lng}`);
    return {
      campaign_id: campaignId,
      tenant_id: tenantId,
      name: lead.business_name,
      company: lead.business_name,
      phone: lead.phone || null,
      email: lead.email || null,
      company_website: lead.website || null,
      industry: niche,
      source: lead.source || 'osm',
      source_id: sourceId,
      source_url: normalizeTraceValue(lead.source_url || lead.website) || null,
      source_label: `${lead.source || 'osm'}${typeof lead.reach_km === 'number' ? ` · ${lead.reach_km} km` : ''}`,
      address: lead.address || null,
      lat: lead.lat ?? null,
      lng: lead.lng ?? null,
      reach_km: typeof lead.reach_km === 'number' ? lead.reach_km : null,
      search_center_lat: searchCenter?.lat ?? null,
      search_center_lng: searchCenter?.lng ?? null,
      score,
      grade,
      status: 'new',
      quality_reason: `Free reach-based search · ${lead.source || 'osm'} · radius ${radiusKm} km`,
      metadata: {
        has_contact: lead.hasContact,
        category: lead.category || null,
        rating: lead.rating ?? null,
        free_sources: true,
      },
    };
  });

  if (!rows.length) {
    await updateCampaignRunProgress(tenantId, campaignId, {
      status: 'failed',
      current_step: 'no_smb_leads',
      progress: 100,
      source_count: finalResults.length,
      created_count: 0,
    });
    return { count: 0, sourceStats, sourceErrors, searchCenter };
  }

  const { error } = await supabase.from('scraper_leads').insert(rows);
  if (error) throw error;

  await updateCampaignRunProgress(tenantId, campaignId, {
    status: 'completed',
    current_step: 'done',
    progress: 100,
    source_count: finalResults.length,
    enriched_count: rows.filter((r) => r.phone || r.email || r.company_website).length,
    created_count: rows.length,
  });

  await logLeadRun({
    tenantId,
    campaignId,
    market: location,
    category: niche,
    status: 'completed',
    sourceCount: finalResults.length,
    enrichedCount: rows.length,
    createdCount: rows.length,
    errors: Object.entries(sourceErrors).map(([stage, message]) => ({ stage, message })),
  });

  return { count: rows.length, sourceStats, sourceErrors, searchCenter };
}

export async function saveLeadsToCrm(
  tenantId: string,
  userId: string,
  leads: Array<Record<string, unknown>>
) {
  const created: Array<{ scraper_lead_id?: string; crm_lead_id?: string }> = [];

  for (const lead of leads) {
    const leadData = lead as Record<string, any>;
    const sourceId =
      normalizeTraceValue(leadData.source_id || leadData.sourceId) ||
      normalizeTraceValue(
        `${leadData.source || 'lead_finder'}:${leadData.id || leadData.name || leadData.company}`
      );
    if (!sourceId) {
      throw new Error(`Lead "${String(leadData.name || leadData.company || 'unknown')}" is missing source_id`);
    }
    const address = normalizeTraceValue(leadData.address);
    const reachNote =
      leadData.reach_km != null ? `Reach: ${leadData.reach_km} km from search center` : '';
    const result = await executeSingleBonnieTool({
      tenantId,
      userId,
      tool: 'create_lead',
      args: {
        contact_name: leadData.name || leadData.company,
        email: leadData.email,
        phone: leadData.phone,
        business_name: leadData.company,
        industry: leadData.industry,
        source: leadData.source || 'lead_finder_chat',
        source_id: sourceId,
        source_url: normalizeTraceValue(leadData.source_url || leadData.website || leadData.company_website),
        notes: [
          `Score: ${leadData.score ?? 'N/A'}, Grade: ${leadData.grade ?? 'N/A'}`,
          reachNote,
          address ? `Address: ${address}` : '',
          `Source ID: ${sourceId}`,
          `Source URL: ${normalizeTraceValue(leadData.source_url || leadData.website || leadData.company_website)}`,
          leadData.lat != null && leadData.lng != null
            ? `Geo: ${leadData.lat}, ${leadData.lng}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      skipPolicy: true,
      policySource: 'mcp',
    });

    let crmLeadId: string | undefined;
    if (result.success && result.details) {
      try {
        const parsed = JSON.parse(result.details);
        crmLeadId = parsed.id || parsed.lead_id;
      } catch {
        const m = result.details.match(/"id"\s*:\s*"([^"]+)"/);
        crmLeadId = m?.[1];
      }
    }

    if (leadData.id && crmLeadId) {
      const supabase = createSupabaseAdminClient();
      await supabase
        .from('scraper_leads')
        .update({ crm_lead_id: crmLeadId, status: 'synced' })
        .eq('id', leadData.id)
        .eq('tenant_id', tenantId);

      await emitBusinessEvent(tenantId, 'lead_created', {
        leadId: crmLeadId,
        source: 'lead_finder_chat',
      });
    }

    created.push({ scraper_lead_id: String(leadData.id || ''), crm_lead_id: crmLeadId });
  }

  return created;
}

/** Save scraper leads to CRM if needed, then mark contacted after outreach. */
export async function prepareLeadsForOutreach(
  tenantId: string,
  userId: string,
  campaignId: string,
  scraperLeadIds: string[]
) {
  const supabase = createSupabaseAdminClient();
  const { data: rows } = await supabase
    .from('scraper_leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('campaign_id', campaignId)
    .in('id', scraperLeadIds);

  const needsCrm = (rows || []).filter((r: { crm_lead_id?: string | null }) => !r.crm_lead_id);
  if (needsCrm.length) {
    await saveLeadsToCrm(tenantId, userId, needsCrm as Array<Record<string, unknown>>);
  }

  const { data: refreshed } = await supabase
    .from('scraper_leads')
    .select('id, crm_lead_id, status')
    .eq('tenant_id', tenantId)
    .in('id', scraperLeadIds);

  return refreshed || [];
}

export async function markLeadsAsContacted(tenantId: string, scraperLeadIds: string[]) {
  if (!scraperLeadIds.length) return { updated: 0 };

  const supabase = createSupabaseAdminClient();

  const { data: rows, error } = await supabase
    .from('scraper_leads')
    .select('id, crm_lead_id, email')
    .eq('tenant_id', tenantId)
    .in('id', scraperLeadIds);

  if (error) throw error;

  await supabase
    .from('scraper_leads')
    .update({ status: 'contacted' })
    .eq('tenant_id', tenantId)
    .in('id', scraperLeadIds);

  let crmUpdated = 0;
  for (const row of rows || []) {
    if (row.crm_lead_id) {
      const { error: crmErr } = await supabase
        .from('leads')
        .update({
          status: 'contacted',
          stage: 'lead',
        })
        .eq('tenant_id', tenantId)
        .eq('id', row.crm_lead_id);
      if (!crmErr) crmUpdated++;
      continue;
    }

    const email = String(row.email || '').trim();
    if (email.includes('@')) {
      const { error: crmErr } = await supabase
        .from('leads')
        .update({
          status: 'contacted',
          stage: 'lead',
        })
        .eq('tenant_id', tenantId)
        .ilike('email', email);
      if (!crmErr) crmUpdated++;
    }
  }

  return { updated: scraperLeadIds.length, crmUpdated };
}

export async function triggerNexusAutomation(
  tenantId: string,
  userId: string,
  options: { autoSend?: boolean; outreachContext?: string }
) {
  const enrich = await executeSingleBonnieTool({
    tenantId,
    userId,
    tool: 'nexus_lead_enrichment',
    args: {},
    skipPolicy: true,
    policySource: 'mcp',
  });

  const campaign = await executeSingleBonnieTool({
    tenantId,
    userId,
    tool: 'nexus_sales_campaign',
    args: {
      auto_send_outreach: options.autoSend ?? false,
      outreach_context: options.outreachContext || 'Lead Finder chat automation',
      user_id: userId,
    },
    skipPolicy: true,
    policySource: 'mcp',
  });

  return { enrich, campaign };
}

export async function startLeadOutreachAutomation(
  tenantId: string,
  userId: string,
  scraperLeadIds: string[],
  channel: 'email' | 'sms' | 'both' = 'email'
) {
  const supabase = createSupabaseAdminClient();
  const { data: scraperLeads } = await supabase
    .from('scraper_leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', scraperLeadIds);

  const saved = await saveLeadsToCrm(tenantId, userId, scraperLeads || []);
  const crmLeadIds = saved.map((s) => s.crm_lead_id).filter(Boolean) as string[];

  await emitBusinessEvent(tenantId, 'scraper_outreach_requested', {
    leadIds: crmLeadIds.length ? crmLeadIds : scraperLeadIds,
    userId,
    channel,
    source: 'lead_finder_chat',
  });

  const nexus = await triggerNexusAutomation(tenantId, userId, {
    autoSend: channel === 'email' || channel === 'both',
    outreachContext: `Automated ${channel} sequence from Lead Finder`,
  });

  return { nexus, crmLeadIds };
}
