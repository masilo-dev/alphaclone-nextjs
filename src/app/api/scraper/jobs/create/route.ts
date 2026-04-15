import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

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
    const tenantId = String(body.tenantId || '').trim();
    const niche = String(body.niche || '').trim();
    const location = String(body.location || '').trim();
    const sortBy = String(body.sortBy || 'default');
    const usePlaywright = Boolean(body.usePlaywright);

    if (!tenantId || !niche) {
      return NextResponse.json({ error: 'tenantId and niche are required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a tenant member' }, { status: 403 });

    const { data: job, error } = await insertLeadSearchJobWithFallback(supabase, {
      tenant_id: tenantId,
      user_id: user.id,
      niche,
      location,
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
    if (error) return clientErrorResponse(error, { request: req, scope: 'scraper/jobs/create.POST' });
    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'scraper/jobs/create.POST' });
  }
}
