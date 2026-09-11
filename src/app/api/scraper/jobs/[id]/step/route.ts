import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { LeadResult, LeadStep, runLeadStep } from '@/lib/scraper/freeLeadSearch';
import { dedupeLeadsAgainstTenantHistory } from '@/lib/scraper/serverDedupe';
import { z } from 'zod';

const jobIdSchema = z.string().uuid('Invalid job id');

function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  return fallback;
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

function leadIdentityKey(lead: LeadResult): string {
  return [
    (lead.source_id || '').trim().toLowerCase(),
    (lead.business_name || '').trim().toLowerCase(),
    (lead.website || '').trim().toLowerCase(),
    (lead.phone || '').replace(/\D/g, ''),
  ].join('::');
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsedId = jobIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsedId.error.flatten() }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: job, error: fetchError } = await supabase
      .from('lead_search_jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) return clientErrorResponse(fetchError, { request: req, scope: 'scraper/jobs/[id]/step.POST' });
    if (!job) return NextResponse.json({ error: 'Job not found', code: 'NOT_FOUND' }, { status: 404 });
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return NextResponse.json({ success: true, job });
    }

    const step = (job.current_step || 'init') as LeadStep;
    const partialResults = parseJsonArray<LeadResult>(job.partial_results, []);
    const sourceStats = parseJsonObject(job.source_stats);
    const sourceErrors = parseJsonObject(job.source_errors);

    await supabase
      .from('lead_search_jobs')
      .update({
        status: 'running',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    const stepResult = await runLeadStep({
      step,
      niche: String(job.niche || ''),
      location: String(job.location || ''),
      radiusKm: Number(job.radius_km || 25),
      sortBy: String(job.sort_by || 'default'),
      usePlaywright: Boolean(job.use_playwright),
      partialResults,
      sourceStats,
      sourceErrors,
    });

    const dedupeRes = await dedupeLeadsAgainstTenantHistory(
      supabase,
      String(job.tenant_id || ''),
      stepResult.partialResults,
      String(job.id)
    );
    const dedupedPartial = dedupeRes.deduped as LeadResult[];
    const allowedKeys = new Set(dedupedPartial.map((lead) => leadIdentityKey(lead)));
    const dedupedFinal =
      stepResult.nextStep === 'completed'
        ? (stepResult.finalResults.filter((lead) => allowedKeys.has(leadIdentityKey(lead))) as LeadResult[])
        : [];

    const nextStatus = stepResult.nextStep === 'completed' ? 'completed' : 'running';
    const nextStep = stepResult.nextStep === 'completed' ? 'finalize' : stepResult.nextStep;

    const { data: updatedJob, error: updateError } = await supabase
      .from('lead_search_jobs')
      .update({
        status: nextStatus,
        current_step: nextStep,
        progress: stepResult.progress,
        source_stats: stepResult.sourceStats,
        source_errors: stepResult.sourceErrors,
        partial_results: dedupedPartial,
        final_results: dedupedFinal,
        fallback_used: stepResult.fallbackUsed,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select('*')
      .single();

    if (updateError) return clientErrorResponse(updateError, { request: req, scope: 'scraper/jobs/[id]/step.POST' });

    const sanitizeLeads = (leads: any[]) => (Array.isArray(leads) ? leads : []);
    const sanitizeStats = (stats: any) => {
      if (!stats || typeof stats !== 'object') return {};
      const sanitized: Record<string, number> = {};
      for (const [key, count] of Object.entries(stats)) {
        if (typeof count === 'number' && count > 0) sanitized[key] = count;
      }
      return sanitized;
    };

    const sanitizedJob = {
      ...updatedJob,
      source_stats: sanitizeStats(updatedJob!.source_stats),
      source_errors: updatedJob!.source_errors,
      partial_results: sanitizeLeads(updatedJob!.partial_results),
      final_results: sanitizeLeads(updatedJob!.final_results),
    };

    return NextResponse.json({ success: true, job: sanitizedJob });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'scraper/jobs/[id]/step.POST' });
  }
}
