import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeDomain, normalizeEmail, normalizePhone, scoreCandidate } from '@/lib/lead-finder/core';
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
  ownerId: string
): Promise<{ accepted: number; synced: number }> {
  const supabase = getAdminClient();
  const qualityThreshold = 70;
  const fitThreshold = 65;
  const confidenceMin = 40;

  const toAccept: Array<Record<string, unknown>> = [];
  const toLeadInsert: Array<Record<string, unknown>> = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    const q = typeof row.quality_score === 'number' ? row.quality_score : 0;
    const f = typeof row.fit_score === 'number' ? row.fit_score : 0;
    const c = typeof row.confidence_score === 'number' ? row.confidence_score : 0;
    const email = String(row.public_email || '').trim();
    if ((q >= qualityThreshold || f >= fitThreshold) && c >= confidenceMin && email.includes('@')) {
      const total = Math.round((q * 0.5) + (f * 0.35) + (c * 0.15));
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
        website: row.website ? String(row.website) : null,
        source: `Lead Finder:${String(row.source_type || row.search_id || 'discovery')}`,
        stage,
        value: 0,
        notes: notesParts.length ? notesParts.join('\n\n') : null,
        outreach_status: 'pending',
        is_verified: true,
        trust_score: Math.max(0, Math.min(100, total)),
        verification_notes:
          row.verification_status ? `Lead Finder verification: ${String(row.verification_status)}` : null,
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
      .upsert(toLeadInsert, { onConflict: 'tenant_id,email', ignoreDuplicates: true, defaultToNull: false })
      .select('id,email');
    if (leadInsertErr) throw leadInsertErr;
    const byEmail = new Map<string, string>();
    for (const l of (leads || []) as Array<{ id: string; email?: string | null }>) {
      if (l.email) byEmail.set(String(l.email).toLowerCase(), l.id);
    }
    const acceptedRows = toAccept.map(r => {
      const em = String((r as any).public_email || '').toLowerCase();
      const leadId = byEmail.get(em) || null;
      return { ...(r as any), synced_lead_id: leadId };
    });
    const { error: updateErr } = await supabase
      .from('lead_candidates')
      .upsert(acceptedRows, { onConflict: 'workspace_id,source_type,source_external_id', ignoreDuplicates: false, defaultToNull: false });
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
  const { data: search, error } = await supabase.from('lead_searches').select('*').eq('id', job.search_id).single<Search>();
  if (error || !search) throw new Error('SEARCH_NOT_FOUND');
  await supabase.from('lead_searches').update({ status: 'running', progress: 10, started_at: new Date().toISOString() }).eq('id', search.id);

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
    });
    partial = result.partialResults;
    sourceErrors = result.sourceErrors;
    sourceStats = result.sourceStats;
    searchCenter = result.searchCenter;
    await supabase.from('lead_searches').update({ progress: Math.min(90, Math.max(15, result.progress)), discovered_count: partial.length }).eq('id', search.id);
    if (result.nextStep === 'completed') break;
    step = result.nextStep;
  }

  const limit = Math.max(1, search.result_limit || 25);
  const rows = partial.slice(0, limit).map(lead => {
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
    if (insertError) {
      console.warn('[lead-discovery-worker] lead_candidates upsert warning:', insertError.message);
    }
  }

  let crmSyncedCount = 0;
  let autoAcceptedCount = 0;
  try {
    const auto = await autoAcceptAndSyncHighQuality(rows, job.workspace_id, job.created_by);
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
  }).eq('id', search.id);
  await supabase.from('lead_search_jobs').update({
    status: 'completed', progress: 100, records_found: rows.length, records_processed: rows.length,
    records_crm_synced: crmSyncedCount, records_auto_accepted: autoAcceptedCount,
    completed_at: new Date().toISOString(), locked_at: null,
    metadata: { source_errors: sourceErrors, duration_ms: Date.now() - started, auto_accepted: autoAcceptedCount, crm_synced: crmSyncedCount },
  }).eq('id', job.id);
}

export async function processLeadDiscoveryBatch(options?: { workerId?: string; claimLimit?: number; searchId?: string }) {
  const supabase = getAdminClient();
  const activeWorkerId = options?.workerId || workerId;
  const claimLimit = Math.max(1, Math.min(options?.claimLimit ?? 3, 10));
  let jobs: Job[] = [];

  // Try RPC claim first
  try {
    const { data, error } = await supabase.rpc('claim_lead_search_jobs', { worker_id: activeWorkerId, claim_limit: claimLimit });
    if (!error && Array.isArray(data) && data.length > 0) {
      jobs = data as Job[];
    }
  } catch (err) {
    console.warn('[lead-discovery-worker] claim_lead_search_jobs RPC call failed, using direct query fallback:', err);
  }

  // Fallback: If RPC claimed 0 jobs or threw error, query lead_search_jobs directly
  if (jobs.length === 0) {
    try {
      let query = supabase
        .from('lead_search_jobs')
        .select('id, workspace_id, created_by, search_id, attempt_count, max_attempts')
        .in('status', ['queued', 'pending', 'retrying']);

      if (options?.searchId) {
        query = query.eq('search_id', options.searchId);
      }

      const { data: unclaimed, error: selectErr } = await query
        .order('created_at', { ascending: true })
        .limit(claimLimit);

      if (!selectErr && unclaimed && unclaimed.length > 0) {
        const jobIds = unclaimed.map((j) => j.id);
        const { error: lockErr } = await supabase
          .from('lead_search_jobs')
          .update({
            status: 'running',
            locked_at: new Date().toISOString(),
            attempt_count: ((unclaimed[0].attempt_count as number) || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .in('id', jobIds);

        if (!lockErr) {
          jobs = unclaimed as Job[];
        }
      }
    } catch (fallbackErr) {
      console.warn('[lead-discovery-worker] Direct claim fallback error:', fallbackErr);
    }
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
      await supabase.from('lead_search_jobs').update({
        status: retry ? 'retrying' : 'failed',
        locked_at: null,
        next_run_at: new Date(Date.now() + Math.min(30 * 60_000, 2 ** attemptCount * 30_000)).toISOString(),
        error_code: error instanceof Error ? error.message.slice(0, 80) : 'WORKER_ERROR',
        error_message: 'Discovery job failed; retry policy applied.',
      }).eq('id', job.id);
      if (!retry) {
        await supabase.from('lead_searches').update({ status: 'failed', error_count: 1 }).eq('id', job.search_id);
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
