import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { freePlacesService } from '@/services/freePlacesService';
import { qualifyLead, type QualityTier } from '@/lib/leadQualification';
import { parseLeadIntentFromChat } from '@/lib/scraper/parseLeadIntent';
import { getMemory, upsertMemory } from '@/services/nexusMemoryService';
import { getBonnieWorkspaceSnapshot } from '@/lib/bonnie/bonnieWorkspaceSnapshot';
import { isApifyConfigured, discoverBusinessesWithApify } from '@/services/apifyLeadService';

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

  let apifyRunId: string | null = null;
  let costUsd = 0;
  let rawCount = 0;
  let locationValidated = true;
  let qualified: Array<{
    business_name: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    rating?: number;
    category?: string;
    source: string;
    source_id: string;
    source_url?: string;
    qualification: ReturnType<typeof qualifyLead>;
  }> = [];

  // Primary: Use Apify Google Places if configured
  if (isApifyConfigured()) {
    try {
      const receipt = await discoverBusinessesWithApify({
        query: niche,
        location,
        country: criteria.country,
        resultLimit: maxResults,
        filterNoWebsite: criteria.filter_no_website,
        requireEmail: criteria.require_email,
      });
      if (receipt.success && receipt.discovered.length > 0) {
        apifyRunId = receipt.runId || null;
        costUsd = receipt.costUsd;
        rawCount = receipt.totalFound;
        qualified = receipt.discovered.map((d) => {
          const lead = {
            business_name: d.businessName,
            email: d.email || '',
            phone: d.phone || '',
            website: d.website || '',
            address: d.address || '',
            rating: d.rating ?? undefined,
            category: d.category || niche,
            source: d.source,
            source_id: d.sourceId,
            source_url: d.sourceUrl || '',
          };
          return {
            ...lead,
            qualification: qualifyLead(lead, niche),
          };
        })
        .filter((lead) => passesCriteria(lead, minScore, tiers, excludeKeywords))
        .filter((lead) => Boolean(lead.phone) || Boolean(lead.email));
      }
    } catch (apifyErr) {
      console.warn('[bonnieLeadOps] Apify search failed, falling back to free sources:', apifyErr);
    }
  }

  // Fallback: Use free places if Apify unconfigured or returned 0
  if (qualified.length === 0) {
    const search = await freePlacesService.searchPlacesForLeads(niche, location, undefined, {
      maxResults,
    });
    rawCount = search.places.length;
    locationValidated = search.locationValidated;
    qualified = search.places
      .map((place) => {
        const lead = mapPlaceToLead(place);
        return { ...lead, qualification: qualifyLead(lead, niche) };
      })
      .filter((lead) => passesCriteria(lead, minScore, tiers, excludeKeywords))
      .filter((lead) => Boolean(lead.phone) || Boolean(lead.email));
  }

  let savedToCrm = 0;
  if (criteria.save_to_crm && qualified.length > 0) {
    const admin = createSupabaseAdminClient();
    for (const lead of qualified.slice(0, 25)) {
      const { error } = await admin.from('leads').insert({
        tenant_id: tenantId,
        business_name: lead.business_name,
        phone: lead.phone || null,
        email: lead.email || null,
        website: lead.website || null,
        address: lead.address || null,
        rating: lead.rating ?? null,
        industry: niche,
        source: apifyRunId ? 'apify_google_places' : 'bonnie_find_leads',
        stage: lead.qualification.tier === 'hot' ? 'qualified' : 'lead',
        metadata: { qualification: lead.qualification, source_id: lead.source_id, source_url: lead.source_url, apify_run_id: apifyRunId, cost_usd: costUsd },
      });
      if (!error) savedToCrm += 1;
    }
  }

  return {
    niche,
    location,
    min_score: minScore,
    raw_count: rawCount,
    qualified_count: qualified.length,
    saved_to_crm: savedToCrm,
    location_validated: locationValidated,
    apify_run_id: apifyRunId,
    cost_usd: costUsd,
    leads: qualified.slice(0, 15).map((l) => ({
      business_name: l.business_name,
      phone: l.phone,
      email: l.email,
      website: l.website,
      address: l.address,
      score: l.qualification.score,
      tier: l.qualification.tier,
      pitch_angle: l.qualification.pitchAngle,
      insights: l.qualification.insights.slice(0, 3),
      can_auto_send: l.qualification.canAutoSend,
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
  opts: { min_score?: number; grade?: string; limit?: number } = {}
) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from('scraper_leads')
    .select('id, name, company, email, phone, company_website, score, grade, status, campaign_id')
    .eq('tenant_id', tenantId)
    .order('score', { ascending: false })
    .limit(Math.min(opts.limit ?? 50, 100));

  if (opts.min_score != null) query = query.gte('score', opts.min_score);
  if (opts.grade) query = query.eq('grade', opts.grade);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
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
