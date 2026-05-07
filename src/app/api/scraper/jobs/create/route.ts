import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { scraperJobCreateSchema } from '@/schemas/validation';

function getMissingColumnName(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code !== '42703' || !maybeError.message) return null;
  const match = maybeError.message.match(/column "([^"]+)"/i);
  return match?.[1] || null;
}

function isMissingRelation(error: unknown, relation: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message || '';
  return (
    (maybeError.code === '42P01' && message.includes(relation)) ||
    (maybeError.code === 'PGRST205' && message.includes(relation))
  );
}

function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  const message = (maybeError.message || '').toLowerCase();
  return maybeError.code === '42501' || message.includes('permission denied') || message.includes('violates row-level security');
}

async function insertLeadSearchJobWithFallback(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: Record<string, unknown>
) {
  const mutablePayload: Record<string, unknown> = { ...payload };
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts += 1;
    const insertRes = await supabase
      .from('lead_search_jobs')
      .insert(mutablePayload)
      .select('*')
      .single();
    if (!insertRes.error) return insertRes;

    const missingColumn = getMissingColumnName(insertRes.error);
    if (missingColumn && missingColumn in mutablePayload) {
      delete mutablePayload[missingColumn];
      continue;
    }
    return insertRes;
  }

  return await supabase
    .from('lead_search_jobs')
    .insert(mutablePayload)
    .select('*')
    .single();
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = scraperJobCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }
    const { tenantId, niche, location, sortBy, usePlaywright, radiusKm } = parsed.data;

    const { data: membership } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a tenant member', code: 'FORBIDDEN' }, { status: 403 });

    const { data: job, error } = await insertLeadSearchJobWithFallback(supabase, {
      tenant_id: tenantId,
      user_id: user.id,
      niche,
      location,
      radius_km: Number.isFinite(radiusKm) ? Math.min(Math.max(radiusKm, 1), 100) : 25,
      sort_by: sortBy,
      use_playwright: usePlaywright,
      status: 'pending',
      progress: 5,
      current_step: 'init',
    });

    if (error && isMissingRelation(error, 'lead_search_jobs')) {
      return NextResponse.json(
        {
          error: 'Lead search jobs table is not available yet. Apply lead queue migration and retry.',
          code: 'LEAD_QUEUE_NOT_READY',
        },
        { status: 503 }
      );
    }
    if (error && isPermissionDenied(error)) {
      return NextResponse.json(
        {
          error: 'Lead search job permission denied. Ensure lead_search_jobs RLS policies allow tenant members to insert and read their own jobs.',
          code: 'LEAD_QUEUE_PERMISSION_DENIED',
        },
        { status: 403 }
      );
    }
    if (error) return clientErrorResponse(error, { request: req, scope: 'scraper/jobs/create.POST' });
    
    const sanitizeLeads = (leads: any[]) => (Array.isArray(leads) ? leads.map(({ source, ...rest }) => rest) : []);
    const sanitizedJob = {
      ...job,
      source_stats: {},
      source_errors: null,
      partial_results: sanitizeLeads(job.partial_results || []),
      final_results: sanitizeLeads(job.final_results || []),
    };

    return NextResponse.json({ success: true, job: sanitizedJob });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'scraper/jobs/create.POST' });
  }
}
