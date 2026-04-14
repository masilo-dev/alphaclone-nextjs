import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { LeadResult, LeadStep, runLeadStep } from '@/lib/scraper/freeLeadSearch';

function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  return fallback;
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: job, error: fetchError } = await supabase
      .from('lead_search_jobs')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchError) return clientErrorResponse(fetchError, { request: req, scope: 'scraper/jobs/[id]/step.POST' });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
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
      sortBy: String(job.sort_by || 'default'),
      usePlaywright: Boolean(job.use_playwright),
      partialResults,
      sourceStats,
      sourceErrors,
    });

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
        partial_results: stepResult.partialResults,
        final_results: stepResult.finalResults,
        fallback_used: stepResult.fallbackUsed,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .select('*')
      .single();

    if (updateError) return clientErrorResponse(updateError, { request: req, scope: 'scraper/jobs/[id]/step.POST' });
    return NextResponse.json({ success: true, job: updatedJob });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'scraper/jobs/[id]/step.POST' });
  }
}
