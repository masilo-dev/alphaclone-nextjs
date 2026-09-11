import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeDomain, normalizeEmail, normalizePhone, scoreCandidate, buildLeadCandidateDedupeKey, buildCanonicalBusinessKey, calculateCompositeLeadScore, candidateMeetsRequirements, type LeadContactRequirements } from '@/lib/lead-finder/core';
import { crawlPublicWebsite } from '@/lib/lead-finder/websiteCrawler';
import { loadLeadProviderPolicy } from '@/lib/lead-finder/providerPolicy';
import { runLeadStep, type LeadResult, type LeadStep } from '@/lib/scraper/freeLeadSearch';
import type { GeoPoint } from '@/lib/scraper/freeGeoSources';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const workerId = process.env.RAILWAY_REPLICA_ID || `lead-worker-${process.pid}`;
let stopping = false;

type Job = { id: string; workspace_id: string; created_by: string; search_id: string; attempt_count: number; max_attempts: number };
type Search = {
  id: string; query?: string; location?: string; city?: string; country?: string; industry?: string;
  business_keywords?: string[]; result_limit?: number; exclusions?: { keywords?: string[] };
  requirements?: LeadContactRequirements;
};

function getAdminClient(): SupabaseClient {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (envUrl && envKey) {
    return createSupabaseAdminClient();
  }

  // Fallback: Read from .env.local if environment variables are not populated in current process
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      let url = envUrl;
      let key = envKey;
      for (const line of content.split('\n')) {
        const [k, ...v] = line.split('=');
        const trimmedK = k?.trim();
        const val = v.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        if (!url && (trimmedK === 'NEXT_PUBLIC_SUPABASE_URL' || trimmedK === 'VITE_SUPABASE_URL')) url = val;
        if (!key && trimmedK === 'SUPABASE_SERVICE_ROLE_KEY') key = val;
      }
      if (url && key) {
        return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      }
    }
  } catch {}

  return createSupabaseAdminClient();
}

function autoAcceptAndSyncHighQuality(
  rows: Array<Record<string, unknown>>,
  workspaceId: string,
  ownerId: string,
  options: { enabled: boolean; threshold: number }
): Promise<{ accepted: number; synced: number }> {
  if (!options.enabled) return Promise.resolve({ accepted: 0, synced: 0 });
  const supabase = getAdminClient();
  const qualityThreshold = options.threshold;
  const fitThreshold = options.threshold;
  const confidenceMin = 40;

  const toAccept: Array<Record<string, unknown>> = [];
  const toLeadInsert: Array<Record<string, unknown>> = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    const q = typeof row.quality_score === 'number' ? row.quality_score : 0;
    const f = typeof row.fit_score === 'number' ? row.fit_score : 0;
    const c = typeof row.confidence_score === 'number' ? row.confidence_score : 0;
    const email = String(row.public_email || '').trim();
    const phone = String(row.public_phone || '').trim();
    const blocked = ['suppressed', 'unsubscribed', 'customer', 'duplicate', 'known'].includes(String(row.outreach_memory_status || 'new'));
    if ((q >= qualityThreshold || f >= fitThreshold) && c >= confidenceMin && Boolean(email || phone) && !blocked) {
      const total = Number(row.final_score || calculateCompositeLeadScore({ fit: f, quality: q, confidence: c, contactability: email && phone ? 100 : 70, freshness: 100, opportunity: Number(row.opportunity_score || 0) }));
      const stage =
        total >= 75 ? 'qualified' :
        total >= 50 ? 'prospect' : 'lead';
      row.review_status = 'accepted';
      row.accepted_at = now;
      row.updated_at = now;
      toAccept.push(row);

      const notesParts: string[] = [];
      if (row.description) notesParts.push(String(row.description));
      if (typeof row.score_explanation === 'string' && row.score_explanation) notesParts.push(`Fit: ${row.score_explanation}`);
      if (row.city || row.country || row.industry) {
        const meta = [row.city, row.country].filter(Boolean).join(', ');
        if (meta || row.industry) notesParts.push([String(row.industry || ''), meta].filter(Boolean).join(' · '));
      }
      if (row.source_url || row.source_type) {
        const srcParts = [row.source_type && `Source: ${row.source_type}`, row.source_url && String(row.source_url)].filter(Boolean);
        if (srcParts.length) notesParts.push(srcParts.join(' — '));
      }

      toLeadInsert.push({
        tenant_id: workspaceId,
        owner_id: ownerId,
        business_name: String(row.business_name || 'Discovered business').trim() || 'Discovered business',
        industry: row.industry ? String(row.industry) : null,
        location: [row.city, row.country].filter(Boolean).join(', ') || null,
        phone: row.public_phone ? String(row.public_phone) : null,
        email,
        canonical_business_key: String(row.canonical_business_key || ''),
        website: row.website ? String(row.website) : null,
        source: `Lead Finder:${String(row.source_type || row.search_id || 'discovery')}`,
        stage,
        value: 0,
        notes: notesParts.length ? notesParts.join('\n\n') : null,
        outreach_status: 'pending',
        is_verified: false,
        trust_score: Math.max(0, Math.min(100, total)),
        verification_notes:
          row.verification_status ? `Public contact status: ${String(row.verification_status)}; deliverability not verified.` : null,
        metadata: {
          lead_candidate_id: String(row.id || ''),
          lead_search_id: row.search_id ? String(row.search_id) : null,
          source: {
            type: row.source_type ? String(row.source_type) : null,
            external_id: row.source_external_id ? String(row.source_external_id) : null,
            url: row.source_url ? String(row.source_url) : null,
          },
          scores: { quality: q, fit: f, confidence: c },
        },
      });
    }
  }

  if (toAccept.length === 0) return Promise.resolve({ accepted: 0, synced: 0 });

  return (async () => {
    const { data: leads, error: leadInsertErr } = await supabase
      .from('leads')
      .upsert(toLeadInsert, { onConflict: 'tenant_id,canonical_business_key', ignoreDuplicates: true, defaultToNull: false })
      .select('id,email,canonical_business_key');
    if (leadInsertErr) throw leadInsertErr;
    const byEmail = new Map<string, string>(); const byKey = new Map<string, string>();
    for (const l of (leads || []) as Array<{ id: string; email?: string | null; canonical_business_key?: string | null }>) {
      if (l.email) byEmail.set(String(l.email).toLowerCase(), l.id);
      if (l.canonical_business_key) byKey.set(l.canonical_business_key, l.id);
    }
    const acceptedRows = toAccept.map(r => {
      const em = String((r as any).public_email || '').toLowerCase();
      const leadId = byEmail.get(em) || byKey.get(String((r as any).canonical_business_key || '')) || null;
      return { ...(r as any), synced_lead_id: leadId };
    });
    const { error: updateErr } = await supabase
      .from('lead_candidates')
      .upsert(acceptedRows, { onConflict: 'workspace_id,canonical_business_key', ignoreDuplicates: false, defaultToNull: false });
    if (updateErr) throw updateErr;
    return { accepted: acceptedRows.length, synced: leads?.length || 0 };
  })().catch(err => {
    console.warn('[lead-discovery-worker] Auto-accept sync warning:', err);
    return { accepted: 0, synced: 0 };
  });
}

async function execute(job: Job) {
  const supabase = getAdminClient();
  const started = Date.now();
  const { data: search, error } = await supabase.from('lead_searches').select('*').eq('id', job.search_id).eq('workspace_id', job.workspace_id).single<Search>();
  if (error || !search) throw new Error('SEARCH_NOT_FOUND');
  const policy = await loadLeadProviderPolicy(supabase, job.workspace_id);
  await supabase.from('lead_searches').update({ status: 'running', progress: 10, started_at: new Date().toISOString() }).eq('id', search.id).eq('workspace_id', job.workspace_id);

  let step: LeadStep = 'init';
  let partial: LeadResult[] = [];
  let sourceErrors: Record<string, string> = {};
  let sourceStats: Record<string, number> = {};
  let searchCenter: GeoPoint | null = null;

  for (let guard = 0; guard < 4; guard++) {
    const result = await runLeadStep({
      step,
      niche: search.query || search.business_keywords?.join(' ') || search.industry || 'business',
      location: search.location || [search.city, search.country].filter(Boolean).join(', '),
      radiusKm: 40,
      partialResults: partial,
      usePlaywright: false,
      sortBy: 'reach_asc',
      sourceErrors,
      sourceStats,
      searchCenter,
      resultLimit: search.result_limit || 25,
      allowHere: !policy.freeOnly && policy.providers.here === true && Boolean(process.env.HERE_API_KEY),
    });
    partial = result.partialResults;
    sourceErrors = result.sourceErrors;
    sourceStats = result.sourceStats;
    searchCenter = result.searchCenter;
    await supabase.from('lead_searches').update({ progress: Math.min(90, Math.max(15, result.progress)), discovered_count: partial.length }).eq('id', search.id).eq('workspace_id', job.workspace_id);
    if (result.nextStep === 'completed') break;
    step = result.nextStep;
  }

  const limit = Math.max(1, search.result_limit || 25);
  const enriched: Array<{ lead: LeadResult; crawl: Awaited<ReturnType<typeof crawlPublicWebsite>> | null }> = [];
  for (let index = 0; index < Math.min(partial.length, limit); index += 6) {
    const batch = await Promise.all(partial.slice(index, index + 6).map(async (lead) => {
      if (!lead.website || lead.email) return { lead, crawl: null };
      try { return { lead, crawl: await crawlPublicWebsite(lead.website, { maxPages: 6 }) }; }
      catch { return { lead, crawl: null }; }
    }));
    enriched.push(...batch);
  }
  const rows = enriched.map(({ lead, crawl }) => {
    const publicEmail = normalizeEmail(lead.email) || crawl?.emails[0]?.email || null;
    const candidate = {
      website: lead.website || null, public_email: publicEmail, public_phone: normalizePhone(lead.phone, search.country),
      address_line_1: lead.address || null, industry: lead.category || search.industry || null,
      city: search.city || null, business_name: lead.business_name,
    };
    const score = scoreCandidate(candidate, search);
    const contactability = candidate.public_email && candidate.public_phone ? 100 : candidate.public_email || candidate.public_phone ? 70 : 20;
    const opportunity = crawl?.quality?.opportunity_score || 0;
    const finalScore = calculateCompositeLeadScore({ fit: score.fitScore, quality: score.qualityScore, confidence: lead.hasContact ? 75 : 45, contactability, freshness: 100, opportunity });
    const canonicalBusinessKey = buildCanonicalBusinessKey({ email: candidate.public_email, website: candidate.website, phone: candidate.public_phone, sourceExternalId: lead.source_id, businessName: lead.business_name, city: search.city || null, country: search.country || null });
    return {
      workspace_id: job.workspace_id, created_by: job.created_by, search_id: search.id,
      source_type: lead.source, source_url: lead.source_url || lead.website || null,
      source_external_id: lead.source_id, business_name: lead.business_name,
      public_email: candidate.public_email, public_phone: candidate.public_phone,
      website: candidate.website, domain: normalizeDomain(candidate.website), address_line_1: candidate.address_line_1,
      city: candidate.city, country: search.country || null, latitude: lead.lat, longitude: lead.lng,
      industry: candidate.industry, business_category: lead.category || null, description: lead.snippet,
      raw_data: { ...lead, crawl_quality: crawl?.quality || null }, normalized_data: { domain: normalizeDomain(candidate.website), email: candidate.public_email, phone: candidate.public_phone },
      confidence_score: lead.hasContact ? 75 : 45, quality_score: score.qualityScore,
      fit_score: score.fitScore, contactability_score: contactability, freshness_score: 100, opportunity_score: opportunity, final_score: finalScore,
      score_explanation: [...score.explanation, ...(crawl?.quality?.problems || []).map((reason) => ({ type: 'website_opportunity', points: 0, reason }))],
      verification_status: crawl?.emails[0] ? 'publicly_published' : candidate.public_email ? 'format_valid' : 'unknown',
      field_provenance: crawl?.emails[0] ? { email: { value: crawl.emails[0].email, source: crawl.emails[0].source_url } } : {},
      source_sightings: [{ source: lead.source, source_external_id: lead.source_id, source_url: lead.source_url, seen_at: new Date().toISOString() }],
      canonical_business_key: canonicalBusinessKey, outreach_memory_status: 'new', last_seen_at: new Date().toISOString(),
      dedupe_key: buildLeadCandidateDedupeKey({
        source_type: lead.source,
        source_external_id: lead.source_id,
        website: candidate.website,
        business_name: lead.business_name,
        city: candidate.city,
      }),
    };
  }).filter((row) => candidateMeetsRequirements({
    business_name: row.business_name,
    website: row.website,
    public_email: row.public_email,
    public_phone: row.public_phone,
  }, search.requirements));

  if (rows.length) {
    const { error: insertError } = await supabase.from('lead_candidates').upsert(rows, {
      onConflict: 'workspace_id,canonical_business_key',
      ignoreDuplicates: true,
    });
    if (insertError) {
      console.warn('[lead-discovery-worker] lead_candidates upsert warning:', insertError.message);
      for (const row of rows) {
        const { error: singleError } = await supabase.from('lead_candidates').insert(row);
        if (singleError && !/duplicate|unique|23505/i.test(singleError.message)) {
          console.warn('[lead-discovery-worker] lead_candidates insert warning:', singleError.message);
        }
      }
    }
  }

  // Qualification is shared canonical intelligence. A failure here must not
  // discard discovered businesses; the next enrichment/requalification can retry.
  try {
    const keys = rows.map((row) => String(row.canonical_business_key)).filter(Boolean);
    const { data: savedCandidates, error: candidateError } = await supabase.from('lead_candidates').select('*')
      .eq('workspace_id', job.workspace_id).in('canonical_business_key', keys);
    if (candidateError) throw candidateError;
    const { qualifyCandidate } = await import('@/lib/lead-finder/qualificationEngine');
    for (const candidate of savedCandidates || []) {
      await qualifyCandidate(supabase, job.workspace_id, candidate as Record<string, unknown>);
    }
  } catch (qualificationError) {
    console.warn('[lead-discovery-worker] qualification warning:', qualificationError);
  }

  let crmSyncedCount = 0;
  let autoAcceptedCount = 0;
  try {
    const auto = await autoAcceptAndSyncHighQuality(rows, job.workspace_id, job.created_by, {
      enabled: policy.autoAccept,
      threshold: policy.threshold,
    });
    crmSyncedCount = auto.synced;
    autoAcceptedCount = auto.accepted;
  } catch (err) {
    console.warn('[lead-discovery-worker] Auto-accept/sync failed gracefully, search continues:', err);
  }

  const status = Object.keys(sourceErrors).length && rows.length === 0 ? 'failed' : Object.keys(sourceErrors).length ? 'partially_completed' : 'completed';
  await supabase.from('lead_searches').update({
    status, progress: 100, discovered_count: rows.length, error_count: Object.keys(sourceErrors).length,
    accepted_count: autoAcceptedCount, crm_synced_count: crmSyncedCount,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', search.id).eq('workspace_id', job.workspace_id);
  await supabase.from('lead_search_jobs').update({
    status: 'completed', progress: 100, records_found: rows.length, records_processed: rows.length,
    records_crm_synced: crmSyncedCount, records_auto_accepted: autoAcceptedCount,
    completed_at: new Date().toISOString(), locked_at: null,
    metadata: { source_errors: sourceErrors, duration_ms: Date.now() - started, auto_accepted: autoAcceptedCount, crm_synced: crmSyncedCount },
  }).eq('id', job.id).eq('workspace_id', job.workspace_id);

  // Emit durable runtime outbox event
  try {
    const { insertOutboxEvent } = await import('@/lib/bonnie/runtime/outboxService');
    await insertOutboxEvent({
      tenantId: job.workspace_id,
      eventType: 'lead.qualified',
      payload: { searchId: search.id, jobId: job.id, discoveredCount: rows.length, crmSyncedCount },
    });
  } catch {}
}

export async function processLeadDiscoveryBatch(options?: { workerId?: string; claimLimit?: number; searchId?: string }) {
  const supabase = getAdminClient();
  const activeWorkerId = options?.workerId || workerId;
  const claimLimit = Math.max(1, Math.min(options?.claimLimit ?? 3, 10));
  let jobs: Job[] = [];

  // A terminated cron used to leave jobs at `running` forever. Requeue only
  // expired locks so another worker can safely finish the durable search.
  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: staleJobs } = await supabase.from('lead_search_jobs')
    .update({ status: 'retrying', locked_at: null, next_run_at: new Date().toISOString() })
    .eq('status', 'running').lt('locked_at', staleBefore)
    .select('search_id,workspace_id');
  for (const stale of staleJobs || []) {
    if (!stale.search_id || !stale.workspace_id) continue;
    await supabase.from('lead_searches').update({ status: 'queued' })
      .eq('id', stale.search_id).eq('workspace_id', stale.workspace_id).eq('status', 'running');
  }

  // Try RPC claim first
  try {
    const { data, error } = await supabase.rpc('claim_lead_search_jobs', { worker_id: activeWorkerId, claim_limit: claimLimit });
    if (error) throw new Error(`LEAD_JOB_CLAIM_FAILED: ${error.message}`);
    if (Array.isArray(data) && data.length > 0) {
      jobs = data as Job[];
    }
  } catch (err) {
    throw err;
  }


  const results: Array<{ jobId: string; ok: boolean; error?: string }> = [];
  for (const job of jobs) {
    try {
      await execute(job);
      results.push({ jobId: job.id, ok: true });
    } catch (error) {
      const attemptCount = typeof job.attempt_count === 'number' ? job.attempt_count : 1;
      const maxAttempts = typeof job.max_attempts === 'number' ? job.max_attempts : 3;
      const retry = attemptCount < maxAttempts;
      const updateRes = await supabase.from('lead_search_jobs').update({
        status: retry ? 'retrying' : 'failed',
        locked_at: null,
        next_run_at: new Date(Date.now() + Math.min(30 * 60_000, 2 ** attemptCount * 30_000)).toISOString(),
        error_code: error instanceof Error ? error.message.slice(0, 80) : 'WORKER_ERROR',
        error_message: 'Discovery job failed; retry policy applied.',
      }).eq('id', job.id).eq('workspace_id', job.workspace_id);

      if (updateRes.error && (updateRes.error.code === '22P02' || /retrying/i.test(updateRes.error.message)) && retry) {
        await supabase.from('lead_search_jobs').update({
          status: 'queued',
          locked_at: null,
          next_run_at: new Date(Date.now() + Math.min(30 * 60_000, 2 ** attemptCount * 30_000)).toISOString(),
          error_code: error instanceof Error ? error.message.slice(0, 80) : 'WORKER_ERROR',
          error_message: 'Discovery job failed; retry policy applied.',
        }).eq('id', job.id).eq('workspace_id', job.workspace_id);
      }

      if (!retry) {
        await supabase.from('lead_searches').update({ status: 'failed', error_count: 1 }).eq('id', job.search_id).eq('workspace_id', job.workspace_id);
      }
      results.push({
        jobId: job.id,
        ok: false,
        error: error instanceof Error ? error.message : 'WORKER_ERROR',
      });
    }
  }
  return { claimed: jobs.length, results };
}

async function tick() {
  await processLeadDiscoveryBatch();
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

async function main() {
  while (!stopping) {
    try {
      await tick();
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        service: 'lead-discovery-worker',
        worker_id: workerId,
        error: error instanceof Error ? error.message : 'unknown',
      }));
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

if (process.argv[1]?.includes('lead-discovery-worker')) {
  void main();
}
