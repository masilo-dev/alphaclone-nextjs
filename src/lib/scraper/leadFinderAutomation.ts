import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { emitBusinessEvent } from '@/lib/automation/emit-event';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';
import { freePlacesService } from '@/services/freePlacesService';
import { filterSmbLeads } from '@/lib/scraper/smbLeadFilters';
import { runLeadStep, type LeadResult } from '@/lib/scraper/freeLeadSearch';
import type { ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';
import type { GeoPoint } from '@/lib/scraper/freeGeoSources';
import {
  enrichBusinessWithDecisionMakers,
  hasPhoneOrEmail,
} from '@/lib/scraper/decisionMakerScrape';
import { canUseBrowserScraper } from '@/lib/scraper/browserSerpLeads';

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

function normalizeTextKey(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhoneKey(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

function normalizeHostKey(value: unknown): string {
  const raw = normalizeTraceValue(value);
  if (!raw) return '';
  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return normalizeTextKey(raw);
  }
}

function buildLeadDedupeKey(input: {
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  company?: unknown;
  address?: unknown;
}): string {
  const email = normalizeTextKey(input.email);
  if (email.includes('@')) return `email:${email}`;

  const phone = normalizePhoneKey(input.phone);
  if (phone.length >= 7) return `phone:${phone}`;

  const host = normalizeHostKey(input.website);
  if (host) return `domain:${host}`;

  const company = normalizeTextKey(input.company);
  const address = normalizeTextKey(input.address);
  return [company, address].filter(Boolean).join('|');
}

function buildMatchReasons(lead: LeadResult, score: number, radiusKm: number): string[] {
  const reasons = new Set<string>();
  if (lead.category) reasons.add(`Category matched: ${lead.category}`);
  if (lead.phone) reasons.add('Public phone found');
  if (lead.email) reasons.add('Public email found');
  if (lead.website) reasons.add('Website found');
  if (lead.decision_maker_name) reasons.add(`Decision maker found: ${lead.decision_maker_name}`);
  if (typeof lead.reach_km === 'number') reasons.add(`Inside ${radiusKm} km radius: ${lead.reach_km} km away`);
  if (lead.rating) reasons.add(`Directory rating: ${lead.rating}`);
  reasons.add(`Confidence score: ${score}`);
  return Array.from(reasons).slice(0, 8);
}

function buildSourceUrls(lead: Pick<LeadResult, 'source_url' | 'website'>): string[] {
  return Array.from(
    new Set(
      [lead.source_url, lead.website]
        .map((value) => normalizeTraceValue(value))
        .filter((value) => /^https?:\/\//i.test(value))
    )
  );
}

async function removeKnownDuplicateRows(
  tenantId: string,
  rows: Array<Record<string, any>>
): Promise<{ rows: Array<Record<string, any>>; removedCount: number }> {
  if (!rows.length) return { rows, removedCount: 0 };

  const supabase = createSupabaseAdminClient();
  const seen = new Set<string>();

  const addExistingKeys = (items: Array<Record<string, any>>, source: 'scraper' | 'lead' | 'contact' | 'client') => {
    for (const item of items) {
      const key = source === 'scraper'
        ? normalizeTraceValue(item.dedupe_key) || buildLeadDedupeKey({
            email: item.email,
            phone: item.phone,
            website: item.company_website || item.source_url,
            company: item.company,
            address: item.address,
          })
        : buildLeadDedupeKey({
            email: item.email,
            phone: item.phone || item.mobile,
            website: item.website || item.company_website,
            company: item.business_name || item.company || item.name || item.full_name,
            address: item.location || item.address || item.address_line1,
          });
      if (key) seen.add(key);
    }
  };

  const [scraper, leads, contacts, clients] = await Promise.all([
    supabase
      .from('scraper_leads')
      .select('dedupe_key,email,phone,company,company_website,source_url,address')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('leads')
      .select('email,phone,website,business_name,location')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('contacts')
      .select('email,phone,mobile,full_name,address_line1')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('business_clients')
      .select('email,phone,website,company,name,location')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  addExistingKeys((scraper.data || []) as Array<Record<string, any>>, 'scraper');
  addExistingKeys((leads.data || []) as Array<Record<string, any>>, 'lead');
  addExistingKeys((contacts.data || []) as Array<Record<string, any>>, 'contact');
  addExistingKeys((clients.data || []) as Array<Record<string, any>>, 'client');

  const local = new Set<string>();
  const deduped = rows.filter((row) => {
    const key = normalizeTraceValue(row.dedupe_key);
    if (!key) return true;
    if (seen.has(key) || local.has(key)) return false;
    local.add(key);
    return true;
  });

  return { rows: deduped, removedCount: rows.length - deduped.length };
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

  // Enrich directory hits then keep only phone/email leads
  const enrichedRows: Array<Record<string, unknown>> = [];
  for (const p of smbPlaces.slice(0, Math.min(intent.daily_limit || 40, 25))) {
    const place = places.find((pl) => pl.businessName === p.company) || places[0];
    let phone = place?.phone || '';
    let email = '';
    let dmName = '';
    let dmTitle = '';
    if (place?.website) {
      try {
        const data = await enrichBusinessWithDecisionMakers(place.website, 16000);
        phone = data.phone || phone;
        email = data.email || '';
        dmName = data.primaryDecisionMaker?.name || '';
        dmTitle = data.primaryDecisionMaker?.title || '';
      } catch {
        /* keep directory phone */
      }
    }
    if (!hasPhoneOrEmail({ phone, email })) continue;
    const sourceId = normalizeTraceValue(
      place?.placeId || `${place?.source || 'directory'}:${place?.businessName}`
    );
    const sourceUrls = buildSourceUrls({
      website: place?.website || '',
      source_url: place?.website || '',
    });
    const matchReasons = [
      'Directory business matched search niche',
      phone ? 'Public phone found' : '',
      email ? 'Public email found' : '',
      place?.website ? 'Website found' : '',
      dmName ? `Decision maker found: ${dmName}` : '',
    ].filter(Boolean);
    enrichedRows.push({
      campaign_id: campaignId,
      tenant_id: tenantId,
      name: dmName || place?.businessName || p.company,
      title: dmTitle || null,
      company: place?.businessName || p.company,
      phone: phone || null,
      email: email || null,
      company_website: place?.website,
      industry: niche,
      source_id: sourceId,
      source_url: normalizeTraceValue(place?.website),
      source_label: place?.source || 'directory',
      source: 'directory',
      address: place?.formattedAddress || '',
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      score: email && phone ? 72 : 58,
      confidence_score: email && phone ? 72 : 58,
      grade: email && phone ? 'B' : 'C',
      status: 'new',
      dedupe_key: buildLeadDedupeKey({
        email,
        phone,
        website: place?.website,
        company: place?.businessName || p.company,
        address: place?.formattedAddress,
      }) || null,
      match_reasons: matchReasons,
      source_urls: sourceUrls,
      enrichment_status: 'completed',
      verification_status: email && phone ? 'verified' : 'partial',
      duplicate_status: 'unique',
      source_health: { primary: place?.source || 'directory', urls: sourceUrls },
      quality_reason: 'SMB directory + auto contact enrichment',
      metadata: {
        free_source: place?.source || 'directory',
        decision_maker_name: dmName || null,
        auto_enriched: true,
        match_reasons: matchReasons,
        source_urls: sourceUrls,
      },
    });
  }

  const { rows, removedCount } = await removeKnownDuplicateRows(tenantId, enrichedRows);
  if (!rows.length) return 0;

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
    errors: removedCount ? [{ stage: 'dedupe', message: `${removedCount} duplicate leads skipped` }] : [],
  });
  return rows.length;
}

function scoreFromLeadResult(lead: LeadResult, radiusKm: number): { score: number; grade: string } {
  let score = 35;
  if (lead.phone) score += 18;
  if (lead.email) score += 22;
  if (lead.website) score += 8;
  if (lead.decision_maker_name) score += 12;
  if (lead.decision_maker_title) score += 6;
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

/** Auto-enrich websites: emails, phones, decision makers. Drop leads without phone/email. */
async function autoEnrichLeadBatch(
  leads: LeadResult[],
  limit: number,
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<LeadResult[]> {
  const enrichable = leads
    .filter((l) => hasPhoneOrEmail(l) || (l.website && /^https?:\/\//i.test(l.website)))
    .slice(0, Math.max(limit * 2, 30));

  const enriched: LeadResult[] = [];
  const concurrency = 3;

  for (let i = 0; i < enrichable.length && enriched.length < limit; i += concurrency) {
    const chunk = enrichable.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (lead) => {
        if (hasPhoneOrEmail(lead) && lead.decision_maker_name) return lead;
        if (!lead.website) {
          return hasPhoneOrEmail(lead) ? lead : null;
        }
        try {
          const data = await enrichBusinessWithDecisionMakers(lead.website, 22000);
          const next: LeadResult = {
            ...lead,
            email: data.email || lead.email || '',
            phone: data.phone || lead.phone || '',
            decision_maker_name: data.primaryDecisionMaker?.name,
            decision_maker_title: data.primaryDecisionMaker?.title,
            hasContact: false,
            snippet:
              data.primaryDecisionMaker
                ? `${data.primaryDecisionMaker.title}: ${data.primaryDecisionMaker.name}`
                : lead.snippet,
          };
          next.hasContact = hasPhoneOrEmail(next);
          return next.hasContact ? next : null;
        } catch {
          return hasPhoneOrEmail(lead) ? lead : null;
        }
      })
    );

    for (const row of results) {
      if (row && hasPhoneOrEmail(row)) enriched.push(row);
      if (enriched.length >= limit) break;
    }
    await onProgress?.(Math.min(i + concurrency, enrichable.length), enrichable.length);
  }

  // Prefer decision-maker + email leads first
  return enriched.sort((a, b) => {
    const aDm = a.decision_maker_name ? 1 : 0;
    const bDm = b.decision_maker_name ? 1 : 0;
    if (bDm !== aDm) return bDm - aDm;
    const aEmail = a.email ? 1 : 0;
    const bEmail = b.email ? 1 : 0;
    if (bEmail !== aEmail) return bEmail - aEmail;
    return (a.reach_km ?? 999) - (b.reach_km ?? 999);
  });
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
    stage: patch.current_step || 'scraping',
    progress: patch.progress ?? 10,
    source_count: patch.source_count ?? 0,
    enriched_count: patch.enriched_count ?? 0,
    created_count: patch.created_count ?? 0,
    errors: patch.errors || [],
    source_health: {
      errors: patch.errors || [],
      healthy: (patch.errors || []).length === 0,
    },
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
      usePlaywright: canUseBrowserScraper(),
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
      progress: Math.min(72, result.progress),
      source_count: partial.length,
      enriched_count: partial.filter((l) => hasPhoneOrEmail(l)).length,
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

  await updateCampaignRunProgress(tenantId, campaignId, {
    status: 'running',
    current_step: 'Enriching emails, phones & decision makers',
    progress: 78,
    source_count: finalResults.length,
  });

  const limit = intent.daily_limit || 40;
  const contactReady = await autoEnrichLeadBatch(finalResults, limit, async (done, total) => {
    await updateCampaignRunProgress(tenantId, campaignId, {
      status: 'running',
      current_step: `Enriching contacts ${done}/${total}`,
      progress: 78 + Math.round((done / Math.max(total, 1)) * 18),
      source_count: finalResults.length,
      enriched_count: done,
    });
  });

  // Include enriched leads or raw discovered business listings
  let withContact = contactReady.filter((l) => hasPhoneOrEmail(l));
  if (!withContact.length && finalResults.length > 0) {
    withContact = finalResults;
  }
  sourceStats.enriched = withContact.length;
  sourceStats.dropped_no_contact = Math.max(0, finalResults.length - withContact.length);

  const candidates = withContact.map((lead) => ({
    lead,
    name: lead.decision_maker_name || lead.business_name,
    company: lead.business_name,
    company_website: lead.website,
    email: lead.email,
    phone: lead.phone,
  }));
  const smb = filterSmbLeads(candidates);

  const rows = smb.slice(0, limit).map((entry) => {
    const lead = entry.lead;
    const { score, grade } = scoreFromLeadResult(lead, radiusKm);
    const sourceUrls = buildSourceUrls(lead);
    const matchReasons = buildMatchReasons(lead, score, radiusKm);
    const sourceId =
      normalizeTraceValue(lead.source_id) ||
      normalizeTraceValue(`${lead.source}:${lead.business_name}:${lead.lat},${lead.lng}`);
    const dmName = lead.decision_maker_name || null;
    const dmTitle = lead.decision_maker_title || null;
    const nameParts = (dmName || '').trim().split(/\s+/).filter(Boolean);
    return {
      campaign_id: campaignId,
      tenant_id: tenantId,
      name: dmName || lead.business_name,
      first_name: nameParts[0] || null,
      last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : null,
      title: dmTitle,
      company: lead.business_name,
      phone: lead.phone || null,
      email: lead.email || null,
      company_website: lead.website || null,
      industry: niche,
      source: lead.source || 'osm',
      source_id: sourceId,
      source_url: normalizeTraceValue(lead.source_url || lead.website) || null,
      source_label: [
        lead.source || 'osm',
        typeof lead.reach_km === 'number' ? `${lead.reach_km} km` : null,
        dmTitle ? 'DM' : null,
      ]
        .filter(Boolean)
        .join(' · '),
      address: lead.address || null,
      lat: lead.lat ?? null,
      lng: lead.lng ?? null,
      reach_km: typeof lead.reach_km === 'number' ? lead.reach_km : null,
      search_center_lat: searchCenter?.lat ?? null,
      search_center_lng: searchCenter?.lng ?? null,
      dedupe_key: buildLeadDedupeKey({
        email: lead.email,
        phone: lead.phone,
        website: lead.website || lead.source_url,
        company: lead.business_name,
        address: lead.address,
      }) || null,
      confidence_score: score,
      match_reasons: matchReasons,
      source_urls: sourceUrls,
      enrichment_status: lead.email || lead.phone ? 'completed' : 'partial',
      verification_status: lead.email && lead.phone ? 'verified' : lead.email || lead.phone ? 'partial' : 'unverified',
      duplicate_status: 'unique',
      source_health: {
        primary: lead.source || 'osm',
        urls: sourceUrls,
        browser_enabled: canUseBrowserScraper(),
      },
      score,
      grade,
      status: 'new',
      quality_reason: dmName
        ? `Auto-enriched · ${dmTitle || 'decision maker'}: ${dmName} · ${lead.source || 'osm'}`
        : `Auto-enriched contact · ${lead.source || 'osm'} · radius ${radiusKm} km`,
      metadata: {
        has_contact: true,
        category: lead.category || null,
        rating: lead.rating ?? null,
        free_sources: true,
        decision_maker_name: dmName,
        decision_maker_title: dmTitle,
        auto_enriched: true,
        playwright: canUseBrowserScraper(),
        source_urls: sourceUrls,
        match_reasons: matchReasons,
        verification_status: lead.email && lead.phone ? 'verified' : lead.email || lead.phone ? 'partial' : 'unverified',
      },
    };
  });

  const { rows: dedupedRows, removedCount } = await removeKnownDuplicateRows(tenantId, rows);
  sourceStats.duplicates = (sourceStats.duplicates || 0) + removedCount;

  if (!dedupedRows.length) {
    await updateCampaignRunProgress(tenantId, campaignId, {
      status: 'failed',
      current_step: removedCount > 0 ? 'duplicates_removed' : 'no_contactable_leads',
      progress: 100,
      source_count: finalResults.length,
      created_count: 0,
      errors: [{
        stage: removedCount > 0 ? 'dedupe' : 'enrich',
        message: removedCount > 0
          ? 'All discovered leads already exist in scraper or CRM records.'
          : 'No leads with phone or email after enrichment',
      }],
    });
    return { count: 0, sourceStats, sourceErrors, searchCenter };
  }

  const { error } = await supabase.from('scraper_leads').insert(dedupedRows);
  if (error) throw error;

  await updateCampaignRunProgress(tenantId, campaignId, {
    status: 'completed',
    current_step: 'done',
    progress: 100,
    source_count: finalResults.length,
    enriched_count: dedupedRows.length,
    created_count: dedupedRows.length,
    errors: removedCount > 0 ? [{ stage: 'dedupe', message: `${removedCount} duplicate leads skipped` }] : [],
  });

  await logLeadRun({
    tenantId,
    campaignId,
    market: location,
    category: niche,
    status: 'completed',
    sourceCount: finalResults.length,
    enrichedCount: dedupedRows.length,
    createdCount: dedupedRows.length,
    errors: Object.entries(sourceErrors).map(([stage, message]) => ({ stage, message })),
  });

  return { count: dedupedRows.length, sourceStats, sourceErrors, searchCenter };
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
