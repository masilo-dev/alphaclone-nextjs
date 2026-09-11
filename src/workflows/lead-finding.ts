import { start } from 'workflow/api';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { runLeadStep, type LeadResult } from '@/lib/scraper/freeLeadSearch';
import { hasRemoteBrowserConfigured } from '@/lib/scraper/browserSerpLeads';
import { leadNurtureWorkflow } from './lead-nurture';
import { enrichLeadData } from '@/services/unifiedAIService';

type WorkflowLead = {
  businessName: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  industry?: string;
  category?: string;
  source: string;
  lat?: number;
  lng?: number;
  rating?: number;
  trustScore: number;
  score: number;
  notes: string;
  valueProposition: string;
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function deriveValueProposition(lead: {
  industry?: string;
  website?: string;
  category?: string;
  rating?: number;
}): string {
  const industry = String(lead.industry || lead.category || '').toLowerCase();
  if (industry.includes('restaurant') || industry.includes('cafe') || industry.includes('food')) {
    return 'Improve local discovery, bookings, and repeat business with stronger automation and follow-up.';
  }
  if (industry.includes('law') || industry.includes('account') || industry.includes('consult')) {
    return 'Convert more qualified consultations by pairing faster intake with structured follow-up workflows.';
  }
  if (industry.includes('hvac') || industry.includes('plumb') || industry.includes('electric') || industry.includes('roof')) {
    return 'Capture and respond to high-intent service requests faster with better lead routing and outreach.';
  }
  if (lead.website) {
    return 'Turn existing web traffic into more qualified pipeline with tighter lead capture and conversion automation.';
  }
  if ((lead.rating || 0) >= 4) {
    return 'Build on strong reputation signals by improving speed-to-lead and client follow-up systems.';
  }
  return 'Increase qualified inbound demand with better contact capture, outreach, and pipeline discipline.';
}

function scoreLead(row: LeadResult): number {
  let score = 25;
  if (row.phone) score += 20;
  if (row.email) score += 25;
  if (row.website) score += 10;
  if (row.address) score += 5;
  if ((row.rating || 0) >= 4) score += 10;
  if (row.source === 'google') score += 5;
  if (row.source === 'osm') score += 5;
  return Math.min(100, score);
}

async function discoverLeads(query: string, location: string): Promise<LeadResult[]> {
  let step: 'init' | 'fallbacks' | 'browser' | 'finalize' | 'completed' = 'init';
  let partialResults: LeadResult[] = [];
  let finalResults: LeadResult[] = [];
  let sourceStats: Record<string, number> = {};
  let sourceErrors: Record<string, string> = {};

  while (step !== 'completed') {
    const result = await runLeadStep({
      step,
      niche: query,
      location,
      radiusKm: 25,
      sortBy: 'rating_desc',
      usePlaywright: hasRemoteBrowserConfigured(),
      partialResults,
      sourceStats,
      sourceErrors,
    });

    partialResults = result.partialResults;
    finalResults = result.finalResults;
    sourceStats = result.sourceStats;
    sourceErrors = result.sourceErrors;
    step = result.nextStep;
  }

  return finalResults.length > 0 ? finalResults : partialResults;
}

async function enrichLeads(rawLeads: LeadResult[], query: string, location: string): Promise<WorkflowLead[]> {
  const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> => {
    const results = new Array<R>(items.length);
    let cursor = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index], index);
      }
    });
    await Promise.all(workers);
    return results;
  };

  return mapLimit(rawLeads.slice(0, 20), 4, async (lead) => {
    const trustScore = scoreLead(lead);
    const website = String(lead.website || '').trim();
    let email = String(lead.email || '').trim();
    let phone = String(lead.phone || '').trim();

    if (website && (!email || !phone)) {
      const { enrichLeadWebsite } = await import('@/lib/scraper/enrichmentPipeline');
      const enrichment = await enrichLeadWebsite(website, 12000).catch(() => null);
      if (enrichment) {
        if (!email) email = enrichment.emails?.[0] || '';
        if (!phone) phone = enrichment.phone || '';
      }
    }

    const intelligence = await enrichLeadData({
      businessName: lead.business_name,
      industry: lead.category || query,
      location: lead.address || location,
      website: lead.website,
      knownEmails: uniqueStrings([email]),
      socialLinks: {},
      techStack: [],
    }).catch(() => 'Intelligence gathering failed. Please try again later.');

    return {
      businessName: lead.business_name,
      email: email || undefined,
      phone: phone || undefined,
      website: lead.website || undefined,
      location: lead.address || location,
      industry: lead.category || query,
      category: lead.category,
      source: lead.source,
      lat: lead.lat,
      lng: lead.lng,
      rating: lead.rating,
      trustScore,
      score: trustScore,
      notes: intelligence,
      valueProposition: deriveValueProposition({
        industry: lead.category || query,
        website: lead.website,
        category: lead.category,
        rating: lead.rating,
      }),
    };
  });
}

async function bulkAddCRM(scoredLeads: WorkflowLead[], tenantId: string) {
  'use step';
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  const insertRows = scoredLeads.map((lead) => ({
    tenant_id: tenantId,
    business_name: lead.businessName,
    email: lead.email || null,
    phone: lead.phone || null,
    location: lead.location || null,
    website: lead.website || null,
    industry: lead.industry || null,
    source: lead.source,
    status: 'new',
    stage: 'lead',
    trust_score: lead.trustScore,
    value_proposition: lead.valueProposition,
    notes: lead.notes,
    latitude: lead.lat || null,
    longitude: lead.lng || null,
    metadata: {
      score: lead.score,
      category: lead.category || null,
      rating: lead.rating || null,
    },
  }));

  const { data: leads } = await supabase
    .from('leads')
    .insert(insertRows)
    .select();

  return leads || [];
}

async function notifyFounder(count: number, tenantId: string) {
  'use step';
  console.log(`Found ${count} new leads for tenant ${tenantId}`);
}

/**
 * Lead Finding Workflow
 * Discovers real leads from the scraper stack, enriches them, and injects them into CRM.
 */
export async function leadFindingWorkflow({ query, location, tenantId }: { query: string; location: string; tenantId: string }) {
  'use workflow';

  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  const rawLeads = await discoverLeads(query, location);
  const enrichedLeads = await enrichLeads(rawLeads, query, location);
  const savedLeads = await bulkAddCRM(enrichedLeads, tenantId);

  await notifyFounder(savedLeads.length, tenantId);

  for (const lead of savedLeads) {
    if ((lead.metadata?.score || 0) >= 60) {
      await start(leadNurtureWorkflow, [{ leadId: lead.id, tenantId }]);
    }
  }
}
