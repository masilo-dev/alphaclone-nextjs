import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { freePlacesService } from '@/services/freePlacesService';
import { qualifyLead, type QualityTier } from '@/lib/leadQualification';
import { parseLeadIntentFromChat } from '@/lib/scraper/parseLeadIntent';
import { getMemory, upsertMemory } from '@/services/nexusMemoryService';
import { getBonnieWorkspaceSnapshot } from '@/lib/bonnie/bonnieWorkspaceSnapshot';
import { isApifyConfigured, discoverBusinessesWithApify } from '@/services/apifyLeadService';
import { buildCanonicalBusinessKey, resolveBusinessEntity } from '@/lib/lead-finder/core';
import { resolveQualificationProfile, QUALIFICATION_RULES_VERSION, type QualificationProfile } from '@/lib/lead-finder/qualificationContract';
import { buildDiscoveryQueries } from '@/lib/lead-finder/queryGenerator';
import { qualifyCandidateBatch, type RawCandidateInput, type CandidateEvidenceRecord } from '@/lib/lead-finder/qualificationService';

export type LeadSearchCriteria = {
  niche: string;
  location: string;
  country?: string;
  min_score?: number;
  tiers?: QualityTier[];
  exclude_keywords?: string[];
  max_results?: number;
  save_to_crm?: boolean;
  filter_no_website?: boolean;
  require_email?: boolean;
  intent_prompt?: string;
};

function mapPlaceToLead(place: {
  placeId?: string;
  businessName: string;
  phone: string;
  website: string;
  formattedAddress: string;
  rating?: number;
  industry: string;
  source: string;
}) {
  return {
    business_name: place.businessName,
    email: '',
    phone: place.phone,
    website: place.website,
    address: place.formattedAddress,
    rating: place.rating,
    category: place.industry,
    source: place.source,
    source_id: place.placeId || `${place.source}:${place.businessName}`.toLowerCase().replace(/\s+/g, '-'),
    source_url: place.website || '',
  };
}

function passesCriteria(
  lead: { business_name?: string; qualification: ReturnType<typeof qualifyLead> },
  minScore: number,
  tiers?: QualityTier[],
  excludeKeywords: string[] = []
): boolean {
  if (lead.qualification.tier === 'skip') return false;
  if (lead.qualification.score < minScore) return false;
  if (tiers?.length && !tiers.includes(lead.qualification.tier)) return false;
  const name = (lead.business_name || '').toLowerCase();
  if (excludeKeywords.some((kw) => name.includes(kw.toLowerCase()))) return false;
  return true;
}

export async function bonnieGetSavedLeadCriteria(tenantId: string) {
  const rows = await getMemory(tenantId, { key: 'lead_qualification_criteria' });
  return (rows[0]?.value as Record<string, unknown> | undefined) || null;
}

export async function bonnieParseAndSaveLeadCriteria(tenantId: string, userMessage: string) {
  const { intent, assistantReply } = await parseLeadIntentFromChat(userMessage);
  await upsertMemory(tenantId, {
    category: 'preference',
    key: 'lead_qualification_criteria',
    value: intent as unknown as Record<string, unknown>,
    source: 'agent',
    confidence: 0.9,
  });
  return { intent, assistantReply };
}

export async function bonnieFindAndQualifyLeads(
  tenantId: string,
  criteria: LeadSearchCriteria
) {
  const startTime = Date.now();
  const searchId = `lead_search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const savedCriteria = await bonnieGetSavedLeadCriteria(tenantId);
  const niche = criteria.niche.trim();
  const location = criteria.location.trim();
  if (!niche || !location) {
    throw new Error('niche and location are required (e.g. niche="plumbers", location="Austin TX").');
  }

  const minScore =
    (criteria.min_score ??
      Number(savedCriteria?.min_score_threshold)) ||
    35;
  const excludeKeywords = [
    ...(criteria.exclude_keywords || []),
    ...((savedCriteria?.exclude_keywords as string[]) || []),
  ];
  const tiers = criteria.tiers;
  const maxResults = Math.min(criteria.max_results ?? 25, 50);
  const targetCountry = criteria.country || location;

  let apifyRunId: string | null = null;
  let costUsd = 0;
  let rawCount = 0;
  let locationValidated = true;
  let executionStatus: 'COMPLETED' | 'REQUESTED' | 'RUNNING' | 'FAILED' = 'COMPLETED';

  type RawCandidate = {
    business_name: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    rating?: number;
    category: string;
    source: string;
    source_id: string;
    source_url: string;
  };

  const rawDiscovered: RawCandidate[] = [];

  const profile = resolveQualificationProfile({
    intentPrompt: criteria.intent_prompt || criteria.niche,
    niche,
    location,
    country: criteria.country,
    requireEmail: criteria.require_email,
    filterNoWebsite: criteria.filter_no_website,
  });

  if (excludeKeywords.length > 0) {
    profile.excludedIndustries.push(...excludeKeywords);
    profile.explicitExclusions.push(...excludeKeywords);
  }

  const discoveryPlan = buildDiscoveryQueries(profile, criteria.intent_prompt || criteria.niche, {
    maxQueries: 3,
    resultsPerQuery: maxResults,
    discoveryOnly: !criteria.save_to_crm,
  });

  // Primary: Use Apify Google Places if configured
  if (isApifyConfigured()) {
    try {
      const primaryQuery = discoveryPlan.generatedQueries[0]?.queryTerm || niche;
      const searchStrings = discoveryPlan.generatedQueries.map((q) => q.fullSearchString);
      const receipt = await discoverBusinessesWithApify({
        query: primaryQuery,
        searchStringsArray: searchStrings,
        location,
        country: criteria.country,
        resultLimit: maxResults,
        filterNoWebsite: criteria.filter_no_website,
        requireEmail: criteria.require_email,
      });
      if (receipt.success) {
        apifyRunId = receipt.runId || null;
        costUsd = receipt.costUsd;
        rawCount = receipt.totalFound;
        executionStatus = 'COMPLETED';

        for (const d of receipt.discovered) {
          rawDiscovered.push({
            business_name: d.businessName,
            email: d.email || '',
            phone: d.phone || '',
            website: d.website || '',
            address: d.address || '',
            rating: d.rating ?? undefined,
            category: d.category || niche,
            source: d.source,
            source_id: d.sourceId,
            source_url: d.sourceUrl || d.googleMapsUrl || '',
          });
        }
      }
    } catch (apifyErr) {
      console.warn('[bonnieLeadOps] Apify search failed, falling back to free sources:', apifyErr);
    }
  }

  // Fallback: Use free places ONLY if Apify unconfigured or returned 0 items
  if (rawDiscovered.length === 0) {
    const searchTerm = discoveryPlan.generatedQueries[0]?.queryTerm || niche;
    const search = await freePlacesService.searchPlacesForLeads(searchTerm, location, undefined, {
      maxResults,
    });
    rawCount = search.places.length;
    locationValidated = search.locationValidated;
    for (const place of search.places) {
      rawDiscovered.push(mapPlaceToLead(place));
    }
  }

  // Evaluate all discovered candidates using unified qualification engine
  const rawCandidateInputs: RawCandidateInput[] = rawDiscovered.map((lead) => ({
    business_name: lead.business_name,
    name: lead.business_name,
    company: lead.business_name,
    website: lead.website || null,
    phone: lead.phone || null,
    email: lead.email || null,
    address: lead.address || null,
    rating: lead.rating ?? null,
    category: lead.category || niche,
    industry: lead.category || niche,
    source: lead.source,
    source_id: lead.source_id,
    source_url: lead.source_url,
    country: targetCountry,
  }));

  const batchSummary = qualifyCandidateBatch(rawCandidateInputs, profile, searchId);

  const qualifiedRecords = batchSummary.records.filter((r) => {
    if (r.decision !== 'QUALIFIED') return false;
    if (tiers?.length) {
      const tier = r.numericRankScore >= 70 ? 'hot' : r.numericRankScore >= 50 ? 'warm' : 'cold';
      if (!tiers.includes(tier)) return false;
    }
    return r.numericRankScore >= minScore;
  });

  // Traceable cache: persist evaluated candidates in scraper_leads for run retrieval
  if (batchSummary.records.length > 0) {
    try {
      const admin = createSupabaseAdminClient();
      const scraperRows = batchSummary.records.map((r) => {
        const tier = r.numericRankScore >= 70 ? 'hot' : r.numericRankScore >= 50 ? 'warm' : r.numericRankScore >= 35 ? 'cold' : 'skip';
        const grade = r.numericRankScore >= 80 ? 'A' : r.numericRankScore >= 65 ? 'B' : r.numericRankScore >= 50 ? 'C' : 'D';
        return {
          tenant_id: tenantId,
          campaign_id: searchId,
          company: r.businessName,
          name: r.businessName,
          phone: r.normalizedData.phone,
          email: r.normalizedData.email,
          company_website: r.officialWebsite.url,
          address: r.normalizedData.address,
          score: r.numericRankScore,
          grade,
          status: r.decision === 'QUALIFIED' ? 'qualified' : r.decision === 'REVIEW_NEEDED' ? 'review' : 'discovered',
          source: r.sourceEvidence.sourceType,
          source_id: r.originalData.name || r.businessName,
          source_url: r.sourceEvidence.sourceUrl,
          metadata: {
            search_id: searchId,
            apify_run_id: apifyRunId,
            decision: r.decision,
            decision_reasons: r.decisionReasons,
            requirements: r.requirements,
            assessments: r.assessments,
            missing_evidence: r.missingEvidence,
            qualification_rules_version: r.rulesVersion,
          },
        };
      });
      await admin.from('scraper_leads').insert(scraperRows);
    } catch {
      // non-fatal cache write
    }
  }

  // CRM Import (only when save_to_crm: true AND candidates are qualified)
  let savedToCrm = 0;
  if (criteria.save_to_crm && qualifiedRecords.length > 0) {
    const admin = createSupabaseAdminClient();
    for (const r of qualifiedRecords.slice(0, 25)) {
      const canonicalKey = buildCanonicalBusinessKey({
        businessName: r.businessName,
        email: r.normalizedData.email,
        phone: r.normalizedData.phone,
        website: r.officialWebsite.url,
        country: targetCountry,
        sourceExternalId: r.originalData.name || r.businessName,
      });

      const { data: existing } = await admin
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('canonical_business_key', canonicalKey)
        .maybeSingle();

      if (existing) {
        // Idempotent update
        await admin
          .from('leads')
          .update({
            updated_at: new Date().toISOString(),
            metadata: {
              qualification_decision: r.decision,
              decision_reasons: r.decisionReasons,
              assessments: r.assessments,
              rank_score: r.numericRankScore,
              search_id: searchId,
              apify_run_id: apifyRunId,
              cost_usd: costUsd,
            },
          })
          .eq('id', existing.id);
        savedToCrm += 1;
      } else {
        const tier = r.numericRankScore >= 70 ? 'hot' : 'warm';
        const { error } = await admin.from('leads').insert({
          tenant_id: tenantId,
          business_name: r.businessName,
          phone: r.normalizedData.phone,
          email: r.normalizedData.email,
          website: r.officialWebsite.url,
          address: r.normalizedData.address,
          rating: r.originalData.rating ?? null,
          industry: niche,
          source: apifyRunId ? 'apify_google_places' : 'bonnie_find_leads',
          stage: tier === 'hot' ? 'qualified' : 'lead',
          canonical_business_key: canonicalKey,
          metadata: {
            qualification_decision: r.decision,
            decision_reasons: r.decisionReasons,
            assessments: r.assessments,
            rank_score: r.numericRankScore,
            search_id: searchId,
            apify_run_id: apifyRunId,
            cost_usd: costUsd,
          },
        });
        if (!error) savedToCrm += 1;
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    search_id: searchId,
    niche,
    location,
    country: profile.targetGeography.country || criteria.country,
    min_score: minScore,
    raw_count: rawCount,
    parsed_count: batchSummary.totalAssessed,
    contactable_count: batchSummary.channelCounts.emailReady + batchSummary.channelCounts.phoneReady,
    qualified_count: qualifiedRecords.length,
    saved_to_crm: savedToCrm,
    location_validated: locationValidated,
    apify_run_id: apifyRunId,
    cost_usd: costUsd,
    duration_ms: durationMs,
    qualification_profile: profile,
    discovery_plan: discoveryPlan,
    summary: batchSummary,
    execution_truth: {
      status: executionStatus,
      may_claim_completed: true,
      provider: apifyRunId ? 'apify_google_places' : 'free_places',
      provider_run_id: apifyRunId,
      cost_usd: costUsd,
      duration_ms: durationMs,
    },
    leads: qualifiedRecords.slice(0, 15).map((l) => ({
      business_name: l.businessName,
      phone: l.normalizedData.phone,
      email: l.normalizedData.email,
      website: l.officialWebsite.url,
      address: l.normalizedData.address,
      score: l.numericRankScore,
      data_quality_score: l.assessments.data_quality.score,
      fit_score: l.assessments.target_fit.score,
      tier: l.numericRankScore >= 70 ? 'hot' : l.numericRankScore >= 50 ? 'warm' : 'cold',
      pitch_angle: l.recommendedNextStep,
      insights: l.decisionReasons.slice(0, 3),
      can_auto_send: l.assessments.contact_readiness.channelReadiness === 'email_ready',
      evidence_urls: [l.sourceEvidence.sourceUrl, l.officialWebsite.url].filter(Boolean) as string[],
      decision: l.decision,
      channel_readiness: l.assessments.contact_readiness.channelReadiness,
      decision_reasons: l.decisionReasons,
    })),
    candidate_previews: batchSummary.records.slice(0, 15).map((c) => ({
      business_name: c.businessName,
      phone: c.normalizedData.phone,
      email: c.normalizedData.email,
      website: c.officialWebsite.url,
      address: c.normalizedData.address,
      score: c.numericRankScore,
      data_quality_score: c.assessments.data_quality.score,
      fit_score: c.assessments.target_fit.score,
      tier: c.numericRankScore >= 70 ? 'hot' : c.numericRankScore >= 50 ? 'warm' : 'cold',
      decision: c.decision,
      rejection_reason: c.decision !== 'QUALIFIED' ? c.decisionReasons.join('; ') : undefined,
      channel_readiness: c.assessments.contact_readiness.channelReadiness,
      rank: c.numericRankScore,
      decision_reasons: c.decisionReasons,
      is_competitor: c.assessments.target_fit.isCompetitor,
      assessments: c.assessments,
      evidence_urls: [c.sourceEvidence.sourceUrl, c.officialWebsite.url].filter(Boolean) as string[],
    })),
  };
}

export async function bonnieQualifyCrmLeads(
  tenantId: string,
  opts: { industry?: string; min_score?: number; limit?: number; tiers?: QualityTier[] }
) {
  const admin = createSupabaseAdminClient();
  const industry = opts.industry || 'general';
  const minScore = opts.min_score ?? 0;
  const limit = Math.min(opts.limit ?? 50, 100);

  const { data, error } = await admin
    .from('leads')
    .select('id, business_name, email, phone, website, address, rating, stage, industry')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  type CrmLeadRow = {
    id: string;
    business_name: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    rating: number | null;
    stage: string | null;
    industry: string | null;
  };

  return ((data || []) as CrmLeadRow[])
    .map((lead) => {
      const qualification = qualifyLead(
        {
          business_name: lead.business_name ?? undefined,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          website: lead.website ?? undefined,
          address: lead.address ?? undefined,
          rating: lead.rating ?? undefined,
        },
        lead.industry || industry
      );
      return {
        id: lead.id,
        business_name: lead.business_name,
        stage: lead.stage,
        qualification,
      };
    })
    .filter((l) =>
      passesCriteria(
        { business_name: l.business_name ?? undefined, qualification: l.qualification },
        minScore,
        opts.tiers
      )
    )
    .map((l) => ({
      id: l.id,
      business_name: l.business_name,
      stage: l.stage,
      score: l.qualification.score,
      tier: l.qualification.tier,
      pitch_angle: l.qualification.pitchAngle,
      insights: l.qualification.insights.slice(0, 2),
    }));
}

export async function bonnieGetScraperLeads(
  tenantId: string,
  opts: {
    min_score?: number;
    grade?: string;
    limit?: number;
    search_id?: string;
    run_id?: string;
    campaign_id?: string;
  } = {}
) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from('scraper_leads')
    .select('id, name, company, email, phone, company_website, score, grade, status, campaign_id, source, source_url, created_at')
    .eq('tenant_id', tenantId)
    .order('score', { ascending: false })
    .limit(Math.min(opts.limit ?? 50, 100));

  const runFilter = opts.campaign_id || opts.search_id || opts.run_id;
  if (runFilter) {
    query = query.eq('campaign_id', runFilter);
  }
  if (opts.min_score != null) query = query.gte('score', opts.min_score);
  if (opts.grade) query = query.eq('grade', opts.grade);

  const { data, error } = await query;
  if (error) {
    if (error.message?.includes('Supabase is not configured') || process.env.NODE_ENV === 'test') {
      return [];
    }
    throw new Error(error.message);
  }

  // Sanitize: reject directory listicles from being returned
  const sanitized = (data || []).filter((lead: any) => {
    const entity = resolveBusinessEntity({
      businessName: lead.company || lead.name,
      website: lead.company_website,
      sourceUrl: lead.source_url,
    });
    return entity.isRealBusiness;
  });

  return sanitized;
}

export async function bonnieGetAccountOverview(tenantId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const snapshot = await getBonnieWorkspaceSnapshot(tenantId);
  const leadCriteria = await bonnieGetSavedLeadCriteria(tenantId);

  const [fb, wa, ms, linkedin, campaigns, scraperCount, recentLeads] = await Promise.all([
    admin.from('facebook_integrations').select('page_name,is_active').eq('tenant_id', tenantId).limit(10),
    admin.from('whatsapp_integrations').select('phone_number_id,is_active').eq('tenant_id', tenantId).limit(5),
    admin.from('microsoft_connections').select('microsoft_email').eq('user_id', userId).maybeSingle(),
    admin.from('linkedin_integrations').select('id').eq('tenant_id', tenantId).limit(1),
    admin.from('scraper_campaigns').select('id,name,status,min_score_threshold').eq('tenant_id', tenantId).limit(10),
    admin.from('scraper_leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('leads').select('id,business_name,stage').eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(5),
  ]);

  type IntegrationRow = { is_active?: boolean | null; page_name?: string | null };
  type CampaignRow = { status?: string | null };

  return {
    workspace: snapshot,
    integrations: {
      facebook_pages: ((fb.data || []) as IntegrationRow[])
        .filter((r) => r.is_active)
        .map((r) => r.page_name),
      whatsapp_connected: ((wa.data || []) as IntegrationRow[]).some((r) => r.is_active),
      microsoft_email: ms.data?.microsoft_email || null,
      linkedin_connected: (linkedin.data?.length || 0) > 0,
    },
    lead_ops: {
      saved_qualification_criteria: leadCriteria,
      scraper_leads_count: scraperCount.count ?? 0,
      active_campaigns: ((campaigns.data || []) as CampaignRow[]).filter((c) => c.status === 'active')
        .length,
      campaigns: campaigns.data || [],
      recent_leads: recentLeads.data || [],
    },
  };
}
