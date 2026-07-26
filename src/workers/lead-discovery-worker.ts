import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeDomain, normalizeEmail, normalizePhone, scoreCandidate } from '@/lib/lead-finder/core';
import { runLeadStep, type LeadResult, type LeadStep } from '@/lib/scraper/freeLeadSearch';
import type { GeoPoint } from '@/lib/scraper/freeGeoSources';

const workerId = process.env.RAILWAY_REPLICA_ID || `lead-worker-${process.pid}`;
const supabase = createSupabaseAdminClient();
let stopping = false;

type Job = { id: string; workspace_id: string; created_by: string; search_id: string; attempt_count: number; max_attempts: number };
type Search = {
  id: string; query?: string; location?: string; city?: string; country?: string; industry?: string;
  business_keywords?: string[]; result_limit: number; exclusions?: { keywords?: string[] };
};

async function execute(job: Job) {
  const started = Date.now();
  const { data: search, error } = await supabase.from('lead_searches').select('*').eq('id', job.search_id).single<Search>();
  if (error || !search) throw new Error('SEARCH_NOT_FOUND');
  await supabase.from('lead_searches').update({ status: 'running', progress: 5, started_at: new Date().toISOString() }).eq('id', search.id);

  let step: LeadStep = 'init'; let partial: LeadResult[] = [];
  let sourceErrors: Record<string, string> = {}; let sourceStats: Record<string, number> = {};
  let searchCenter: GeoPoint | null = null;
  for (let guard = 0; guard < 4; guard++) {
    const result = await runLeadStep({
      step, niche: search.query || search.business_keywords?.join(' ') || search.industry || 'business',
      location: search.location || [search.city, search.country].filter(Boolean).join(', '),
      radiusKm: 40, partialResults: partial, usePlaywright: false, sortBy: 'reach_asc',
      sourceErrors, sourceStats, searchCenter,
    });
    partial = result.partialResults; sourceErrors = result.sourceErrors;
    sourceStats = result.sourceStats; searchCenter = result.searchCenter;
    await supabase.from('lead_searches').update({ progress: result.progress, discovered_count: partial.length }).eq('id', search.id);
    if (result.nextStep === 'completed') break;
    step = result.nextStep;
  }

  const rows = partial.slice(0, search.result_limit).map(lead => {
    const candidate = {
      website: lead.website || null, public_email: normalizeEmail(lead.email), public_phone: normalizePhone(lead.phone, search.country),
      address_line_1: lead.address || null, industry: lead.category || search.industry || null,
      city: search.city || search.location || null, business_name: lead.business_name,
    };
    const score = scoreCandidate(candidate, search);
    return {
      workspace_id: job.workspace_id, created_by: job.created_by, search_id: search.id,
      source_type: lead.source, source_url: lead.source_url || lead.website || null,
      source_external_id: lead.source_id, business_name: lead.business_name,
      public_email: candidate.public_email, public_phone: candidate.public_phone,
      website: candidate.website, domain: normalizeDomain(candidate.website), address_line_1: candidate.address_line_1,
      city: candidate.city, country: search.country || null, latitude: lead.lat, longitude: lead.lng,
      industry: candidate.industry, business_category: lead.category || null, description: lead.snippet,
      raw_data: lead, normalized_data: { domain: normalizeDomain(candidate.website), email: candidate.public_email, phone: candidate.public_phone },
      confidence_score: lead.hasContact ? 75 : 45, quality_score: score.qualityScore,
      fit_score: score.fitScore, score_explanation: score.explanation,
      verification_status: candidate.public_email ? 'format_valid' : 'unverified',
    };
  });
  if (rows.length) {
    const { error: insertError } = await supabase.from('lead_candidates').upsert(rows, { onConflict: 'workspace_id,source_type,source_external_id', ignoreDuplicates: true });
    if (insertError) throw insertError;
  }
  const status = Object.keys(sourceErrors).length ? 'partially_completed' : 'completed';
  await supabase.from('lead_searches').update({
    status, progress: 100, discovered_count: rows.length, error_count: Object.keys(sourceErrors).length,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', search.id);
  await supabase.from('lead_search_jobs').update({
    status: 'completed', progress: 100, records_found: rows.length, records_processed: rows.length,
    completed_at: new Date().toISOString(), locked_at: null,
    metadata: { source_errors: sourceErrors, duration_ms: Date.now() - started },
  }).eq('id', job.id);
}

async function tick() {
  const { data, error } = await supabase.rpc('claim_lead_search_jobs', { worker_id: workerId, claim_limit: 3 });
  if (error) throw error;
  for (const job of (data || []) as Job[]) {
    try { await execute(job); }
    catch (error) {
      const retry = job.attempt_count < job.max_attempts;
      await supabase.from('lead_search_jobs').update({
        status: retry ? 'retrying' : 'failed', locked_at: null,
        next_run_at: new Date(Date.now() + Math.min(30 * 60_000, 2 ** job.attempt_count * 30_000)).toISOString(),
        error_code: error instanceof Error ? error.message.slice(0, 80) : 'WORKER_ERROR',
        error_message: 'Discovery job failed; retry policy applied.',
      }).eq('id', job.id);
      if (!retry) await supabase.from('lead_searches').update({ status: 'failed', error_count: 1 }).eq('id', job.search_id);
    }
  }
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
async function main() {
  while (!stopping) {
    try { await tick(); } catch (error) { console.error(JSON.stringify({ level: 'error', service: 'lead-discovery-worker', worker_id: workerId, error: error instanceof Error ? error.message : 'unknown' })); }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
void main();
